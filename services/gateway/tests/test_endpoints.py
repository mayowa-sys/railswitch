from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.engine_client import EngineClient, get_engine_client
from app.main import app

client = TestClient(app)

AUTH_HEADER = {"Authorization": "Bearer sk_test_mockmerchanta"}


@pytest.fixture(autouse=True)
def _mock_engine_client():
    mock_httpx = AsyncMock(spec=httpx.AsyncClient)
    mock_httpx.request = AsyncMock()
    engine = EngineClient(client=mock_httpx, merchant_id="merchant_a", idempotency_key=None)
    app.dependency_overrides[get_engine_client] = lambda: engine
    yield
    app.dependency_overrides.clear()


# ===================== PRORATION PREVIEW =====================


def test_preview_subscription_success():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "current_plan": {"id": "plan_a", "name": "Starter", "amount": 5000, "currency": "NGN", "interval": "monthly"},
        "new_plan": {"id": "plan_b", "name": "Pro", "amount": 15000, "currency": "NGN", "interval": "monthly"},
        "current_period_start": "2024-01-01T00:00:00Z",
        "current_period_end": "2024-01-31T00:00:00Z",
        "effective_date": "2024-01-26T00:00:00Z",
        "remaining_days": 5,
        "total_days_in_period": 30,
        "credit": {"amount": 833.33, "description": "Unused portion of Starter"},
        "charge": {"amount": 2500.00, "description": "Prorated charge for Pro for 5 days"},
        "net_amount": 1666.67,
        "currency": "NGN",
    }
    engine: EngineClient = app.dependency_overrides[get_engine_client]()
    engine._client.request.return_value = mock_resp

    response = client.post(
        "/v1/subscriptions/sub_abc123/preview",
        json={"new_plan_id": "plan_b", "effective_date": "2024-01-26T00:00:00Z"},
        headers=AUTH_HEADER,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["error"] is None
    data = body["data"]
    assert data["current_plan"]["id"] == "plan_a"
    assert data["new_plan"]["id"] == "plan_b"
    assert data["net_amount"] == 1666.67
    assert data["remaining_days"] == 5
    engine._client.request.assert_called_once_with(
        "POST",
        "/internal/v1/subscriptions/sub_abc123/preview",
        headers=engine._headers(),
        json={"new_plan_id": "plan_b", "effective_date": "2024-01-26T00:00:00Z"},
    )


def test_preview_subscription_minimal_payload():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "current_plan": {"id": "plan_a", "name": "Starter", "amount": 5000, "currency": "NGN", "interval": "monthly"},
        "new_plan": {"id": "plan_b", "name": "Pro", "amount": 15000, "currency": "NGN", "interval": "monthly"},
        "current_period_start": "2024-01-01T00:00:00Z",
        "current_period_end": "2024-01-31T00:00:00Z",
        "effective_date": "2024-01-26T00:00:00Z",
        "remaining_days": 5,
        "total_days_in_period": 30,
        "credit": {"amount": 833.33, "description": "Unused portion of Starter"},
        "charge": {"amount": 2500.00, "description": "Prorated charge for Pro for 5 days"},
        "net_amount": 1666.67,
        "currency": "NGN",
    }
    engine: EngineClient = app.dependency_overrides[get_engine_client]()
    engine._client.request.return_value = mock_resp

    response = client.post(
        "/v1/subscriptions/sub_abc123/preview",
        json={"new_plan_id": "plan_b"},
        headers=AUTH_HEADER,
    )

    assert response.status_code == 200
    engine._client.request.assert_called_once()
    _, _, kwargs = engine._client.request.mock_calls[0]
    assert kwargs["json"] == {"new_plan_id": "plan_b"}


def test_preview_subscription_missing_plan_id():
    response = client.post(
        "/v1/subscriptions/sub_abc123/preview",
        json={},
        headers=AUTH_HEADER,
    )
    assert response.status_code == 422


# ===================== PAYMENT METHODS =====================


def test_create_payment_method_success():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 201
    mock_resp.json.return_value = {
        "id": "pm_001",
        "customer_id": "cust_001",
        "type": "card",
        "nomba_token": "tok_test_xxxxxxxx",
        "merchant_id": "merchant_a",
        "last4": "4242",
        "brand": "visa",
        "exp_month": "12",
        "exp_year": "2028",
        "is_default": True,
        "metadata": {},
        "created_at": "2024-01-15T10:00:00Z",
        "deleted_at": None,
    }
    engine: EngineClient = app.dependency_overrides[get_engine_client]()
    engine._client.request.return_value = mock_resp

    response = client.post(
        "/v1/payment-methods",
        json={
            "customer_id": "cust_001",
            "type": "card",
            "nomba_token": "tok_test_xxxxxxxx",
            "last4": "4242",
            "brand": "visa",
            "exp_month": "12",
            "exp_year": "2028",
            "is_default": True,
        },
        headers=AUTH_HEADER,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["error"] is None
    assert body["data"]["id"] == "pm_001"
    assert body["data"]["last4"] == "4242"
    assert body["data"]["brand"] == "visa"


def test_create_payment_method_minimal():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 201
    mock_resp.json.return_value = {
        "id": "pm_002",
        "customer_id": "cust_001",
        "type": "card",
        "nomba_token": "tok_test_yyyyyyy",
        "merchant_id": "merchant_a",
        "last4": "",
        "brand": "",
        "exp_month": "",
        "exp_year": "",
        "is_default": False,
        "metadata": {},
        "created_at": "2024-01-15T10:00:00Z",
        "deleted_at": None,
    }
    engine: EngineClient = app.dependency_overrides[get_engine_client]()
    engine._client.request.return_value = mock_resp

    response = client.post(
        "/v1/payment-methods",
        json={
            "customer_id": "cust_001",
            "type": "card",
            "nomba_token": "tok_test_yyyyyyy",
        },
        headers=AUTH_HEADER,
    )

    assert response.status_code == 200
    assert response.json()["data"]["id"] == "pm_002"


def test_create_payment_method_missing_required():
    response = client.post(
        "/v1/payment-methods",
        json={"customer_id": "cust_001"},
        headers=AUTH_HEADER,
    )
    assert response.status_code == 422


def test_list_payment_methods():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": [
            {
                "id": "pm_001",
                "customer_id": "cust_001",
                "type": "card",
                "nomba_token": "tok_test_xxxxxxxx",
                "merchant_id": "merchant_a",
                "last4": "4242",
                "brand": "visa",
                "exp_month": "12",
                "exp_year": "2028",
                "is_default": True,
                "metadata": {},
                "created_at": "2024-01-15T10:00:00Z",
                "deleted_at": None,
            }
        ],
        "total": 1,
    }
    engine: EngineClient = app.dependency_overrides[get_engine_client]()
    engine._client.request.return_value = mock_resp

    response = client.get("/v1/payment-methods", headers=AUTH_HEADER)

    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]) == 1
    assert body["data"][0]["id"] == "pm_001"


def test_list_payment_methods_filter_by_customer():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"data": [], "total": 0}
    engine: EngineClient = app.dependency_overrides[get_engine_client]()
    engine._client.request.return_value = mock_resp

    response = client.get("/v1/payment-methods?customer_id=cust_001", headers=AUTH_HEADER)

    assert response.status_code == 200
    engine._client.request.assert_called_once()
    _, _, kwargs = engine._client.request.mock_calls[0]
    assert kwargs["params"] == {"customer_id": "cust_001"}


def test_get_payment_method():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": "pm_001",
        "customer_id": "cust_001",
        "type": "card",
        "nomba_token": "tok_test_xxxxxxxx",
        "merchant_id": "merchant_a",
        "last4": "4242",
        "brand": "visa",
        "exp_month": "12",
        "exp_year": "2028",
        "is_default": True,
        "metadata": {},
        "created_at": "2024-01-15T10:00:00Z",
        "deleted_at": None,
    }
    engine: EngineClient = app.dependency_overrides[get_engine_client]()
    engine._client.request.return_value = mock_resp

    response = client.get("/v1/payment-methods/pm_001", headers=AUTH_HEADER)

    assert response.status_code == 200
    assert response.json()["data"]["id"] == "pm_001"


def test_delete_payment_method():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"id": "pm_001", "deleted": True}
    engine: EngineClient = app.dependency_overrides[get_engine_client]()
    engine._client.request.return_value = mock_resp

    response = client.delete("/v1/payment-methods/pm_001", headers=AUTH_HEADER)

    assert response.status_code == 200
    assert response.json()["data"]["deleted"] is True




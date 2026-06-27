from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "gateway"}


def test_auth_middleware_ok():
    response = client.get(
        "/v1/whoami", headers={"Authorization": "Bearer sk_test_mockmerchanta"}
    )
    assert response.status_code == 200
    assert response.json() == {"merchant": "merchant_a", "mode": "test"}


def test_auth_middleware_bad_key():
    response = client.get(
        "/v1/whoami", headers={"Authorization": "Bearer sk__mockmerchanta"}
    )
    assert response.status_code == 401
    assert response.json() == {
        "data": None,
        "error": {"code": "401", "message": "Malformed API Key"},
        "meta": None,
    }


def test_auth_middleware_no_key():
    response = client.get("/v1/whoami")
    assert response.status_code == 401
    assert response.json() == {
        "data": None,
        "error": {"code": "401", "message": "Not authenticated"},
        "meta": None,
    }

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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
    body = response.json()
    assert body["error"]["code"] == "401"
    assert body["error"]["message"] == "Malformed API Key"


def test_auth_middleware_no_key():
    response = client.get("/v1/whoami")
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "401"
    assert body["error"]["message"] == "Not authenticated"

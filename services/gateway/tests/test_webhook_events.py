from fastapi.testclient import TestClient

from app.main import app




def test_rls_scope_per_merchant():
    with TestClient(app) as client:
        resp_a = client.get("/v1/webhook-events", headers={"Authorization": "Bearer sk_test_mockmerchanta"}
                            )
        resp_b = client.get("/v1/webhook-events", headers={"Authorization": "Bearer sk_test_mockmerchantb"})
        assert {row["merchant_id"] for row in resp_a.json()} == {"merchant_a"}
        assert {row["merchant_id"] for row in resp_b.json()} == {"merchant_b"}

import re
from dataclasses import dataclass

from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

app = FastAPI(title="RailSwitch Gateway", version="0.1.0")

bearer_scheme = HTTPBearer()

_KEY_FORMAT = re.compile(r"^sk_(live|test)_[A-Za-z0-9]{8,}$")


@dataclass(frozen=True)
class ApiKeyRecord:
    merchant_id: str
    mode: str


MOCK_KEYS = {
    "sk_test_mockmerchanta": ApiKeyRecord("merchant_a", "test"),
    "sk_live_mockmerchantb": ApiKeyRecord("merchant_b", "live"),
}


async def get_current_merchant(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ApiKeyRecord:
    token = credentials.credentials

    if not _KEY_FORMAT.match(token):
        raise HTTPException(status_code=401, detail="Malformed API Key")

    record = MOCK_KEYS.get(token)
    if record is None:
        raise HTTPException(status_code=401, detail="Unknown or revoked API key")

    return record


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "gateway"}


@app.get("/v1/whoami")
async def whoami(merchant: ApiKeyRecord = Depends(get_current_merchant)) -> dict:
    return {"merchant": merchant.merchant_id, "mode": merchant.mode}

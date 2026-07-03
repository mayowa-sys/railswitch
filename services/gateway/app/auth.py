import re
from dataclasses import dataclass
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import os
import json
import hmac
import hashlib
import base64

bearer_scheme = HTTPBearer()

# Format: sk_(live|test)_<merchant_id>__<random_chars>
_KEY_FORMAT = re.compile(r"^sk_(live|test)_(.+?)__[A-Za-z0-9_-]{8,}$")


@dataclass(frozen=True)
class ApiKeyRecord:
    merchant_id: str
    mode: str


_USE_MOCK_KEYS = os.getenv("RAILSWITCH_USE_MOCK_KEYS", "").lower() in ("1", "true", "yes")

MOCK_KEYS: dict[str, ApiKeyRecord] = {}
if _USE_MOCK_KEYS:
    MOCK_KEYS = {
        "sk_test_mockmerchanta": ApiKeyRecord("merchant_a", "test"),
        "sk_live_mockmerchantb": ApiKeyRecord("merchant_b", "live"),
    }


async def get_portal_merchant(request: Request) -> str | None:
    """If request has x-portal-token, resolve it and return merchant_id."""
    token = request.headers.get("x-portal-token")
    if not token:
        return None
    
    try:
        # Verify token locally
        secret = os.getenv("PORTAL_SECRET")
        if not secret:
            raise Exception("PORTAL_SECRET not set")
        payload_b64, sig = token.split(".")
        payload = base64.urlsafe_b64decode(payload_b64 + "=" * (4 - len(payload_b64) % 4))
        expected_sig = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        if sig != expected_sig:
            return None
        
        data = json.loads(payload)
        if data.get("exp", 0) < __import__("time").time() * 1000:
            return None
        
        return data.get("merchantId")
    except Exception:
        return None

async def get_current_merchant_with_portal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = None,
) -> ApiKeyRecord:
    # Try portal token first
    token = request.headers.get("x-portal-token")
    if token:
        merchant_id = await get_portal_merchant(request)
        if merchant_id:
            return ApiKeyRecord(merchant_id=merchant_id, mode="test")
    
    # Fall back to API key auth
    if credentials is None:
        bearer = HTTPBearer()
        credentials = await bearer(request)
    
    return await get_current_merchant(credentials)

async def get_current_merchant(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ApiKeyRecord:
    token = credentials.credentials

    record = MOCK_KEYS.get(token)
    if record is not None:
        return record

    m = _KEY_FORMAT.match(token)
    if not m:
        raise HTTPException(status_code=401, detail="Malformed API Key")

    mode = m.group(1)
    merchant_id = m.group(2)
    return ApiKeyRecord(merchant_id=merchant_id, mode=mode)

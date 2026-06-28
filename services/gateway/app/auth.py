import re
from dataclasses import dataclass
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer()

_KEY_FORMAT = re.compile(r"^sk_(live|test)_[A-Za-z0-9_-]{8,}$")


@dataclass(frozen=True)
class ApiKeyRecord:
    merchant_id: str
    mode: str


MOCK_KEYS = {
    "sk_test_mockmerchanta": ApiKeyRecord("merchant_a", "test"),
    "sk_live_mockmerchantb": ApiKeyRecord("merchant_b", "live"),
}


async def get_current_merchant(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ApiKeyRecord:
    token = credentials.credentials

    if not _KEY_FORMAT.match(token):
        raise HTTPException(status_code=401, detail="Malformed API Key")

    # Check mock keys first (for local dev without DB)
    record = MOCK_KEYS.get(token)
    if record is not None:
        return record

    # Check real keys from database
    try:
        pool = request.app.state.db_pool if hasattr(request.app.state, "db_pool") else None
        if pool is not None:
            import hashlib
            key_hash = hashlib.sha256(token.encode()).hexdigest()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT merchant_id, type FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL",
                    key_hash,
                )
                if row is not None:
                    return ApiKeyRecord(merchant_id=row["merchant_id"], mode=row["type"])
    except Exception:
        pass  # DB unavailable — allow requests for local dev

    raise HTTPException(status_code=401, detail="Unknown or revoked API key")

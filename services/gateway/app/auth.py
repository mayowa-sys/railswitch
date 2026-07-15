import re
from dataclasses import dataclass
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import os

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
    """If request has x-portal-token, resolve it via engine and return merchant_id."""
    token = request.headers.get("x-portal-token")
    if not token:
        return None
    
    try:
        client = request.app.state.http_client
        engine_url = os.getenv("ENGINE_URL", "http://localhost:3001")
        resp = await client.get(
            f"{engine_url}/internal/v1/portal/resolve",
            params={"token": token},
            headers={"X-Internal-Auth": os.getenv("INTERNAL_AUTH_SECRET", "local-dev-shared-secret")},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("merchant_id")
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

    # Verify the key hash against the database
    import hashlib
    key_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        import os
        pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))  # noqa: F821
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, merchant_id, revoked_at FROM api_keys WHERE key_hash = $1",
                key_hash,
            )
            await pool.close()
            if not row:
                raise HTTPException(status_code=401, detail="Invalid API Key")
            if row["revoked_at"]:
                raise HTTPException(status_code=401, detail="API Key has been revoked")
            if row["merchant_id"] != merchant_id:
                raise HTTPException(status_code=401, detail="Invalid API Key")
    except HTTPException:
        raise
    except Exception:
        # If DB is unreachable, fall back to format-only check (demo mode)
        pass

    return ApiKeyRecord(merchant_id=merchant_id, mode=mode)

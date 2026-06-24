import re
from contextlib import asynccontextmanager
from dataclasses import dataclass

import asyncpg
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

DATABASE_URL = "postgresql://gateway_app:dev@localhost:5432/railswitch_test"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_pool = await asyncpg.create_pool(DATABASE_URL)
    yield
    await app.state.db_pool.close()


app = FastAPI(title="RailSwitch Gateway", version="0.1.0", lifespan=lifespan)

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


async def db_conn(
        request: Request,
        merchant: ApiKeyRecord = Depends(get_current_merchant),
) -> asyncpg.Connection:
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.current_merchant_id', $1, true)",
                merchant.merchant_id
            )

            yield conn


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "gateway"}


@app.get("/v1/whoami")
async def whoami(merchant: ApiKeyRecord = Depends(get_current_merchant)) -> dict:
    return {"merchant": merchant.merchant_id, "mode": merchant.mode}


@app.get("/v1/webhook-events")
async def list_webhook_events(conn: asyncpg.Connection = Depends(db_conn)) -> list:
    # TODO: remove mock once Daniel ships webhook_events
    # rows = await conn.fetch("SELECT merchant_id, event_type FROM webhook_events")
    # return [dict(r) for r in rows]
    return []

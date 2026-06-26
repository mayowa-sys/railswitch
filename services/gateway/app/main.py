from contextlib import asynccontextmanager

import asyncpg
import httpx
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.auth import ApiKeyRecord, get_current_merchant
from typing_extensions import Any

from app.engine_client import (
    CreateSubscriptionRequest,
    EngineClient,
    get_engine_client,
)

from app.db import db_conn
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_pool = await asyncpg.create_pool(settings.DATABASE_URL)
    app.state.http_client = httpx.AsyncClient(
        base_url=settings.engine_url, timeout=10.0
    )
    yield
    await app.state.db_pool.close()
    await app.state.http_client.aclose()


app = FastAPI(title="RailSwitch Gateway", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3100",
    ],  # Include production urls after deployment
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "gateway"}


@app.get("/v1/whoami")
async def whoami(merchant: ApiKeyRecord = Depends(get_current_merchant)) -> dict:
    return {"merchant_id": merchant.merchant_id, "mode": merchant.mode}


@app.get("/v1/webhook-events")
async def list_webhook_events(conn: asyncpg.Connection = Depends(db_conn)) -> list:
    # TODO: remove mock once Daniel ships webhook_events
    # rows = await conn.fetch("SELECT merchant_id, event_type FROM webhook_events")
    # return [dict(r) for r in rows]
    return []


@app.post("/v1/subscriptions")
async def create_subscription(
    payload: CreateSubscriptionRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> dict[str, Any]:
    sub = await engine.create_subscriptions(payload)
    return {"data": sub.model_dump(), "error": None, "meta": None}
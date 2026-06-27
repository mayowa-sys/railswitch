from contextlib import asynccontextmanager

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

from app.config import settings
from app.routes.webhooks import router as webhooks_router

from app.envelope import register_envelope_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(
        base_url=settings.engine_url, timeout=10.0
    )
    yield
    await app.state.http_client.aclose()


app = FastAPI(title="RailSwitch Gateway", version="0.1.0", lifespan=lifespan)
register_envelope_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3100",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "gateway"}


@app.get("/v1/whoami")
async def whoami(merchant: ApiKeyRecord = Depends(get_current_merchant)) -> dict:
    return {"merchant": merchant.merchant_id, "mode": merchant.mode}


@app.get("/v1/webhook-events")
async def list_webhook_events() -> list:
    return []


@app.post("/v1/subscriptions")
async def create_subscription(
    payload: CreateSubscriptionRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> dict[str, Any]:
    sub = await engine.create_subscription(payload)
    return {"data": sub.model_dump(), "error": None, "meta": None}


app.include_router(webhooks_router)

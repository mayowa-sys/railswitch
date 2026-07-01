from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from app.auth import ApiKeyRecord, get_current_merchant


from app.config import settings
from app.routes.webhooks import router as webhooks_router

from app.envelope import register_envelope_handlers

from app.routes import (
    audit,
    plans,
    customers,
    invoices,
    subscriptions,
    auth,
    webhook_management,
    payment_methods,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import datetime
    app.state.started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
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


@app.get("/status")
async def status(request: Request) -> dict:
    return {
        "status": "ok",
        "service": "gateway",
        "started_at": getattr(request.app.state, "started_at", None),
    }


@app.get("/v1/whoami")
async def whoami(merchant: ApiKeyRecord = Depends(get_current_merchant)) -> dict:
    return {"merchant": merchant.merchant_id, "mode": merchant.mode}


app.include_router(webhooks_router)
app.include_router(auth.router)
app.include_router(plans.router)
app.include_router(customers.router)
app.include_router(subscriptions.router)
app.include_router(invoices.router)
app.include_router(webhook_management.router)
app.include_router(audit.router)
app.include_router(payment_methods.router)

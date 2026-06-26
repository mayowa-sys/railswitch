from datetime import datetime

import httpx
from pydantic import BaseModel
from typing_extensions import Any
from decouple import config

from fastapi import Request, Depends, Header

from app.auth import ApiKeyRecord, get_current_merchant


class CreateSubscriptionRequest(BaseModel):
    customer_id: str
    plan_id: str
    start_date: datetime
    trial_end: datetime | None = None
    metadata: dict[str, Any] = {}


class SubscriptionResponse(BaseModel):
    id: str
    merchant_id: str
    customer_id: str
    plan_id: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    trial_end: str | None = None
    cancel_at_period_end: bool
    metadata: dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime


class EngineClient:
    def __init__(
        self, client: httpx.AsyncClient, merchant_id: str, idempotency_key: str | None
    ):
        self._client = client
        self._merchant_id = merchant_id
        self._idempotency_key = idempotency_key

    def _headers(self) -> dict[str, str]:
        headers = {
            "X-Internal-Auth": config("INTERNAL_AUTH_SECRET", cast=str),
            "X-Merchant-id": self._merchant_id,
        }
        if self._idempotency_key:
            headers["Idempotency-Key"] = self._idempotency_key
        return headers

    async def create_subscriptions(
        self, payload: CreateSubscriptionRequest
    ) -> SubscriptionResponse:
        resp = await self._client.post(
            "/internal/v1/subscriptions",
            json=payload.model_dump(),
            headers=self._headers(),
        )
        resp.raise_for_status()
        return SubscriptionResponse.model_validate(resp.json())


async def get_engine_client(
    request: Request,
    merchant: ApiKeyRecord = Depends(get_current_merchant),
    idempotency_key: str | None = Header(default=None),
) -> EngineClient:
    return EngineClient(
        client=request.app.state.http_client,
        merchant_id=merchant.merchant_id,
        idempotency_key=idempotency_key,
    )

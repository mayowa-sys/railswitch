from fastapi import APIRouter, Depends, Query

from services.gateway.app.engine_client import (
    CreateSubscriptionRequest,
    EngineClient,
    get_engine_client,
)
from services.gateway.app.envelope import Envelope

router = APIRouter(prefix="/v1/subscriptions", tags=["subscriptions"])


@router.post("")
async def create_subscription(
    payload: CreateSubscriptionRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    subscription = await engine.create_subscription(payload)
    return Envelope(data=subscription.model_dump())


@router.get("")
async def list_subscriptions(
    starting_after: str | None = Query(default=None),
    ending_before: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    subscriptions, has_more = await engine.list_subscriptions(
        starting_after, ending_before, limit
    )
    return Envelope(
        data=[s.model_dump() for s in subscriptions], meta={"has_more": has_more}
    )


@router.get("/{subscription_id}")
async def get_subscriptions(
    subscription_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    subscription = await engine.get_subscription(subscription_id)
    return Envelope(data=subscription.model_dump())


@router.post("/{subscription_id}/pause")
async def pause_sub(
    subscription_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    sub = await engine.pause_subscription(subscription_id)
    return Envelope(data=sub.model_dump())


@router.post("/{subscription_id}/resume")
async def resume_sub(
    subscription_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    sub = await engine.resume_subscription(subscription_id)
    return Envelope(data=sub.model_dump())


@router.post("/subscription_id}/cancel")
async def cancel_sub(
    subscription_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    sub = await engine.cancel_subscription(subscription_id)
    return Envelope(data=sub.model_dump())

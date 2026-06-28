from fastapi import APIRouter, Depends

from pydantic import BaseModel

from app.engine_client import EngineClient, get_engine_client
from app.envelope import Envelope

router = APIRouter(prefix="/v1/webhooks", tags=["webhooks"])


class CreateEndpointRequest(BaseModel):
    url: str


@router.post("/endpoints")
async def create_endpoint(
    payload: CreateEndpointRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    endpoint = await engine.create_webhook_endpoint(payload.model_dump())
    return Envelope(data=endpoint)


@router.get("/endpoints")
async def list_endpoints(
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    endpoints = await engine.list_webhook_endpoints()
    return Envelope(data=endpoints)


@router.delete("/endpoints/{endpoint_id}")
async def delete_endpoint(
    endpoint_id: str,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    result = await engine.delete_webhook_endpoint(endpoint_id)
    return Envelope(data=result)


@router.get("/events")
async def list_events(
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    events = await engine.list_webhook_events()
    return Envelope(data=events)


@router.get("/deliveries")
async def list_deliveries(
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    deliveries = await engine.list_webhook_deliveries()
    return Envelope(data=deliveries)


@router.post("/deliveries/{delivery_id}/replay")
async def replay_delivery(
    delivery_id: str,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    result = await engine.replay_webhook_delivery(delivery_id)
    return Envelope(data=result)

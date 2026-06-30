from fastapi import APIRouter, Depends, Query

from app.engine_client import (
    CreatePaymentMethodRequest,
    EngineClient,
    get_engine_client,
)
from app.envelope import Envelope

router = APIRouter(prefix="/v1/payment-methods", tags=["payment-methods"])


@router.post("")
async def create_payment_method(
    payload: CreatePaymentMethodRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    pm = await engine.create_payment_method(payload)
    return Envelope(data=pm.model_dump())


@router.get("")
async def list_payment_methods(
    customer_id: str | None = Query(default=None),
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    methods = await engine.list_payment_methods(customer_id)
    return Envelope(data=[m.model_dump() for m in methods])


@router.get("/{pm_id}")
async def get_payment_method(
    pm_id: str,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    pm = await engine.get_payment_method(pm_id)
    return Envelope(data=pm.model_dump())


@router.delete("/{pm_id}")
async def delete_payment_method(
    pm_id: str,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    result = await engine.delete_payment_method(pm_id)
    return Envelope(data=result)

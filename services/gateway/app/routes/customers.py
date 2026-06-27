from fastapi import Depends, Query, APIRouter

from app.engine_client import (
    CreateCustomerRequest,
    EngineClient,
    get_engine_client,
)
from app.envelope import Envelope

router = APIRouter(prefix="/v1/customers", tags=["customers"])


@router.post("")
async def create_customer(
    payload: CreateCustomerRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    customer = await engine.create_customer(payload)
    return Envelope(data=customer.model_dump())


@router.get("/{customer_id}")
async def get_customer(
    customer_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    customer = await engine.get_customer(customer_id)
    return Envelope(data=customer.model_dump())

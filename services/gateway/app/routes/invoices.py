from fastapi import APIRouter, Depends, Query

from app.engine_client import (
    EngineClient,
    get_engine_client,
)
from app.envelope import Envelope

router = APIRouter(prefix="/v1/invoice", tags=["invoices"])


@router.get("")
async def list_invoices(
    starting_after: str | None = Query(default=None),
    ending_before: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    invoices, has_more = await engine.list_invoices(
        starting_after, ending_before, limit
    )
    return Envelope(data=[i.model_dump() for i in invoices], meta={"has_more": has_more})


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    invoice = await engine.get_invoice(invoice_id)
    return Envelope(data=invoice.model_dump())


@router.post("/{invoice_id/retry")
async def retry_invoice(
    invoice_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    invoice = await engine.retry_invoice(invoice_id)
    return Envelope(data=invoice.model_dump())


@router.post("/{invoice_id}/refund")
async def refund_invoice(
    invoice_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    invoice = await engine.refund_invoice(invoice_id)
    return Envelope(data=invoice.model_dump())

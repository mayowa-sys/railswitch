from fastapi import APIRouter, Depends, Query

from app.engine_client import EngineClient, get_engine_client
from app.envelope import Envelope

router = APIRouter(prefix="/v1/audit-logs", tags=["audit-logs"])


@router.get("")
async def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    entries = await engine.list_audit_logs(limit)
    return Envelope(data=entries)


@router.get("/subscription/{subscription_id}")
async def get_subscription_audit_logs(
    subscription_id: str,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    entries = await engine.get_subscription_audit_logs(subscription_id)
    return Envelope(data=entries)

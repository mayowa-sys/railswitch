from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.engine_client import EngineClient, get_engine_client
from app.envelope import Envelope

router = APIRouter(prefix="/v1/cleanup", tags=["cleanup"])

class CleanupRequest(BaseModel):
    customer_id: str
    plan_id: str
    subscription_id: str

@router.post("/playground")
async def cleanup_playground(
    payload: CleanupRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    result = await engine.cleanup_playground(payload.model_dump())
    return Envelope(data=result)

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.engine_client import EngineClient, get_engine_client
from app.envelope import Envelope


router = APIRouter(prefix="/v1/ai", tags=["ai"])


class DunningPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    channel: str
    stage: str
    customerName: str = "Customer"
    planName: str = "your subscription"
    amountNaira: float = 0


class RetryRecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    retryCount: int = 0
    amountNaira: float = 0


@router.post("/dunning-preview")
async def dunning_preview(
    payload: DunningPreviewRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    body: dict[str, Any] = payload.model_dump(exclude_none=True)
    resp = await engine.dunning_preview(body)
    return Envelope(data=resp.get("data", resp))


@router.post("/retry-recommendation")
async def retry_recommendation(
    payload: RetryRecommendationRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    body: dict[str, Any] = payload.model_dump(exclude_none=True)
    resp = await engine.retry_recommendation(body)
    return Envelope(data=resp.get("data", resp))


@router.get("/churn/{subscription_id}")
async def churn_score(
    subscription_id: str,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    resp = await engine.churn_score(subscription_id)
    return Envelope(data=resp.get("data", resp))


@router.get("/churn")
async def list_churn_scores(
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    resp = await engine.list_churn_scores()
    return Envelope(data=resp.get("data", []), meta={"total": resp.get("total", 0)})

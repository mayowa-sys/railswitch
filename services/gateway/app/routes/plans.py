from fastapi import APIRouter, Depends, Query

from app.envelope import Envelope
from app.engine_client import (
    CreatePlanRequest,
    EngineClient,
    get_engine_client,
    UpdatePlanRequest,
)

router = APIRouter(prefix="/v1/plans", tags=["plans"])


@router.post("")
async def create_plan(
    payload: CreatePlanRequest, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    plan = await engine.create_plan(payload)
    return Envelope(data=plan.model_dump())


@router.get("")
async def list_plan(
    starting_after: str | None = Query(default=None),
    ending_before: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    plans, has_more = await engine.list_plans(starting_after, ending_before, limit)
    return Envelope(data=[p.model_dump() for p in plans], meta={"has_more": has_more})


@router.get("/{plan_id}")
async def get_plan(
    plan_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    plan = await engine.get_plan(plan_id)
    return Envelope(data=plan.model_dump())


@router.patch("/{plan_id}")
async def update_plan(
    plan_id: str,
    payload: UpdatePlanRequest,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    plan = await engine.update_plan(plan_id, payload)
    return Envelope(data=plan.model_dump())


@router.delete("/{plan_id}")
async def delete_plan(
    plan_id: str, engine: EngineClient = Depends(get_engine_client)
) -> Envelope:
    await engine.delete_plan(plan_id)
    return Envelope(data={"id": plan_id, "is_deleted": True})

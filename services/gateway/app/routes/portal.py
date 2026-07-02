from fastapi import APIRouter, Depends, Request
from app.engine_client import EngineClient, get_engine_client, get_engine_client_no_auth
from app.envelope import Envelope

router = APIRouter(prefix="/v1/portal", tags=["portal"])

@router.post("/customers/{customer_id}/link")
async def create_portal_link(
    customer_id: str,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    result = await engine.create_portal_link(customer_id)
    return Envelope(data=result)

@router.get("/resolve")
async def resolve_portal_token(
    request: Request,
    engine: EngineClient = Depends(get_engine_client_no_auth),
) -> Envelope:
    token = request.headers.get("x-portal-token") or request.query_params.get("token")
    result = await engine.resolve_portal_token(token or "")
    return Envelope(data=result)

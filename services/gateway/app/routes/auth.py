from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel

from app.engine_client import EngineClient, get_engine_client_no_auth, get_engine_client
from app.envelope import Envelope

router = APIRouter(prefix="/v1/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    company: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
@limiter.limit("5/15minutes")
async def register(
    request: Request,
    payload: RegisterRequest,
    engine: EngineClient = Depends(get_engine_client_no_auth),
) -> Envelope:
    result = await engine.register(payload.model_dump())
    return Envelope(data=result)


@router.post("/login")
@limiter.limit("10/15minutes")
async def login(
    request: Request,
    payload: LoginRequest,
    engine: EngineClient = Depends(get_engine_client_no_auth),
) -> Envelope:
    result = await engine.login(payload.model_dump())
    return Envelope(data=result)


class CreateKeyRequest(BaseModel):
    mode: str = "test"


@router.get("/keys")
async def list_keys(
    request: Request,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    result = await engine.list_api_keys()
    return Envelope(data=result.get("data", result))


@router.post("/keys")
async def create_key(
    request: Request,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    body = await request.json()
    result = await engine.create_api_key(body)
    return Envelope(data=result.get("data", result))


@router.delete("/keys/{key_id}")
async def revoke_key(
    key_id: str,
    engine: EngineClient = Depends(get_engine_client),
) -> Envelope:
    result = await engine.revoke_api_key(key_id)
    return Envelope(data=result.get("data", result))

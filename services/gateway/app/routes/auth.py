from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel

from app.engine_client import EngineClient, get_engine_client_no_auth
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

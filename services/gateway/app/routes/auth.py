from fastapi import APIRouter, Depends

from pydantic import BaseModel

from app.engine_client import EngineClient, get_engine_client_no_auth
from app.envelope import Envelope

router = APIRouter(prefix="/v1/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    company: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(
    payload: RegisterRequest,
    engine: EngineClient = Depends(get_engine_client_no_auth),
) -> Envelope:
    result = await engine.register(payload.model_dump())
    return Envelope(data=result)


@router.post("/login")
async def login(
    payload: LoginRequest,
    engine: EngineClient = Depends(get_engine_client_no_auth),
) -> Envelope:
    result = await engine.login(payload.model_dump())
    return Envelope(data=result)

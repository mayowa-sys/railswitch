from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str


class Envelope(BaseModel):
    data: Any
    error: ErrorDetail | None = None
    meta: dict[str, Any] | None = None


async def handle_http_exceptions(request: Request, exc: HTTPException) -> JSONResponse:
    body = Envelope(error=ErrorDetail(code=exc.status_code, message=exc.detail))
    return JSONResponse(status_code=exc.status_code, content=body.model_dump())


async def handle_http_validation_errors(request: Request, exc: RequestValidationError) -> JSONResponse:
    body = Envelope(error=ErrorDetail(code="422", message="Validation Error"), meta={"errors": exc.errors()})
    return JSONResponse(status_code=422, content=body.model_dump())


def register_envelope_handlers(app: FastAPI):
    app.add_exception_handler(HTTPException, handle_http_exceptions)
    app.add_exception_handler(RequestValidationError, handle_http_validation_errors)

import decimal
from datetime import datetime
from http.client import HTTPException

import httpx
from pydantic import BaseModel
from typing import Any

from fastapi import Request, Depends, Header

from app.auth import ApiKeyRecord, get_current_merchant
from app.config import settings


# ====================== SUBSCRIPTIONS ==================


class CreateSubscriptionRequest(BaseModel):
    customer_id: str
    plan_id: str
    start_date: datetime
    trial_end: datetime | None = None
    metadata: dict[str, Any] = {}


class SubscriptionResponse(BaseModel):
    id: str
    merchant_id: str
    customer_id: str
    plan_id: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    trial_end: str | None = None
    cancel_at_period_end: bool
    metadata: dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime


# =================== PLANS ===========================


class CreatePlanRequest(BaseModel):
    name: str
    description: str
    amount: decimal
    currency: str
    interval: str  # "monthly" | "annual" | "custom"
    interval_count: int  # number of intervals
    metadata: dict[str, Any] | None = None


class UpdatePlanRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    amount: decimal | None = None
    currency: str | None = None
    interval: str | None = None  # "monthly" | "annual" | "custom"
    interval_count: int | None = None  # number of intervals
    metadata: dict[str, Any] | None = None


class Plan(BaseModel):
    id: str
    merchant_id: str
    name: str
    description: str
    amount: decimal
    currency: str
    interval: str
    interval_count: int
    is_active: bool
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class AllPlans(BaseModel):
    pass


# ============== INVOICES ================


class CreateInvoice(BaseModel):
    subscription_id: str
    amount: decimal
    currency: str
    description: str
    due_date: datetime
    metadata: dict[str, Any] | None = None


class Invoice(BaseModel):
    id: str
    subscription_id: str
    merchant_id: str
    amount: decimal
    currency: str
    status: str
    description: str
    due_date: datetime
    metadata: dict[str, Any]
    created_at: datetime


# ================ CUSTOMERS ==============


class CreateCustomerRequest(BaseModel):
    email: str
    name: str
    phone: str
    metadata: dict[str, Any] | None = None


class Customer(BaseModel):
    id: str
    merchant_id: str
    email: str
    name: str
    phone: str
    metadata: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class EngineClient:
    def __init__(
        self, client: httpx.AsyncClient, merchant_id: str, idempotency_key: str | None
    ):
        self._client = client
        self._merchant_id = merchant_id
        self._idempotency_key = idempotency_key

    def _headers(self) -> dict[str, str]:
        headers = {
            "X-Internal-Auth": settings.internal_auth_secret,
            "X-Merchant-Id": self._merchant_id,
        }
        if self._idempotency_key:
            headers["Idempotency-Key"] = self._idempotency_key
        return headers

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        resp = await self._client.request(
            method, path, headers=self._headers(), **kwargs
        )
        if resp.status_code >= 400:
            try:
                body = resp.json()
                detail = body.get("detail", body) if isinstance(body, dict) else body
            except ValueError:
                detail = resp.text
            raise HTTPException(status_code=resp.status_code, detail=detail)
        return resp.json()

    async def _paginated_get(
        self,
        path: str,
        starting_after: str | None,
        ending_before: str | None,
        limit: int,
    ) -> tuple[list[dict], bool]:
        params = dict[str, str | int] = {"limit": limit}
        if starting_after:
            params["starting_after"] = starting_after
        if ending_before:
            params["ending_before"] = ending_before
        body = await self._request("GET", path, params=params)
        return body["data"], body["has_more"]

    # =========== SUBSCRIPTIONS ============

    async def create_subscription(
        self, payload: CreateSubscriptionRequest
    ) -> SubscriptionResponse:
        resp = await self._request(
            "POST",
            "/internal/v1/subscriptions",
            json=payload.model_dump(),
        )
        return SubscriptionResponse.model_validate(resp)

    async def list_subscriptions(
        self, starting_after: str | None, ending_before: str | None, limit: int
    ) -> tuple[list[SubscriptionResponse], bool]:
        rows, has_more = self._paginated_get(
            "/internal/v1/subscriptions",
            starting_after=starting_after,
            ending_before=ending_before,
            limit=limit,
        )
        return [SubscriptionResponse.model_validate(r) for r in rows], has_more

    async def get_subscription(self, sub_id: str) -> SubscriptionResponse:
        resp = await self._request("GET", f"/internal/v1/subscriptions/{sub_id}")
        return SubscriptionResponse.model_validate(resp)

    async def _subscription_action(
        self, action: str, sub_id: str
    ) -> SubscriptionResponse:
        body = await self._request(
            "POST", f"/internal/v1/subscriptions/{sub_id}/{action}"
        )
        return SubscriptionResponse.model_validate(body)

    async def pause_subscription(self, sub_id: str) -> SubscriptionResponse:
        return await self._subscription_action(sub_id=sub_id, action="pause")

    async def resume_subscription(self, sub_id: str) -> SubscriptionResponse:
        return await self._subscription_action(sub_id=sub_id, action="resume")

    async def cancel_subscription(self, sub_id: str) -> SubscriptionResponse:
        return await self._subscription_action(sub_id=sub_id, action="cancel")

    # ============= PLANS ===================

    async def create_plan(self, payload: CreatePlanRequest) -> Plan:
        resp = await self._request(
            "POST", "/internal/v1/plans", json=payload.model_dump()
        )
        return Plan.model_validate(resp)

    async def list_plans(
        self, starting_after: str | None, ending_before: str | None, limit: int
    ) -> tuple[list[Plan], bool]:
        rows, has_more = await self._paginated_get(
            "internal/v1/plans",
            starting_after=starting_after,
            ending_before=ending_before,
            limit=limit,
        )
        return [Plan.model_validate(r) for r in rows], has_more

    async def get_plan(self, plan_id: str) -> Plan:
        body = await self._request("GET", f"/internal/v1/plans/{plan_id}")
        return Plan.model_validate(body)

    async def update_plan(self, plan_id: str, payload: UpdatePlanRequest) -> Plan:
        body = await self._request(
            "PATCH",
            f"/internal/v1/plans/{plan_id}",
            json=payload.model_dump(exclude_none=True),
        )
        return Plan.model_validate(body)

    async def delete_plan(self, plan_id: str) -> None:
        await self._request("DELETE", f"/internal/v1/plans/{plan_id}")

    # ================ CUSTOMERS ==================

    async def create_customer(self, payload: CreateCustomerRequest) -> Customer:
        resp = self._request(
            "POST", "/internal/v1/customers", json=payload.model_dump()
        )
        return Customer.model_validate(resp)

    async def get_customer(self, customer_id: str) -> Customer:
        resp = self._request("GET", f"/internal/v1/customers/{customer_id}")
        return Customer.model_validate(resp)

    # =========== INVOICES ==================

    async def list_invoices(
        self, starting_after: str, ending_before: str, limit: int
    ) -> tuple[list[Invoice], bool]:
        rows, has_more = await self._paginated_get(
            "/internal/v1/invoices",
            starting_after=starting_after,
            ending_before=ending_before,
            limit=limit,
        )
        return [Invoice.model_validate(r) for r in rows], has_more

    async def get_invoice(self, invoice_id: str) -> Invoice:
        resp = await self._request("GET", f"/internal/v1/invoices/{invoice_id}")
        return Invoice.model_validate(resp)

    async def _invoice_action(self, invoice_id: str, action: str) -> Invoice:
        resp = await self._request(
            "POST", f"/internal/v1/invoices/{invoice_id}/{action}"
        )
        return Invoice.model_validate(resp)

    async def retry_invoice(self, invoice_id: str):
        return await self._invoice_action(invoice_id, "retry")

    async def refund_invoice(self, invoice_id):
        return await self._invoice_action(invoice_id, "refund")


async def get_engine_client(
    request: Request,
    merchant: ApiKeyRecord = Depends(get_current_merchant),
    idempotency_key: str | None = Header(default=None),
) -> EngineClient:
    return EngineClient(
        client=request.app.state.http_client,
        merchant_id=merchant.merchant_id,
        idempotency_key=idempotency_key,
    )

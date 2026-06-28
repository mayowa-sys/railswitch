from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any
import json

import httpx


@dataclass
class Plan:
    id: str
    name: str
    amount: int
    currency: str
    interval: str
    interval_count: int
    is_active: bool
    created_at: str
    updated_at: str
    description: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Customer:
    id: str
    name: str
    email: str
    created_at: str
    updated_at: str
    phone: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Subscription:
    id: str
    customer_id: str
    plan_id: str
    status: str
    current_period_start: str
    current_period_end: str
    cancel_at_period_end: bool
    created_at: str
    updated_at: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Invoice:
    id: str
    subscription_id: str
    amount: int
    currency: str
    status: str
    due_date: str
    created_at: str
    description: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class RailSwitchError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(message)


class RailSwitch:
    def __init__(self, api_key: str, base_url: str = "https://railswitch-gateway.fly.dev"):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=30.0)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        res = self._client.request(method, f"{self._base_url}{path}", headers=self._headers(), **kwargs)
        if res.status_code >= 400:
            try:
                body = res.json()
                msg = body.get("error", {}).get("message", res.text)
            except Exception:
                msg = res.text
            raise RailSwitchError(res.status_code, msg)
        body = res.json()
        return body.get("data", body)

    @property
    def plans(self) -> PlansClient:
        return PlansClient(self)

    @property
    def customers(self) -> CustomersClient:
        return CustomersClient(self)

    @property
    def subscriptions(self) -> SubscriptionsClient:
        return SubscriptionsClient(self)

    @property
    def invoices(self) -> InvoicesClient:
        return InvoicesClient(self)


class PlansClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def create(self, name: str, amount: int, interval: str, **kwargs) -> Plan:
        body = {"name": name, "amount": amount, "interval": interval, **kwargs}
        return Plan(**self._c._request("POST", "/v1/plans", json=body))

    def list(self) -> list[Plan]:
        data = self._c._request("GET", "/v1/plans")
        return [Plan(**p) for p in (data if isinstance(data, list) else [])]

    def get(self, plan_id: str) -> Plan:
        return Plan(**self._c._request("GET", f"/v1/plans/{plan_id}"))

    def update(self, plan_id: str, **kwargs) -> Plan:
        return Plan(**self._c._request("PATCH", f"/v1/plans/{plan_id}", json=kwargs))


class CustomersClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def create(self, email: str, name: str, **kwargs) -> Customer:
        body = {"email": email, "name": name, **kwargs}
        return Customer(**self._c._request("POST", "/v1/customers", json=body))

    def get(self, customer_id: str) -> Customer:
        return Customer(**self._c._request("GET", f"/v1/customers/{customer_id}"))


class SubscriptionsClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def create(self, customer_id: str, plan_id: str, **kwargs) -> Subscription:
        body = {"customer_id": customer_id, "plan_id": plan_id, **kwargs}
        return Subscription(**self._c._request("POST", "/v1/subscriptions", json=body))

    def list(self) -> list[Subscription]:
        data = self._c._request("GET", "/v1/subscriptions")
        return [Subscription(**s) for s in (data if isinstance(data, list) else [])]

    def get(self, sub_id: str) -> Subscription:
        return Subscription(**self._c._request("GET", f"/v1/subscriptions/{sub_id}"))

    def update(self, sub_id: str, **kwargs) -> Subscription:
        return Subscription(**self._c._request("PATCH", f"/v1/subscriptions/{sub_id}", json=kwargs))

    def pause(self, sub_id: str) -> Subscription:
        return Subscription(**self._c._request("POST", f"/v1/subscriptions/{sub_id}/pause"))

    def resume(self, sub_id: str) -> Subscription:
        return Subscription(**self._c._request("POST", f"/v1/subscriptions/{sub_id}/resume"))

    def cancel(self, sub_id: str) -> Subscription:
        return Subscription(**self._c._request("POST", f"/v1/subscriptions/{sub_id}/cancel"))

    def preview(self, sub_id: str, new_plan_id: str) -> dict:
        return self._c._request("POST", f"/v1/subscriptions/{sub_id}/preview", json={"plan": new_plan_id})


class InvoicesClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def list(self) -> list[Invoice]:
        data = self._c._request("GET", "/v1/invoices")
        return [Invoice(**i) for i in (data if isinstance(data, list) else [])]

    def get(self, invoice_id: str) -> Invoice:
        return Invoice(**self._c._request("GET", f"/v1/invoices/{invoice_id}"))

    def retry(self, invoice_id: str) -> Invoice:
        return Invoice(**self._c._request("POST", f"/v1/invoices/{invoice_id}/retry"))

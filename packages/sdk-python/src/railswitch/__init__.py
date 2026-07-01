from __future__ import annotations

from dataclasses import dataclass, field, fields
from typing import Any
import json

import httpx


def _safe_init(cls: type, data: dict[str, Any]) -> Any:
    """Construct a dataclass from a dict, ignoring unknown keys."""
    valid_keys = {f.name for f in fields(cls)}
    filtered = {k: v for k, v in data.items() if k in valid_keys}
    return cls(**filtered)


@dataclass
class Plan:
    id: str
    merchant_id: str
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
    merchant_id: str
    name: str
    email: str
    created_at: str
    updated_at: str
    phone: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Subscription:
    id: str
    merchant_id: str
    customer_id: str
    plan_id: str
    state: str
    current_period_start: str
    current_period_end: str
    cancel_at_period_end: bool
    created_at: str
    updated_at: str
    trial_ends_at: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Invoice:
    id: str
    merchant_id: str
    subscription_id: str
    amount: int
    currency: str
    status: str
    due_date: str
    created_at: str
    description: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PaymentMethod:
    id: str
    merchant_id: str
    customer_id: str
    type: str
    nomba_token: str
    is_default: bool
    created_at: str
    last4: str | None = None
    brand: str | None = None
    exp_month: str | None = None
    exp_year: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class WebhookEndpoint:
    id: str
    merchant_id: str
    url: str
    status: str
    created_at: str
    secret: str | None = None
    last_delivery_at: str | None = None

    def __post_init__(self):
        # Strip secret from repr/display
        pass


class RailSwitchError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(message)


class RailSwitch:
    def __init__(self, api_key: str, base_url: str = "https://railswitch-gateway.fly.dev"):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=30.0)

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

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

    @property
    def payment_methods(self) -> PaymentMethodsClient:
        return PaymentMethodsClient(self)

    @property
    def webhooks(self) -> WebhooksClient:
        return WebhooksClient(self)


class PlansClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def create(self, name: str, description: str, amount: int, interval: str, **kwargs) -> Plan:
        body = {"name": name, "description": description, "amount": amount, "interval": interval, **kwargs}
        return _safe_init(Plan, self._c._request("POST", "/v1/plans", json=body))

    def list(self) -> list[Plan]:
        data = self._c._request("GET", "/v1/plans")
        return [_safe_init(Plan, p) for p in (data if isinstance(data, list) else [])]

    def get(self, plan_id: str) -> Plan:
        return _safe_init(Plan, self._c._request("GET", f"/v1/plans/{plan_id}"))

    def update(self, plan_id: str, **kwargs) -> Plan:
        return _safe_init(Plan, self._c._request("PATCH", f"/v1/plans/{plan_id}", json=kwargs))

    def delete(self, plan_id: str) -> dict:
        return self._c._request("DELETE", f"/v1/plans/{plan_id}")


class CustomersClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def create(self, email: str, name: str, **kwargs) -> Customer:
        body = {"email": email, "name": name, **kwargs}
        return _safe_init(Customer, self._c._request("POST", "/v1/customers", json=body))

    def list(self) -> list[Customer]:
        data = self._c._request("GET", "/v1/customers")
        return [_safe_init(Customer, c) for c in (data if isinstance(data, list) else [])]

    def get(self, customer_id: str) -> Customer:
        return _safe_init(Customer, self._c._request("GET", f"/v1/customers/{customer_id}"))


class SubscriptionsClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def create(self, customer_id: str, plan_id: str, **kwargs) -> Subscription:
        body = {"customer_id": customer_id, "plan_id": plan_id, **kwargs}
        return _safe_init(Subscription, self._c._request("POST", "/v1/subscriptions", json=body))

    def list(self) -> list[Subscription]:
        data = self._c._request("GET", "/v1/subscriptions")
        return [_safe_init(Subscription, s) for s in (data if isinstance(data, list) else [])]

    def get(self, sub_id: str) -> Subscription:
        return _safe_init(Subscription, self._c._request("GET", f"/v1/subscriptions/{sub_id}"))

    def update(self, sub_id: str, **kwargs) -> Subscription:
        return _safe_init(Subscription, self._c._request("PATCH", f"/v1/subscriptions/{sub_id}", json=kwargs))

    def pause(self, sub_id: str) -> dict:
        return self._c._request("POST", f"/v1/subscriptions/{sub_id}/pause")

    def resume(self, sub_id: str) -> dict:
        return self._c._request("POST", f"/v1/subscriptions/{sub_id}/resume")

    def cancel(self, sub_id: str, reason: str | None = None) -> dict:
        body = {"reason": reason} if reason else {}
        return self._c._request("POST", f"/v1/subscriptions/{sub_id}/cancel", json=body)

    def preview(self, sub_id: str, new_plan_id: str) -> dict:
        return self._c._request("POST", f"/v1/subscriptions/{sub_id}/preview", json={"new_plan_id": new_plan_id})


class InvoicesClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def list(self) -> list[Invoice]:
        data = self._c._request("GET", "/v1/invoices")
        return [_safe_init(Invoice, i) for i in (data if isinstance(data, list) else [])]

    def get(self, invoice_id: str) -> Invoice:
        return _safe_init(Invoice, self._c._request("GET", f"/v1/invoices/{invoice_id}"))

    def retry(self, invoice_id: str) -> Invoice:
        return _safe_init(Invoice, self._c._request("POST", f"/v1/invoices/{invoice_id}/retry"))


class PaymentMethodsClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def create(self, customer_id: str, type: str, nomba_token: str, **kwargs) -> PaymentMethod:
        body = {"customer_id": customer_id, "type": type, "nomba_token": nomba_token, **kwargs}
        return _safe_init(PaymentMethod, self._c._request("POST", "/v1/payment-methods", json=body))

    def list(self, customer_id: str | None = None) -> list[PaymentMethod]:
        path = f"/v1/payment-methods?customer_id={customer_id}" if customer_id else "/v1/payment-methods"
        data = self._c._request("GET", path)
        return [_safe_init(PaymentMethod, pm) for pm in (data if isinstance(data, list) else [])]

    def get(self, pm_id: str) -> PaymentMethod:
        return _safe_init(PaymentMethod, self._c._request("GET", f"/v1/payment-methods/{pm_id}"))

    def delete(self, pm_id: str) -> dict:
        return self._c._request("DELETE", f"/v1/payment-methods/{pm_id}")


class WebhooksClient:
    def __init__(self, client: RailSwitch):
        self._c = client

    def create_endpoint(self, url: str) -> WebhookEndpoint:
        return _safe_init(WebhookEndpoint, self._c._request("POST", "/v1/webhooks/endpoints", json={"url": url}))

    def list_endpoints(self) -> list[WebhookEndpoint]:
        data = self._c._request("GET", "/v1/webhooks/endpoints")
        return [_safe_init(WebhookEndpoint, ep) for ep in (data if isinstance(data, list) else [])]

    def get_endpoint(self, endpoint_id: str) -> WebhookEndpoint:
        return _safe_init(WebhookEndpoint, self._c._request("GET", f"/v1/webhooks/endpoints/{endpoint_id}"))

    def update_endpoint(self, endpoint_id: str, url: str) -> WebhookEndpoint:
        return _safe_init(WebhookEndpoint, self._c._request("PATCH", f"/v1/webhooks/endpoints/{endpoint_id}", json={"url": url}))

    def delete_endpoint(self, endpoint_id: str) -> dict:
        return self._c._request("DELETE", f"/v1/webhooks/endpoints/{endpoint_id}")

    def list_events(self) -> list[dict]:
        data = self._c._request("GET", "/v1/webhooks/events")
        return data if isinstance(data, list) else []

    def list_deliveries(self) -> list[dict]:
        data = self._c._request("GET", "/v1/webhooks/deliveries")
        return data if isinstance(data, list) else []

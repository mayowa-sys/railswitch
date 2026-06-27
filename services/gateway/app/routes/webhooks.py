import os
import hmac
import hashlib
import base64
import json
import uuid
import logging
from typing import Any

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
import httpx

logger = logging.getLogger("railswitch.gateway.webhooks")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_signature(
    payload: bytes,
    expected_signature: str,
    timestamp: str,
    secret: str,
) -> bool:
    """Verify Nomba HMAC-SHA256 signature.

    Nomba's signing string is nine colon-delimited fields:
      event_type:requestId:userId:walletId:transactionId:type:time:responseCode:timestamp

    Fields absent from the payload default to "".
    """
    body: dict[str, Any] = json.loads(payload)
    data = body.get("data", {}) or {}
    merchant = data.get("merchant", {}) or {}
    transaction = data.get("transaction", {}) or {}

    event_type = body.get("event_type", "")
    request_id = body.get("requestId", "")
    user_id = merchant.get("userId", "")
    wallet_id = merchant.get("walletId", "")
    transaction_id = transaction.get("transactionId", "")
    transaction_type = transaction.get("type", "")
    transaction_time = transaction.get("time", "")
    response_code = transaction.get("responseCode", "")

    if response_code == "null":
        response_code = ""

    hashing_payload = ":".join(
        (
            event_type,
            request_id,
            user_id,
            wallet_id,
            transaction_id,
            transaction_type,
            transaction_time,
            response_code,
            timestamp,
        )
    )

    digest = hmac.new(
        secret.encode(),
        hashing_payload.encode(),
        hashlib.sha256,
    ).digest()
    computed = base64.b64encode(digest).decode()

    return hmac.compare_digest(computed, expected_signature)


async def _forward_to_engine(payload: bytes, request_id: str) -> None:
    """Forward a verified webhook payload to the engine."""
    engine_url = os.getenv(
        "ENGINE_INTERNAL_URL", os.getenv("ENGINE_URL", "http://localhost:3001")
    )
    internal_secret = os.getenv(
        "ENGINE_INTERNAL_SECRET", os.getenv("INTERNAL_AUTH_SECRET", "")
    )

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{engine_url}/internal/v1/webhooks/nomba",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Internal-Auth": internal_secret,
                    "X-Request-Id": request_id,
                },
            )
            if resp.status_code >= 400:
                logger.error(
                    "engine rejected webhook request_id=%s status=%d body=%s",
                    request_id,
                    resp.status_code,
                    resp.text,
                )
    except httpx.RequestError as exc:
        logger.error(
            "engine unreachable for webhook request_id=%s: %s",
            request_id,
            exc,
        )


@router.post("/nomba")
async def nomba_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    """Receive a Nomba webhook, verify its signature, and forward it to the engine.

    We return 200 immediately to Nomba (preventing retries) and forward the
    payload to the engine in a background task.  If the engine is down the
    webhook is dropped — Nomba will not retry.
    """
    payload = await request.body()

    nomba_signature = request.headers.get("nomba-signature", "")
    nomba_timestamp = request.headers.get("nomba-timestamp", "")
    nomba_algorithm = request.headers.get("nomba-signature-algorithm", "")

    if not nomba_signature or not nomba_timestamp:
        raise HTTPException(
            status_code=400,
            detail="Missing Nomba webhook headers: nomba-signature and nomba-timestamp are required",
        )

    if nomba_algorithm and nomba_algorithm != "HmacSHA256":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported signature algorithm: {nomba_algorithm}",
        )

    webhook_secret = os.getenv("NOMBA_WEBHOOK_SECRET", "")
    if webhook_secret:
        if not _verify_signature(
            payload, nomba_signature, nomba_timestamp, webhook_secret
        ):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    else:
        logger.warning(
            "NOMBA_WEBHOOK_SECRET not set — accepting webhook without signature verification (dev only)",
        )

    body: dict[str, Any] = json.loads(payload)
    request_id = body.get("requestId", str(uuid.uuid4()))

    logger.info(
        "received nomba webhook event_type=%s requestId=%s",
        body.get("event_type"),
        request_id,
    )

    background_tasks.add_task(_forward_to_engine, payload, request_id)

    return {"status": "accepted"}

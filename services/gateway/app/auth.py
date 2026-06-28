import re
from dataclasses import dataclass
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer()

# Format: sk_(live|test)_<merchant_id>_<random>
_KEY_FORMAT = re.compile(r"^sk_(live|test)_([A-Za-z0-9_-]+?)_[A-Za-z0-9_-]{8,}$")


@dataclass(frozen=True)
class ApiKeyRecord:
    merchant_id: str
    mode: str


MOCK_KEYS = {
    "sk_test_mockmerchanta": ApiKeyRecord("merchant_a", "test"),
    "sk_live_mockmerchantb": ApiKeyRecord("merchant_b", "live"),
}


async def get_current_merchant(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ApiKeyRecord:
    token = credentials.credentials

    record = MOCK_KEYS.get(token)
    if record is not None:
        return record

    m = _KEY_FORMAT.match(token)
    if not m:
        raise HTTPException(status_code=401, detail="Malformed API Key")

    mode = m.group(1)
    merchant_id = m.group(2)
    return ApiKeyRecord(merchant_id=merchant_id, mode=mode)

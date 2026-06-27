import asyncpg
from fastapi import Depends, Request

from app.auth import ApiKeyRecord, get_current_merchant
from app.config import settings


async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(settings.DATABASE_URL)


async def db_conn(
    request: Request,
    merchant: ApiKeyRecord = Depends(get_current_merchant),
) -> asyncpg.connection:
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.current_merchant_id', $1, true)",
                merchant.merchant_id,
            )
            yield conn

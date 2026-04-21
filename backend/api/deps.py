from collections.abc import AsyncGenerator
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.api.config import DATABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL

_pg_kwargs = (
    {"pool_size": 5, "max_overflow": 10, "pool_pre_ping": True}
    if DATABASE_URL.startswith("postgresql")
    else {}
)
engine = create_async_engine(DATABASE_URL, echo=False, **_pg_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

bearer = HTTPBearer(auto_error=False)


@dataclass
class AuthUser:
    id: str
    email: str
    is_admin: bool = False


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> AuthUser:
    """Validate the Supabase access token by calling the Supabase Auth API."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase is not configured on the server")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {credentials.credentials}",
                "apikey": SUPABASE_ANON_KEY,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    data = resp.json()
    user_id = data["id"]
    email = data.get("email", "")

    is_admin = False
    if SUPABASE_SERVICE_KEY:
        async with httpx.AsyncClient() as client:
            profile_resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/user_profiles",
                params={"id": f"eq.{user_id}", "select": "role", "limit": "1"},
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                },
            )
        if profile_resp.status_code == 200:
            rows = profile_resp.json()
            is_admin = bool(rows) and rows[0].get("role") == "admin"

    return AuthUser(id=user_id, email=email, is_admin=is_admin)

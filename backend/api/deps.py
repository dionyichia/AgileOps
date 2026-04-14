from collections.abc import AsyncGenerator
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.api.config import DATABASE_URL, SUPABASE_ANON_KEY, SUPABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

bearer = HTTPBearer(auto_error=False)


@dataclass
class AuthUser:
    id: str
    email: str


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
    return AuthUser(id=data["id"], email=data.get("email", ""))

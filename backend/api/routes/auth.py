from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import ALGORITHM, SECRET_KEY, get_current_user, get_db
from backend.api.models.db import User
from backend.api.schemas.api import TokenOut, UserCreate, UserOut

router = APIRouter(tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__truncate_error=False)


def _hash(password: str) -> str:
    return pwd_context.hash(password)


def _verify(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _make_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/auth/register", response_model=TokenOut, status_code=201)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=body.email, hashed_password=_hash(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenOut(access_token=_make_token(user.id), token_type="bearer")


@router.post("/auth/login", response_model=TokenOut)
async def login(body: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not _verify(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return TokenOut(access_token=_make_token(user.id), token_type="bearer")


@router.get("/auth/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

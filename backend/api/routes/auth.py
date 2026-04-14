from fastapi import APIRouter, Depends

from backend.api.deps import AuthUser, get_current_user
from backend.api.schemas.api import UserOut

router = APIRouter(tags=["auth"])


@router.get("/auth/me", response_model=UserOut)
async def me(current_user: AuthUser = Depends(get_current_user)):
    """Return the identity of the currently authenticated Supabase user."""
    return UserOut(id=current_user.id, email=current_user.email)

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import AuthUser
from backend.api.models.db import Project


async def require_owned_project(
    project_id: str,
    current_user: AuthUser,
    db: AsyncSession,
) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not current_user.is_admin and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this project")

    return project

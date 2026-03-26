from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import Project, WorkflowProfile
from backend.api.schemas.api import ProfileCreate, ProfileOut

router = APIRouter(tags=["profiles"])


@router.get("/projects/{project_id}/profile", response_model=ProfileOut)
async def get_profile(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkflowProfile).where(WorkflowProfile.project_id == project_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/projects/{project_id}/profile", response_model=ProfileOut)
async def upsert_profile(
    project_id: str, body: ProfileCreate, db: AsyncSession = Depends(get_db)
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(WorkflowProfile).where(WorkflowProfile.project_id == project_id)
    )
    profile = result.scalar_one_or_none()

    if profile:
        for field, value in body.model_dump().items():
            setattr(profile, field, value)
    else:
        profile = WorkflowProfile(project_id=project_id, **body.model_dump())
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return profile

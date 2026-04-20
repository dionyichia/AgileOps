import anyio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import create_client

from backend.api.config import SITE_URL, SUPABASE_SERVICE_KEY, SUPABASE_URL
from backend.api.deps import get_db
from backend.api.models.db import Project, WorkflowProfile
from backend.api.schemas.api import ConsultationCreate

router = APIRouter(tags=["consultation"])


async def _send_supabase_invite(email: str, project_id: str) -> None:
    def _do() -> None:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        client.auth.admin.invite_user_by_email(
            email,
            options={
                "data": {"project_id": project_id},
                "redirect_to": f"{SITE_URL}/auth/callback",
            },
        )
    await anyio.to_thread.run_sync(_do)


@router.post("/consultation", status_code=201)
async def submit_consultation(
    body: ConsultationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — no auth required.
    Creates a project + profile, then sends a Supabase invite email.
    No Supabase user is created until they accept the invite.
    """
    project = Project(
        company_name=body.email.split('@')[-1],
        team_name=f"{body.first_name} {body.last_name}",
        primary_role=body.role,
        notes=body.description or None,
        owner_id=None,
    )
    db.add(project)
    await db.flush()

    profile = WorkflowProfile(
        project_id=project.id,
        role=body.role,
        selected_responsibilities=body.selected_responsibilities,
        tools=body.tools or None,
        description=body.description or None,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(project)

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print(f"[invite] Supabase not configured — project {project.id} created for {body.email}")
    else:
        await _send_supabase_invite(body.email, project.id)

    return {"project_id": project.id}

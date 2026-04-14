import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.api.config import RESEND_API_KEY, RESEND_FROM, SITE_URL
from backend.api.deps import get_db
from backend.api.models.db import PendingInvite, Project, WorkflowProfile, _now
from backend.api.schemas.api import ConsultationCreate

router = APIRouter(tags=["consultation"])


async def _send_invite_email(to_email: str, name: str, signup_url: str) -> None:
    """Send the invite link via Resend. Logs a warning if not configured."""
    if not RESEND_API_KEY:
        print(f"[invite] RESEND_API_KEY not set — signup link for {to_email}: {signup_url}")
        return

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": RESEND_FROM,
                "to": [to_email],
                "subject": "You're invited to your Axis workspace",
                "html": f"""
                <p>Hi {name},</p>
                <p>Your Axis workspace is ready. Click the button below to create your account and access your workflow analysis.</p>
                <p style="margin:32px 0">
                  <a href="{signup_url}"
                     style="background:linear-gradient(90deg,#5E149F,#F75A8C);color:#fff;padding:14px 28px;
                            border-radius:50px;text-decoration:none;font-weight:700;font-size:16px">
                    Create Account
                  </a>
                </p>
                <p style="color:#888;font-size:13px">
                  This link expires in 7 days. If you didn't request this, you can ignore this email.
                </p>
                """,
            },
        )
    if resp.status_code not in (200, 201):
        print(f"[invite] Resend error {resp.status_code}: {resp.text}")


@router.post("/consultation", status_code=201)
async def submit_consultation(
    body: ConsultationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — no auth required.
    Creates a project + profile, stores a one-time invite token, and emails
    the client a signup link. No Supabase user is created until they sign up.
    """
    # Create project (owner_id left null until signup is completed)
    project = Project(
        company_name=body.email,
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

    invite = PendingInvite(
        email=body.email,
        project_id=project.id,
        expires_at=_now() + timedelta(days=7),
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    signup_url = f"{SITE_URL}/signup?token={invite.token}"
    await _send_invite_email(body.email, body.first_name, signup_url)

    return {"project_id": project.id, "invite_token": invite.token}


@router.get("/invite/{token}")
async def validate_invite(token: str, db: AsyncSession = Depends(get_db)):
    """
    Validate a one-time invite token.
    Returns the email + project_id so the frontend can pre-fill the signup form.
    """
    result = await db.execute(
        select(PendingInvite).where(PendingInvite.token == token)
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    if invite.used_at is not None:
        raise HTTPException(status_code=410, detail="This invite link has already been used")
    # Normalise both sides to naive UTC — SQLite drops tzinfo on read-back
    expires = invite.expires_at
    if expires.tzinfo is not None:
        expires = expires.replace(tzinfo=None)
    if expires < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This invite link has expired")

    return {"email": invite.email, "project_id": invite.project_id}


@router.post("/invite/{token}/use")
async def mark_invite_used(token: str, db: AsyncSession = Depends(get_db)):
    """Mark a token as consumed after the user completes signup."""
    result = await db.execute(
        select(PendingInvite).where(PendingInvite.token == token)
    )
    invite = result.scalar_one_or_none()
    if invite and invite.used_at is None:
        invite.used_at = datetime.utcnow()
        await db.commit()
    return {"ok": True}

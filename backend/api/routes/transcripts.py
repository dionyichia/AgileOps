from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import Job, JobType, Project, Transcript
from backend.api.schemas.api import TranscriptCreate, TranscriptOut, TranscriptSubmitResult
from backend.api.services import data_io, job_runner

router = APIRouter(tags=["transcripts"])


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{project_id}/transcripts", response_model=list[TranscriptOut])
async def list_transcripts(project_id: str, db: AsyncSession = Depends(get_db)):
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(Transcript)
        .where(Transcript.project_id == project_id)
        .order_by(Transcript.created_at.desc())
    )
    return result.scalars().all()


@router.get("/projects/{project_id}/transcripts/{transcript_id}", response_model=TranscriptOut)
async def get_transcript(
    project_id: str, transcript_id: str, db: AsyncSession = Depends(get_db)
):
    transcript = await db.get(Transcript, transcript_id)
    if not transcript or transcript.project_id != project_id:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return transcript


@router.post(
    "/projects/{project_id}/transcripts",
    response_model=TranscriptSubmitResult,
    status_code=201,
)
async def submit_transcript(
    project_id: str,
    body: TranscriptCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Save a transcript and kick off an async parse job.

    Returns immediately with {transcript, job_id}.
    The frontend polls GET /api/jobs/{job_id} or connects to WS /ws/jobs/{job_id}
    to track progress.
    """
    await _get_project_or_404(project_id, db)

    # Persist the transcript row
    transcript = Transcript(
        project_id       = project_id,
        interviewee_name = body.interviewee_name,
        interviewee_role = body.interviewee_role,
        interview_date   = body.interview_date,
        raw_text         = body.raw_text,
    )
    db.add(transcript)
    await db.commit()
    await db.refresh(transcript)

    # Write raw text to disk for the script to read
    data_io.save_transcript_text(project_id, transcript.id, body.raw_text)

    # Create job row synchronously so we can return the job_id
    job = await job_runner.create_job(db, project_id, JobType.transcript_parse)

    # Dispatch background execution (non-blocking)
    background_tasks.add_task(
        job_runner.run_transcript_job,
        job.id,
        transcript.id,
        project_id,
    )

    return TranscriptSubmitResult(
        transcript=TranscriptOut.model_validate(transcript),
        job_id=job.id,
    )

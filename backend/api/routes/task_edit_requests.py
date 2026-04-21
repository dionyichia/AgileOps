from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import AuthUser, get_current_user, get_db
from backend.api.models.db import JobType, Project, TaskEditRequest
from backend.api.schemas.api import TaskEditRequestCreate, TaskEditRequestOut, TaskEditReview
from backend.api.services import data_io, job_runner

router = APIRouter(tags=["task-edit-requests"])


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_request_or_404(project_id: str, request_id: str, db: AsyncSession) -> TaskEditRequest:
    stmt: Select[tuple[TaskEditRequest]] = select(TaskEditRequest).where(
        TaskEditRequest.id == request_id,
        TaskEditRequest.project_id == project_id,
    )
    task_edit_request = (await db.execute(stmt)).scalar_one_or_none()
    if not task_edit_request:
        raise HTTPException(status_code=404, detail="Task edit request not found")
    return task_edit_request


def _apply_proposed_task(tasks: list[dict], node_id: str, proposed_task: dict) -> list[dict]:
    updated = []
    found = False
    for task in tasks:
        if task.get("node_id") != node_id:
            updated.append(task)
            continue
        updated.append(proposed_task)
        found = True
    if not found:
        raise HTTPException(status_code=404, detail="Task no longer exists in all_tasks.json")
    return updated


@router.get("/projects/{project_id}/task-edit-requests", response_model=list[TaskEditRequestOut])
async def list_task_edit_requests(
    project_id: str,
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: AuthUser = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)
    stmt: Select[tuple[TaskEditRequest]] = select(TaskEditRequest).where(TaskEditRequest.project_id == project_id)
    if status_filter:
        stmt = stmt.where(TaskEditRequest.status == status_filter)
    stmt = stmt.order_by(TaskEditRequest.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post(
    "/projects/{project_id}/task-edit-requests",
    response_model=TaskEditRequestOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_edit_request(
    project_id: str,
    body: TaskEditRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)

    if body.node_id != body.current_task.node_id or body.node_id != body.proposed_task.node_id:
        raise HTTPException(status_code=400, detail="node_id must match current_task and proposed_task")

    pending_stmt: Select[tuple[TaskEditRequest]] = select(TaskEditRequest).where(
        TaskEditRequest.project_id == project_id,
        TaskEditRequest.node_id == body.node_id,
        TaskEditRequest.status == "pending",
    )
    existing_pending = (await db.execute(pending_stmt)).scalar_one_or_none()
    if existing_pending:
        raise HTTPException(status_code=409, detail="This step already has a pending edit request")

    task_edit_request = TaskEditRequest(
        project_id=project_id,
        node_id=body.node_id,
        submitter_user_id=current_user.id,
        submitter_email=current_user.email,
        current_task=body.current_task.model_dump(),
        proposed_task=body.proposed_task.model_dump(),
    )
    db.add(task_edit_request)
    await db.commit()
    await db.refresh(task_edit_request)
    return task_edit_request


@router.post(
    "/projects/{project_id}/task-edit-requests/{request_id}/approve",
    response_model=TaskEditRequestOut,
)
async def approve_task_edit_request(
    project_id: str,
    request_id: str,
    background_tasks: BackgroundTasks,
    body: TaskEditReview | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)
    task_edit_request = await _get_request_or_404(project_id, request_id, db)
    if task_edit_request.status != "pending":
        raise HTTPException(status_code=409, detail="Only pending requests can be approved")

    tasks = await data_io.read_tasks_json(project_id)
    if not tasks:
        raise HTTPException(status_code=409, detail="No task graph exists for this project")

    updated_tasks = _apply_proposed_task(tasks, task_edit_request.node_id, task_edit_request.proposed_task)
    await data_io.write_tasks_json(project_id, updated_tasks)
    await data_io.clear_telemetry_json(project_id)

    # Re-run the full pipeline so transition_matrix.json and the graph reflect the change
    job = await job_runner.create_job(db, project_id, JobType.pipeline_run)
    background_tasks.add_task(job_runner.run_pipeline_job, job.id, project_id)

    task_edit_request.status = "approved"
    task_edit_request.reviewer_user_id = current_user.id
    task_edit_request.reviewer_email = current_user.email
    task_edit_request.review_note = body.review_note if body else None
    task_edit_request.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task_edit_request)
    return task_edit_request


@router.post(
    "/projects/{project_id}/task-edit-requests/{request_id}/reject",
    response_model=TaskEditRequestOut,
)
async def reject_task_edit_request(
    project_id: str,
    request_id: str,
    body: TaskEditReview | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    await _get_project_or_404(project_id, db)
    task_edit_request = await _get_request_or_404(project_id, request_id, db)
    if task_edit_request.status != "pending":
        raise HTTPException(status_code=409, detail="Only pending requests can be rejected")

    task_edit_request.status = "rejected"
    task_edit_request.reviewer_user_id = current_user.id
    task_edit_request.reviewer_email = current_user.email
    task_edit_request.review_note = body.review_note if body else None
    task_edit_request.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task_edit_request)
    return task_edit_request

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.config import UPLOAD_MAX_BYTES
from backend.api.deps import get_db
from backend.api.models.db import Project, ToolEvaluation, UploadedFile
from backend.api.schemas.api import UploadedFileOut
from backend.api.services import data_io

router = APIRouter(tags=["uploads"])


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/projects/{project_id}/uploads", response_model=UploadedFileOut, status_code=201)
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    file_type: str = Form(...),
    tool_evaluation_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Accept a multipart file upload and store it in Supabase Storage."""
    await _get_project_or_404(project_id, db)

    if tool_evaluation_id:
        tool_eval = await db.get(ToolEvaluation, tool_evaluation_id)
        if not tool_eval or tool_eval.project_id != project_id:
            raise HTTPException(status_code=404, detail="Tool evaluation not found")

    content = await file.read()
    if len(content) > UPLOAD_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {UPLOAD_MAX_BYTES // (1024 * 1024)} MB limit",
        )

    safe_name = Path(file.filename or "upload").name
    dest_filename = f"{uuid.uuid4()}_{safe_name}"
    storage_path = data_io.uploads_storage_path(project_id, dest_filename)

    await data_io._upload(data_io.UPLOADS_BUCKET, storage_path, content)

    record = UploadedFile(
        project_id         = project_id,
        tool_evaluation_id = tool_evaluation_id,
        file_type          = file_type,
        original_name      = safe_name,
        storage_path       = storage_path,
        size_bytes         = len(content),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/projects/{project_id}/uploads", response_model=list[UploadedFileOut])
async def list_uploads(project_id: str, db: AsyncSession = Depends(get_db)):
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.project_id == project_id)
        .order_by(UploadedFile.uploaded_at.desc())
    )
    return result.scalars().all()


@router.delete("/projects/{project_id}/uploads/{file_id}", status_code=204)
async def delete_upload(
    project_id: str, file_id: str, db: AsyncSession = Depends(get_db)
):
    record = await db.get(UploadedFile, file_id)
    if not record or record.project_id != project_id:
        raise HTTPException(status_code=404, detail="File not found")

    await data_io._delete(data_io.UPLOADS_BUCKET, record.storage_path)

    await db.delete(record)
    await db.commit()

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import Project, ToolEvaluation
from backend.api.schemas.api import ToolEvaluationCreate, ToolEvaluationOut

router = APIRouter(tags=["tools"])


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{project_id}/tools", response_model=list[ToolEvaluationOut])
async def list_tool_evals(project_id: str, db: AsyncSession = Depends(get_db)):
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(ToolEvaluation)
        .where(ToolEvaluation.project_id == project_id)
        .order_by(ToolEvaluation.created_at.desc())
    )
    return result.scalars().all()


@router.get("/projects/{project_id}/tools/{eval_id}", response_model=ToolEvaluationOut)
async def get_tool_eval(
    project_id: str, eval_id: str, db: AsyncSession = Depends(get_db)
):
    tool_eval = await db.get(ToolEvaluation, eval_id)
    if not tool_eval or tool_eval.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tool evaluation not found")
    return tool_eval


@router.post("/projects/{project_id}/tools", response_model=ToolEvaluationOut, status_code=201)
async def create_tool_eval(
    project_id: str,
    body: ToolEvaluationCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_or_404(project_id, db)
    tool_eval = ToolEvaluation(project_id=project_id, **body.model_dump())
    db.add(tool_eval)
    await db.commit()
    await db.refresh(tool_eval)
    return tool_eval

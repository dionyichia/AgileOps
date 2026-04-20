from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import AuthUser, get_current_user, get_db
from backend.api.schemas.api import CosmoChatRequest, CosmoChatResponse, CosmoDemoChatRequest
from backend.api.services import cosmo
from backend.api.services.project_access import require_owned_project

router = APIRouter(tags=["cosmo"])


@router.post("/projects/{project_id}/cosmo/chat", response_model=CosmoChatResponse)
async def chat_with_cosmo(
    project_id: str,
    body: CosmoChatRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_owned_project(project_id, current_user, db)
    reply, model = await cosmo.generate_reply(
        project=project,
        db=db,
        page=body.page,
        tool_evaluation_id=body.tool_evaluation_id,
        messages=[message.model_dump() for message in body.messages],
    )
    return CosmoChatResponse(
        reply=reply,
        model=model,
        scope={
            "project_id": project_id,
            "page": body.page,
            "tool_evaluation_id": body.tool_evaluation_id,
        },
    )


@router.post("/cosmo/demo-chat", response_model=CosmoChatResponse)
async def chat_with_cosmo_demo(body: CosmoDemoChatRequest):
    reply, model = await cosmo.generate_reply_from_context(
        context={
            "page": body.page,
            "workflow": body.context,
        },
        messages=[message.model_dump() for message in body.messages],
    )
    return CosmoChatResponse(
        reply=reply,
        model=model,
        scope={
            "project_id": None,
            "page": body.page,
            "tool_evaluation_id": None,
        },
    )

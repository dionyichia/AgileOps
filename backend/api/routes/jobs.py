from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import Job
from backend.api.schemas.api import JobOut
from backend.api.services import ws_manager

# Two routers: HTTP under /api prefix, WebSocket at root (no /api prefix)
http_router = APIRouter(tags=["jobs"])
ws_router   = APIRouter(tags=["jobs-ws"])


@http_router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@ws_router.websocket("/ws/jobs/{job_id}")
async def job_websocket(websocket: WebSocket, job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Real-time job progress stream.

    On connect: immediately sends the current job state so late-joining clients
    catch up without waiting for the next broadcast.

    Message format (matches useJobProgress.ts expectations):
      {"type": "progress",  "pct": 45, "step": "..."}
      {"type": "completed", "summary": {...}}
      {"type": "failed",    "error": "..."}
    """
    job = await db.get(Job, job_id)
    if not job:
        await websocket.close(code=4004)
        return

    await ws_manager.connect(job_id, websocket)

    # Send current state immediately (catch-up for late joins)
    if job.status.value in ("completed", "failed"):
        payload = (
            {"type": "completed", "summary": job.result_data or {}}
            if job.status.value == "completed"
            else {"type": "failed", "error": job.error_message or "Unknown error"}
        )
        await websocket.send_json(payload)
        ws_manager.disconnect(job_id, websocket)
        return

    await websocket.send_json({
        "type": "progress",
        "pct":  job.progress_pct,
        "step": job.current_step or "",
    })

    try:
        # Keep connection alive; client sends pings to prevent timeout
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(job_id, websocket)

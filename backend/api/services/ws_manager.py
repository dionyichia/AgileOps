"""
In-memory WebSocket connection manager for job progress broadcasts.

Limitations: single-process only. For horizontal scaling, swap the in-memory
dict for a Redis pub/sub channel without changing the broadcast interface.
"""

import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# job_id → list of active WebSocket connections
_connections: dict[str, list[WebSocket]] = defaultdict(list)


async def connect(job_id: str, websocket: WebSocket) -> None:
    await websocket.accept()
    _connections[job_id].append(websocket)
    logger.debug("WS connected for job %s (total: %d)", job_id, len(_connections[job_id]))


def disconnect(job_id: str, websocket: WebSocket) -> None:
    conns = _connections.get(job_id, [])
    if websocket in conns:
        conns.remove(websocket)
    if not conns:
        _connections.pop(job_id, None)
    logger.debug("WS disconnected for job %s", job_id)


async def broadcast(job_id: str, payload: dict[str, Any]) -> None:
    """Send a JSON message to all clients watching this job."""
    conns = list(_connections.get(job_id, []))
    if not conns:
        return
    dead: list[WebSocket] = []
    for ws in conns:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        disconnect(job_id, ws)


async def close_all(job_id: str) -> None:
    """Close all connections for a finished job."""
    conns = list(_connections.pop(job_id, []))
    for ws in conns:
        async with asyncio.timeout(2):
            try:
                await ws.close()
            except Exception:
                pass

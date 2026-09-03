import uuid
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.services.websocket_service import ws_manager

logger = logging.getLogger("app.websocket_router")

router = APIRouter()


@router.websocket("/sessions/{session_id}")
async def session_websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
):
    """
    Real-time duplex WebSocket channel for live classroom sessions,
    instant challenge key displays, dynamic window locks, and real-time roster updates.
    """
    await ws_manager.connect_session(websocket, session_id)
    try:
        while True:
            # Handle incoming client messages (e.g. heartbeat ping / client sync)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_session(websocket, session_id)
    except Exception as e:
        logger.warning(f"[WS] Session {session_id} socket error: {e}")
        ws_manager.disconnect_session(websocket, session_id)


@router.websocket("/global")
async def global_websocket_endpoint(websocket: WebSocket):
    """
    Global real-time WebSocket channel for timetable changes,
    instant schedule broadcasts, and student notices.
    """
    await ws_manager.connect_global(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_global(websocket)
    except Exception as e:
        logger.warning(f"[WS] Global socket error: {e}")
        ws_manager.disconnect_global(websocket)

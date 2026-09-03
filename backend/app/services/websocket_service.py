import json
import logging
from typing import Dict, Set, Any
from uuid import UUID
from fastapi import WebSocket

logger = logging.getLogger("app.websocket")


class ConnectionManager:
    def __init__(self):
        # Maps session_id (str) -> Set of active WebSocket connections
        self.active_session_connections: Dict[str, Set[WebSocket]] = {}
        # Global connections (for timetable / general updates)
        self.global_connections: Set[WebSocket] = set()

    async def connect_session(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_session_connections:
            self.active_session_connections[session_id] = set()
        self.active_session_connections[session_id].add(websocket)
        logger.info(f"[WS] Client connected to session {session_id}. Total: {len(self.active_session_connections[session_id])}")

    def disconnect_session(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_session_connections:
            self.active_session_connections[session_id].discard(websocket)
            if not self.active_session_connections[session_id]:
                del self.active_session_connections[session_id]
        logger.info(f"[WS] Client disconnected from session {session_id}")

    async def connect_global(self, websocket: WebSocket):
        await websocket.accept()
        self.global_connections.add(websocket)
        logger.info(f"[WS] Client connected to global hub. Total: {len(self.global_connections)}")

    def disconnect_global(self, websocket: WebSocket):
        self.global_connections.discard(websocket)
        logger.info("[WS] Client disconnected from global hub")

    async def broadcast_to_session(self, session_id: str, event_type: str, data: Any = None):
        """Broadcasts a real-time event instantly to all clients connected to a specific session."""
        if session_id not in self.active_session_connections:
            return

        payload = {
            "type": event_type,
            "session_id": session_id,
            "data": data or {},
        }
        dead_connections = set()
        for connection in list(self.active_session_connections[session_id]):
            try:
                await connection.send_json(payload)
            except Exception as e:
                logger.warning(f"[WS] Error sending to connection: {e}")
                dead_connections.add(connection)

        for dead in dead_connections:
            self.disconnect_session(dead, session_id)

    async def broadcast_global(self, event_type: str, data: Any = None):
        """Broadcasts a global event to all connected dashboard / timetable clients."""
        payload = {
            "type": event_type,
            "data": data or {},
        }
        dead_connections = set()
        for connection in list(self.global_connections):
            try:
                await connection.send_json(payload)
            except Exception as e:
                logger.warning(f"[WS] Error sending global broadcast: {e}")
                dead_connections.add(connection)

        for dead in dead_connections:
            self.disconnect_global(dead)


ws_manager = ConnectionManager()


async def broadcast_session_event(session_id: Any, event_type: str, data: Any = None):
    """Helper function to broadcast session-scoped events safely."""
    try:
        s_id = str(session_id)
        await ws_manager.broadcast_to_session(s_id, event_type, data)
    except Exception as e:
        logger.error(f"[WS] Failed to broadcast session event '{event_type}': {e}")


async def broadcast_global_event(event_type: str, data: Any = None):
    """Helper function to broadcast global events safely."""
    try:
        await ws_manager.broadcast_global(event_type, data)
    except Exception as e:
        logger.error(f"[WS] Failed to broadcast global event '{event_type}': {e}")

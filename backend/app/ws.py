from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.deps import decode_token
from jose import JWTError

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, player_id: int):
        await websocket.accept()
        self.active_connections.setdefault(player_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, player_id: int):
        conns = self.active_connections.get(player_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active_connections.pop(player_id, None)

    async def broadcast(self, message: dict):
        dead = []
        for player_id, connections in list(self.active_connections.items()):
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append((player_id, ws))
        for player_id, ws in dead:
            self.disconnect(ws, player_id)

    async def send_to(self, player_id: int, message: dict):
        for ws in self.active_connections.get(player_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: int, token: str = ""):
    try:
        decode_token(token)
    except (JWTError, Exception):
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, player_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, player_id)

"""
Squid Game — Luz Verde / Luz Vermelha
WebSocket multiplayer.

Estado da sala:
- Servidor controla a luz (verde/vermelho) com timing aleatório
- Jogadores enviam posição continuamente enquanto têm mouse pressionado
- Se mover durante luz vermelha → eliminado
- Quem chegar à linha de chegada (y >= FINISH_LINE) ganha
- Sala identificada por código único

Mensagens cliente → servidor:
  {type: "join", name: str}
  {type: "move", x: float, y: float, moving: bool}  # posição normalizada 0..1

Mensagens servidor → cliente:
  {type: "state", light: "green"|"red", players: [...], game_status: "waiting"|"running"|"finished"}
  {type: "killed", player_id: str}
  {type: "winner", player_id: str, name: str}
  {type: "light", light: "green"|"red"}  # mudança de luz
  {type: "started"}
  {type: "countdown", seconds: int}
"""
import asyncio
import json
import logging
import random
import secrets
import string
import time
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

FINISH_LINE = 0.08   # normalizado: y=0 é a linha de chegada, y=1 é o início
MOVE_THRESHOLD = 5   # pixels de movimento para considerar "a mover"
GAME_DURATION = 90   # segundos

# ── Sala ──────────────────────────────────────────────────────────────────────
class Player:
    def __init__(self, ws: WebSocket, pid: str, name: str):
        self.ws = ws
        self.id = pid
        self.name = name
        self.x = 0.5          # posição normalizada 0..1
        self.y = 1.0          # 1.0 = início, 0.0 = chegada
        self.moving = False
        self.alive = True
        self.finished = False
        self.blood: list[dict] = []  # manchas de sangue

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "x": round(self.x, 4),
            "y": round(self.y, 4),
            "moving": self.moving,
            "alive": self.alive,
            "finished": self.finished,
            "blood": self.blood,
        }


class SquidRoom:
    def __init__(self, code: str, host_id: str):
        self.code = code
        self.host_id = host_id
        self.players: dict[str, Player] = {}
        self.light = "green"
        self.game_status = "waiting"   # waiting | countdown | running | finished
        self.winner: Optional[str] = None
        self.start_time: float = 0
        self._task: Optional[asyncio.Task] = None

    async def broadcast(self, msg: dict, exclude: Optional[str] = None):
        dead = []
        for pid, p in list(self.players.items()):
            if pid == exclude:
                continue
            try:
                await p.ws.send_json(msg)
            except Exception:
                dead.append(pid)
        for pid in dead:
            self.players.pop(pid, None)

    async def send_state(self):
        for pid, p in list(self.players.items()):
            try:
                await p.ws.send_json({
                    "type": "state",
                    "light": self.light,
                    "game_status": self.game_status,
                    "winner": self.winner,
                    "you": pid,
                    "players": [pl.to_dict() for pl in self.players.values()],
                    "time_left": max(0, int(GAME_DURATION - (time.time() - self.start_time))) if self.start_time else GAME_DURATION,
                })
            except Exception:
                pass

    def all_done(self) -> bool:
        alive = [p for p in self.players.values() if p.alive and not p.finished]
        return len(alive) == 0 and len(self.players) > 0

    async def run_game(self):
        """Main game loop — controls light switching."""
        # Countdown 5s
        self.game_status = "countdown"
        for i in range(5, 0, -1):
            await self.broadcast({"type": "countdown", "seconds": i})
            await asyncio.sleep(1)

        self.game_status = "running"
        self.start_time = time.time()
        self.light = "green"
        await self.broadcast({"type": "started"})
        await self.broadcast({"type": "light", "light": "green"})

        elapsed = 0
        while elapsed < GAME_DURATION and not self.all_done() and self.game_status == "running":
            # Random green phase: 2-5 seconds
            green_dur = random.uniform(2.0, 5.0)
            self.light = "green"
            await self.broadcast({"type": "light", "light": "green"})
            await self.send_state()
            await asyncio.sleep(green_dur)

            if self.game_status != "running": break

            # Random red phase: 1.5-4 seconds
            red_dur = random.uniform(1.5, 4.0)
            self.light = "red"
            await self.broadcast({"type": "light", "light": "red"})
            await self.send_state()
            await asyncio.sleep(red_dur)

            elapsed = time.time() - self.start_time

        # Time's up — kill all remaining moving players
        if self.game_status == "running":
            for p in self.players.values():
                if p.alive and not p.finished:
                    p.alive = False
                    p.blood.append({"x": p.x, "y": p.y})
                    await self.broadcast({"type": "killed", "player_id": p.id, "name": p.name})
            self.game_status = "finished"
            await self.send_state()


# ── Room registry ─────────────────────────────────────────────────────────────
_rooms: dict[str, SquidRoom] = {}


def _make_code() -> str:
    return "SQ-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


# ── WebSocket ─────────────────────────────────────────────────────────────────
@router.websocket("/ws/squid/{code}")
async def squid_ws(websocket: WebSocket, code: str):
    code = code.upper()

    await websocket.accept()

    pid = secrets.token_hex(4)
    player_name = f"Jogador"
    room: Optional[SquidRoom] = None

    try:
        # First message must be join
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        msg = json.loads(raw)
        if msg.get("type") != "join":
            await websocket.close(); return

        player_name = str(msg.get("name", f"Jogador-{pid[:4]}"))[:20]

        # Get or create room
        if code == "NEW":
            room_code = _make_code()
            room = SquidRoom(room_code, pid)
            _rooms[room_code] = room
        else:
            room = _rooms.get(code)
            if not room:
                await websocket.send_json({"type": "error", "detail": "Sala não encontrada"})
                await websocket.close(); return

        player = Player(websocket, pid, player_name)
        # Stagger start positions slightly
        player.x = 0.3 + random.random() * 0.4
        player.y = 0.9 + random.random() * 0.08
        room.players[pid] = player

        # Send room info
        await websocket.send_json({
            "type": "joined",
            "player_id": pid,
            "room_code": room.code,
            "is_host": room.host_id == pid,
        })
        await room.send_state()
        await room.broadcast({"type": "player_joined", "name": player_name}, exclude=pid)

        # Message loop
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            t = msg.get("type")

            if t == "start" and room.host_id == pid and room.game_status == "waiting":
                if len(room.players) >= 1:
                    room._task = asyncio.create_task(room.run_game())

            elif t == "move" and room.game_status == "running":
                if not player.alive or player.finished:
                    continue

                new_x = max(0.02, min(0.98, float(msg.get("x", player.x))))
                new_y = max(0.0, min(1.0, float(msg.get("y", player.y))))
                is_moving = bool(msg.get("moving", False))

                if room.light == "red" and is_moving:
                    # Killed!
                    player.alive = False
                    player.blood.append({"x": new_x, "y": new_y})
                    player.x = new_x
                    player.y = new_y
                    player.moving = False
                    await room.broadcast({
                        "type": "killed",
                        "player_id": pid,
                        "name": player.name,
                        "x": new_x,
                        "y": new_y,
                    })
                    if room.all_done():
                        room.game_status = "finished"
                        await room.send_state()
                else:
                    player.x = new_x
                    player.y = new_y
                    player.moving = is_moving

                    # Check finish line
                    if player.y <= FINISH_LINE and not player.finished:
                        player.finished = True
                        player.moving = False
                        if not room.winner:
                            room.winner = pid
                            room.game_status = "finished"
                            await room.broadcast({
                                "type": "winner",
                                "player_id": pid,
                                "name": player.name,
                            })
                        await room.send_state()
                    else:
                        # Broadcast position update (throttled by client)
                        await room.broadcast({
                            "type": "move",
                            "player_id": pid,
                            "x": player.x,
                            "y": player.y,
                            "moving": player.moving,
                        }, exclude=pid)

            elif t == "ping":
                await websocket.send_json({"type": "pong"})

            elif t == "chat":
                text = str(msg.get("text", ""))[:200].strip()
                if text:
                    await room.broadcast({
                        "type": "chat",
                        "name": player_name,
                        "text": text,
                    })

    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception as e:
        logger.warning(f"Squid WS error: {e}")
    finally:
        if room and pid in room.players:
            room.players.pop(pid, None)
            if room.players:
                await room.broadcast({"type": "player_left", "player_id": pid, "name": player_name})
            else:
                # Empty room — cleanup
                _rooms.pop(room.code, None)
                if room._task:
                    room._task.cancel()


# ── REST — create/check room (registado em /api/v1/squid) ────────────────────
http_router = APIRouter(prefix="/squid", tags=["Squid Game"])

@http_router.post("/rooms")
async def create_squid_room():
    code = _make_code()
    return {"code": code}

@http_router.get("/rooms/{code}")
async def check_squid_room(code: str):
    room = _rooms.get(code.upper())
    if not room:
        return {"exists": False}
    return {
        "exists": True,
        "code": room.code,
        "players": len(room.players),
        "status": room.game_status,
    }

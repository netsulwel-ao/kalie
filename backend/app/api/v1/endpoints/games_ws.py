"""
WebSocket endpoint for real-time chess game.
Backend is the SINGLE source of truth.
Each operation opens a fresh DB session to avoid stale state.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

import chess
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.models.game import Challenge, ChallengeStatus, GameType
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Room registry ─────────────────────────────────────────────────────────────
# challenge_id → { user_id: websocket }
_rooms: dict[str, dict[str, WebSocket]] = {}


# ── DB helpers ────────────────────────────────────────────────────────────────
async def _load_challenge(challenge_id: str) -> Challenge | None:
    """Load challenge with all relationships from a fresh DB session."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Challenge)
            .options(
                selectinload(Challenge.creator),
                selectinload(Challenge.opponent),
                selectinload(Challenge.winner),
            )
            .where(Challenge.id == challenge_id)
        )
        return result.scalar_one_or_none()


async def _load_user(user_id: str) -> User | None:
    async with AsyncSessionLocal() as db:
        return await db.get(User, user_id)


# ── Send helpers ──────────────────────────────────────────────────────────────
async def _send(ws: WebSocket, msg: dict) -> bool:
    try:
        await ws.send_json(msg)
        return True
    except Exception:
        return False


async def _broadcast_room(room_key: str, msg: dict, exclude_uid: str | None = None):
    room = _rooms.get(room_key, {})
    dead = []
    for uid, ws in list(room.items()):
        if uid == exclude_uid:
            continue
        ok = await _send(ws, msg)
        if not ok:
            dead.append(uid)
    for uid in dead:
        room.pop(uid, None)


# ── State builder ─────────────────────────────────────────────────────────────
def _user_dict(u: User) -> dict:
    return {"id": str(u.id), "username": u.username,
            "full_name": u.full_name, "avatar_url": u.avatar_url}


def _build_state(c: Challenge, state: dict, user_id: str) -> dict:
    uid = str(user_id)
    creator_id = str(c.creator_id)
    opp_id = str(c.opponent_id) if c.opponent_id else None

    # Determine this user's color
    if c.game_type == GameType.CHESS:
        if uid == creator_id:
            my_color = c.creator_color
        elif opp_id and uid == opp_id:
            my_color = "black" if c.creator_color == "white" else "white"
        else:
            my_color = None
    else:
        # NTI: creator = first color in player_order, opponent = second
        order = state.get("player_order", ["red", "green"]) if state else ["red", "green"]
        if uid == creator_id:
            my_color = order[0] if order else "red"
        elif opp_id and uid == opp_id:
            my_color = order[1] if len(order) > 1 else "green"
        else:
            my_color = None

    # Determine if it's this user's turn
    is_my_turn = False
    if my_color and c.status == ChallengeStatus.IN_PROGRESS and state:
        if c.game_type == GameType.CHESS:
            try:
                board = chess.Board(state["fen"])
                is_my_turn = (
                    (my_color == "white" and board.turn == chess.WHITE) or
                    (my_color == "black" and board.turn == chess.BLACK)
                )
            except Exception:
                pass
        else:
            # NTI: it's my turn if current_player matches my color
            # AND there are valid moves OR dice haven't been rolled yet
            is_my_turn = (
                state.get("current_player") == my_color and
                (state.get("dice") is None or
                 len(state.get("valid_moves", [])) > 0 or
                 len(state.get("bonus_dice", [])) > 0)
            )

    return {
        "id": str(c.id),
        "game_type": c.game_type,
        "status": c.status,
        "invite_code": c.invite_code,
        "time_control": c.time_control,
        "current_turn": c.current_turn,
        "creator_color": c.creator_color,
        "game_state": state,
        "winner_id": str(c.winner_id) if c.winner_id else None,
        "finish_reason": c.finish_reason,
        "creator": _user_dict(c.creator) if c.creator else None,
        "opponent": _user_dict(c.opponent) if c.opponent else None,
        "is_my_turn": is_my_turn,
        "my_color": my_color,
    }


async def _broadcast_state(room_key: str, c: Challenge, state: dict):
    room = _rooms.get(room_key, {})
    dead = []
    for uid, ws in list(room.items()):
        ok = await _send(ws, {"type": "state", "challenge": _build_state(c, state, uid)})
        if not ok:
            dead.append(uid)
    for uid in dead:
        room.pop(uid, None)


# ── Auth ──────────────────────────────────────────────────────────────────────
async def _authenticate(token: str) -> User | None:
    try:
        payload = decode_token(token)
        uid = payload.get("sub")
        if not uid:
            return None
        return await _load_user(uid)
    except JWTError:
        return None


# ── WebSocket handler ─────────────────────────────────────────────────────────
@router.websocket("/ws/game/{challenge_id}")
async def game_ws(websocket: WebSocket, challenge_id: str):
    token = websocket.query_params.get("token", "")

    # Auth
    user = await _authenticate(token)
    if not user:
        await websocket.close(code=4001)
        return

    # Load challenge
    challenge = await _load_challenge(challenge_id)
    if not challenge:
        await websocket.close(code=4004)
        return

    is_creator = str(challenge.creator_id) == str(user.id)
    is_opponent = (challenge.opponent_id and
                   str(challenge.opponent_id) == str(user.id))

    if not is_creator and not is_opponent:
        await websocket.close(code=4003)
        return

    await websocket.accept()

    # Register in room
    room_key = str(challenge_id)
    if room_key not in _rooms:
        _rooms[room_key] = {}

    was_in_room = str(user.id) in _rooms[room_key]
    _rooms[room_key][str(user.id)] = websocket

    # Send current state
    state = json.loads(challenge.game_state) if challenge.game_state else {}
    await _send(websocket, {
        "type": "state",
        "challenge": _build_state(challenge, state, str(user.id)),
    })

    # Notify others
    notify_type = "player_reconnected" if (was_in_room or challenge.status == ChallengeStatus.IN_PROGRESS) else "player_joined"
    for uid, ws in list(_rooms.get(room_key, {}).items()):
        if uid == str(user.id):
            continue
        await _send(ws, {
            "type": notify_type,
            "player": _user_dict(user),
            "challenge": _build_state(challenge, state, uid),
        })

    # ── Message loop ──────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, {"type": "error", "detail": "JSON inválido"})
                continue

            t = msg.get("type")

            # ── Chat ──────────────────────────────────────────────
            if t == "chat":
                text = str(msg.get("text", "")).strip()[:500]
                if text:
                    await _broadcast_room(room_key, {
                        "type": "chat",
                        "sender": _user_dict(user),
                        "text": text,
                        "ts": datetime.now(timezone.utc).isoformat(),
                    })

            # ── Start ─────────────────────────────────────────────
            elif t == "start":
                if not is_creator:
                    await _send(websocket, {"type": "error", "detail": "Só o criador pode iniciar"})
                    continue

                # Fresh load from DB
                c = await _load_challenge(challenge_id)
                if not c:
                    await _send(websocket, {"type": "error", "detail": "Desafio não encontrado"})
                    continue

                if c.status != ChallengeStatus.WAITING:
                    await _send(websocket, {"type": "error", "detail": "Jogo já iniciado"})
                    continue
                if not c.opponent_id:
                    await _send(websocket, {"type": "error", "detail": "Aguarda o adversário"})
                    continue

                # Countdown broadcast
                for i in range(5, 0, -1):
                    await _broadcast_room(room_key, {"type": "countdown", "seconds": i})
                    await asyncio.sleep(1)

                # Update status in a fresh session
                tc = msg.get("time_control")
                async with AsyncSessionLocal() as db:
                    fresh = await db.get(Challenge, challenge_id)
                    if not fresh or fresh.status != ChallengeStatus.WAITING:
                        await _send(websocket, {"type": "error", "detail": "Estado inválido"})
                        continue
                    if isinstance(tc, int) and 60 <= tc <= 3600:
                        fresh.time_control = tc
                    fresh.status = ChallengeStatus.IN_PROGRESS
                    await db.commit()

                # Reload and broadcast
                c = await _load_challenge(challenge_id)
                if not c:
                    continue
                state = json.loads(c.game_state) if c.game_state else {}
                await _broadcast_room(room_key, {"type": "started"})
                await _broadcast_state(room_key, c, state)

            # ── Move (Chess ou NTI) ───────────────────────────────
            elif t == "move":
                c = await _load_challenge(challenge_id)
                if not c:
                    await _send(websocket, {"type": "error", "detail": "Desafio não encontrado"})
                    continue

                if c.status != ChallengeStatus.IN_PROGRESS:
                    await _send(websocket, {"type": "error", "detail": "Jogo não está em curso"})
                    continue

                # ── NTI move ──────────────────────────────────────
                if c.game_type == GameType.LUDO:
                    from app.services.nti_engine import apply_move, is_game_over

                    uid = str(user.id)
                    state = json.loads(c.game_state)
                    order = state.get("player_order", ["red", "yellow", "blue", "green"])

                    if uid == str(c.creator_id):
                        my_color = order[0]
                    elif c.opponent_id and uid == str(c.opponent_id):
                        my_color = order[1] if len(order) > 1 else "yellow"
                    else:
                        await _send(websocket, {"type": "error", "detail": "Não és jogador"})
                        continue

                    if state.get("current_player") != my_color:
                        await _send(websocket, {"type": "error", "detail": "Não é a tua vez"})
                        continue

                    if not state.get("dice"):
                        await _send(websocket, {"type": "error", "detail": "Lança os dados primeiro"})
                        continue

                    dice_index = msg.get("dice_index")
                    token_index = msg.get("token_index")

                    if dice_index is None or token_index is None:
                        await _send(websocket, {"type": "error", "detail": "Falta dice_index ou token_index"})
                        continue

                    # Validate move exists
                    valid_moves = state.get("valid_moves", [])
                    move_ok = any(
                        m["dice_index"] == dice_index and m["token_index"] == token_index
                        for m in valid_moves
                    )
                    if not move_ok:
                        await _send(websocket, {"type": "error", "detail": "Movimento inválido"})
                        continue

                    new_state = apply_move(state, my_color, dice_index, token_index)
                    winner_color = is_game_over(new_state)

                    async with AsyncSessionLocal() as db:
                        fresh = await db.get(Challenge, challenge_id)
                        if not fresh:
                            continue
                        fresh.game_state = json.dumps(new_state)
                        fresh.current_turn = new_state.get("current_player")
                        if winner_color:
                            fresh.status = ChallengeStatus.FINISHED
                            fresh.finish_reason = "win"
                            if order and order[0] == winner_color:
                                fresh.winner_id = fresh.creator_id
                            else:
                                fresh.winner_id = fresh.opponent_id
                        await db.commit()

                    c = await _load_challenge(challenge_id)
                    if not c:
                        continue
                    await _broadcast_state(room_key, c, new_state)
                    continue

                # ── Chess move ────────────────────────────────────
                uid = str(user.id)
                if uid == str(c.creator_id):
                    my_color = c.creator_color
                elif c.opponent_id and uid == str(c.opponent_id):
                    my_color = "black" if c.creator_color == "white" else "white"
                else:
                    await _send(websocket, {"type": "error", "detail": "Não és jogador"})
                    continue

                state = json.loads(c.game_state)
                board = chess.Board(state["fen"])
                expected = "white" if board.turn == chess.WHITE else "black"

                if my_color != expected:
                    await _send(websocket, {
                        "type": "error",
                        "detail": f"Não é a tua vez (esperado: {expected})",
                    })
                    continue

                uci = str(msg.get("move", "")).strip()
                try:
                    move = chess.Move.from_uci(uci)
                except ValueError:
                    await _send(websocket, {"type": "error", "detail": f"UCI inválido: {uci}"})
                    continue

                if move not in board.legal_moves:
                    await _send(websocket, {"type": "error", "detail": f"Movimento ilegal: {uci}"})
                    continue

                board.push(move)
                state["fen"] = board.fen()
                state["moves"].append(uci)
                state["is_check"] = board.is_check()
                state["is_checkmate"] = board.is_checkmate()
                state["is_stalemate"] = board.is_stalemate()
                state["is_game_over"] = board.is_game_over()

                new_turn = "black" if board.turn == chess.BLACK else "white"
                finished = board.is_game_over()
                winner_id = None
                finish_reason = None
                if finished:
                    if board.is_checkmate():
                        winner_id = str(user.id)
                        finish_reason = "checkmate"
                    elif board.is_stalemate():
                        finish_reason = "stalemate"
                    else:
                        finish_reason = "draw"

                async with AsyncSessionLocal() as db:
                    fresh = await db.get(Challenge, challenge_id)
                    if not fresh:
                        continue
                    fresh.game_state = json.dumps(state)
                    fresh.current_turn = new_turn
                    if finished:
                        fresh.status = ChallengeStatus.FINISHED
                        fresh.finish_reason = finish_reason
                        if winner_id:
                            import uuid as _uuid
                            fresh.winner_id = _uuid.UUID(winner_id)
                    await db.commit()

                c = await _load_challenge(challenge_id)
                if not c:
                    continue
                await _broadcast_state(room_key, c, state)

            # ── Roll dice (NTI only) ───────────────────────────────
            elif t == "roll_dice":
                c = await _load_challenge(challenge_id)
                if not c or c.status != ChallengeStatus.IN_PROGRESS:
                    await _send(websocket, {"type": "error", "detail": "Jogo não está em curso"})
                    continue

                if c.game_type != GameType.LUDO:
                    await _send(websocket, {"type": "error", "detail": "Só para NTI"})
                    continue

                from app.services.nti_engine import process_roll, process_bonus_roll

                uid = str(user.id)
                state = json.loads(c.game_state)
                order = state.get("player_order", ["red", "yellow", "blue", "green"])

                if uid == str(c.creator_id):
                    my_color = order[0]
                elif c.opponent_id and uid == str(c.opponent_id):
                    my_color = order[1] if len(order) > 1 else "yellow"
                else:
                    await _send(websocket, {"type": "error", "detail": "Não és jogador"})
                    continue

                if state.get("current_player") != my_color:
                    await _send(websocket, {"type": "error", "detail": "Não é a tua vez"})
                    continue

                # Bónus: relançar dados específicos
                bonus_dice = state.get("bonus_dice", [])
                if bonus_dice:
                    new_state, new_vals = process_bonus_roll(state, my_color, bonus_dice)
                elif state.get("dice") is None:
                    new_state, new_vals = process_roll(state, my_color)
                else:
                    await _send(websocket, {"type": "error", "detail": "Dados já lançados"})
                    continue

                async with AsyncSessionLocal() as db:
                    fresh = await db.get(Challenge, challenge_id)
                    if not fresh:
                        continue
                    fresh.game_state = json.dumps(new_state)
                    fresh.current_turn = new_state.get("current_player")
                    await db.commit()

                c = await _load_challenge(challenge_id)
                if not c:
                    continue
                await _broadcast_state(room_key, c, new_state)

            # ── Resign ────────────────────────────────────────────
            elif t == "resign":
                c = await _load_challenge(challenge_id)
                if not c or c.status != ChallengeStatus.IN_PROGRESS:
                    continue

                uid = str(user.id)
                async with AsyncSessionLocal() as db:
                    fresh = await db.get(Challenge, challenge_id)
                    if not fresh:
                        continue
                    if uid == str(fresh.creator_id):
                        fresh.winner_id = fresh.opponent_id
                    else:
                        fresh.winner_id = fresh.creator_id
                    fresh.status = ChallengeStatus.FINISHED
                    fresh.finish_reason = "resign"
                    await db.commit()

                c = await _load_challenge(challenge_id)
                if not c:
                    continue
                state = json.loads(c.game_state) if c.game_state else {}
                await _broadcast_state(room_key, c, state)

    except WebSocketDisconnect:
        pass

    finally:
        room = _rooms.get(room_key, {})
        room.pop(str(user.id), None)

        # Disconnect penalty only during active game
        c = await _load_challenge(challenge_id)
        if c and c.status == ChallengeStatus.IN_PROGRESS:
            await asyncio.sleep(3)

            if str(user.id) in _rooms.get(room_key, {}):
                return  # reconnected

            await _broadcast_room(room_key, {
                "type": "player_disconnected",
                "player_id": str(user.id),
                "player_name": user.full_name,
                "timeout_seconds": 30,
            })

            await asyncio.sleep(27)

            if str(user.id) in _rooms.get(room_key, {}):
                return  # reconnected during countdown

            # Forfeit
            async with AsyncSessionLocal() as db:
                fresh = await db.get(Challenge, challenge_id)
                if fresh and fresh.status == ChallengeStatus.IN_PROGRESS:
                    if str(fresh.creator_id) == str(user.id):
                        fresh.winner_id = fresh.opponent_id
                    else:
                        fresh.winner_id = fresh.creator_id
                    fresh.status = ChallengeStatus.FINISHED
                    fresh.finish_reason = "disconnect"
                    await db.commit()

            c = await _load_challenge(challenge_id)
            if c:
                state = json.loads(c.game_state) if c.game_state else {}
                await _broadcast_state(room_key, c, state)

"""
WebSocket endpoint — real-time game handler.
Uses in-memory _rooms dict (single worker, no --reload).
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

# challenge_id → { user_id: websocket }
_rooms: dict[str, dict[str, WebSocket]] = {}


# ── DB ────────────────────────────────────────────────────────────────────────
async def _load_challenge(challenge_id: str) -> Challenge | None:
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


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _send(ws: WebSocket, msg: dict) -> bool:
    try:
        await ws.send_json(msg)
        return True
    except Exception:
        return False


def _user_dict(u: User) -> dict:
    return {"id": str(u.id), "username": u.username,
            "full_name": u.full_name, "avatar_url": u.avatar_url}


def _build_state(c: Challenge, state: dict, user_id: str) -> dict:
    uid = str(user_id)
    creator_id = str(c.creator_id)
    opp_id = str(c.opponent_id) if c.opponent_id else None

    if c.game_type == GameType.CHESS:
        my_color = c.creator_color if uid == creator_id else (
            ("black" if c.creator_color == "white" else "white") if opp_id and uid == opp_id else None
        )
    elif c.game_type == GameType.TICTACTOE:
        my_color = "X" if uid == creator_id else ("O" if opp_id and uid == opp_id else None)
    elif c.game_type == GameType.CHECKERS:
        my_color = "white" if uid == creator_id else ("black" if opp_id and uid == opp_id else None)
    else:
        order = state.get("player_order", ["red", "green"]) if state else ["red", "green"]
        my_color = order[0] if uid == creator_id else (
            (order[1] if len(order) > 1 else "green") if opp_id and uid == opp_id else None
        )

    is_my_turn = False
    if my_color and c.status == ChallengeStatus.IN_PROGRESS and state:
        if c.game_type == GameType.CHESS:
            try:
                b = chess.Board(state["fen"])
                is_my_turn = (my_color == "white" and b.turn == chess.WHITE) or \
                             (my_color == "black" and b.turn == chess.BLACK)
            except Exception:
                pass
        elif c.game_type == GameType.TICTACTOE:
            is_my_turn = state.get("current_player") == my_color and state.get("winner") is None
        elif c.game_type == GameType.CHECKERS:
            is_my_turn = state.get("current_player") == my_color and state.get("winner") is None
        else:
            is_my_turn = (
                state.get("current_player") == my_color and
                (state.get("dice") is None or
                 len(state.get("valid_moves", [])) > 0 or
                 len(state.get("bonus_dice", [])) > 0)
            )

    return {
        "id": str(c.id), "game_type": c.game_type, "status": c.status,
        "invite_code": c.invite_code, "time_control": c.time_control,
        "current_turn": c.current_turn, "creator_color": c.creator_color,
        "game_state": state,
        "winner_id": str(c.winner_id) if c.winner_id else None,
        "finish_reason": c.finish_reason,
        "creator": _user_dict(c.creator) if c.creator else None,
        "opponent": _user_dict(c.opponent) if c.opponent else None,
        "is_my_turn": is_my_turn, "my_color": my_color,
    }


async def _broadcast(room_key: str, msg: dict) -> None:
    """Send same message to all connections in room."""
    room = _rooms.get(room_key, {})
    dead = []
    for uid, ws in list(room.items()):
        if not await _send(ws, msg):
            dead.append(uid)
    for uid in dead:
        room.pop(uid, None)


async def _broadcast_state(room_key: str, c: Challenge, state: dict) -> None:
    """Send per-user state to all connections in room."""
    room = _rooms.get(room_key, {})
    dead = []
    for uid, ws in list(room.items()):
        if not await _send(ws, {"type": "state", "challenge": _build_state(c, state, uid)}):
            dead.append(uid)
    for uid in dead:
        room.pop(uid, None)


# ── Auth ──────────────────────────────────────────────────────────────────────
async def _authenticate(token: str) -> User | None:
    try:
        payload = decode_token(token)
        uid = payload.get("sub")
        return await _load_user(uid) if uid else None
    except JWTError:
        return None


# ── WebSocket ─────────────────────────────────────────────────────────────────
@router.websocket("/ws/game/{challenge_id}")
async def game_ws(websocket: WebSocket, challenge_id: str):
    token = websocket.query_params.get("token", "")
    user = await _authenticate(token)
    if not user:
        await websocket.close(code=4001); return

    challenge = await _load_challenge(challenge_id)
    if not challenge:
        await websocket.close(code=4004); return

    is_creator = str(challenge.creator_id) == str(user.id)
    is_opponent = challenge.opponent_id and str(challenge.opponent_id) == str(user.id)
    if not is_creator and not is_opponent:
        await websocket.close(code=4003); return

    await websocket.accept()

    room_key = str(challenge_id)
    if room_key not in _rooms:
        _rooms[room_key] = {}

    was_in_room = str(user.id) in _rooms[room_key]
    _rooms[room_key][str(user.id)] = websocket

    # Send current state to this connection
    state = json.loads(challenge.game_state) if challenge.game_state else {}
    await _send(websocket, {"type": "state", "challenge": _build_state(challenge, state, str(user.id))})

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

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, {"type": "error", "detail": "JSON inválido"}); continue

            t = msg.get("type")

            # ── Ping ─────────────────────────────────────────────
            if t == "ping":
                await _send(websocket, {"type": "pong"})

            # ── Chat ─────────────────────────────────────────────
            elif t == "chat":
                text = str(msg.get("text", "")).strip()[:500]
                if text:
                    await _broadcast(room_key, {
                        "type": "chat", "sender": _user_dict(user),
                        "text": text, "ts": datetime.now(timezone.utc).isoformat(),
                    })

            # ── Start ─────────────────────────────────────────────
            elif t == "start":
                if not is_creator:
                    await _send(websocket, {"type": "error", "detail": "Só o criador pode iniciar"}); continue

                c = await _load_challenge(challenge_id)
                if not c or c.status != ChallengeStatus.WAITING:
                    await _send(websocket, {"type": "error", "detail": "Jogo já iniciado ou não encontrado"}); continue
                if not c.opponent_id:
                    await _send(websocket, {"type": "error", "detail": "Aguarda o adversário"}); continue

                for i in range(5, 0, -1):
                    await _broadcast(room_key, {"type": "countdown", "seconds": i})
                    await asyncio.sleep(1)

                tc = msg.get("time_control")
                async with AsyncSessionLocal() as db:
                    fresh = await db.get(Challenge, challenge_id)
                    if not fresh or fresh.status != ChallengeStatus.WAITING:
                        await _send(websocket, {"type": "error", "detail": "Estado inválido"}); continue
                    if isinstance(tc, int) and 60 <= tc <= 3600:
                        fresh.time_control = tc
                    fresh.status = ChallengeStatus.IN_PROGRESS
                    if fresh.game_type == GameType.TICTACTOE and fresh.game_state:
                        gs = json.loads(fresh.game_state)
                        gs["game_started"] = True
                        fresh.game_state = json.dumps(gs)
                    await db.commit()

                c = await _load_challenge(challenge_id)
                if not c: continue
                state = json.loads(c.game_state) if c.game_state else {}
                await _broadcast(room_key, {"type": "started"})
                await _broadcast_state(room_key, c, state)

            # ── Move ─────────────────────────────────────────────
            elif t == "move":
                c = await _load_challenge(challenge_id)
                if not c or c.status != ChallengeStatus.IN_PROGRESS:
                    await _send(websocket, {"type": "error", "detail": "Jogo não está em curso"}); continue

                # TicTacToe
                if c.game_type == GameType.TICTACTOE:
                    uid = str(user.id)
                    state = json.loads(c.game_state)
                    my_sym = "X" if uid == str(c.creator_id) else "O"
                    if state.get("current_player") != my_sym:
                        await _send(websocket, {"type": "error", "detail": "Não é a tua vez"}); continue
                    pos = msg.get("position")
                    if pos is None or not isinstance(pos, int) or not 0 <= pos <= 8:
                        await _send(websocket, {"type": "error", "detail": "Posição inválida"}); continue
                    board_s = state.get("board", [None] * 9)
                    if board_s[pos] is not None:
                        await _send(websocket, {"type": "error", "detail": "Casa já ocupada"}); continue
                    board_s[pos] = my_sym
                    state["board"] = board_s
                    state["move_count"] = state.get("move_count", 0) + 1
                    state["current_player"] = "O" if my_sym == "X" else "X"
                    LINES = [(0,1,2),(3,4,5),(6,7,8),(0,3,6),(1,4,7),(2,5,8),(0,4,8),(2,4,6)]
                    winner_sym = next((board_s[a] for a,b,cc in LINES
                                       if board_s[a] and board_s[a]==board_s[b]==board_s[cc]), None)
                    is_draw = not winner_sym and all(cell is not None for cell in board_s)
                    finished = bool(winner_sym) or is_draw
                    if winner_sym: state["winner"] = winner_sym
                    elif is_draw: state["winner"] = "draw"
                    async with AsyncSessionLocal() as db:
                        fresh = await db.get(Challenge, challenge_id)
                        if not fresh: continue
                        fresh.game_state = json.dumps(state)
                        if finished:
                            fresh.status = ChallengeStatus.FINISHED
                            if winner_sym:
                                fresh.finish_reason = "win"
                                import uuid as _uuid
                                fresh.winner_id = fresh.creator_id if winner_sym == "X" else fresh.opponent_id
                            else:
                                fresh.finish_reason = "draw"
                        await db.commit()
                    c = await _load_challenge(challenge_id)
                    if c: await _broadcast_state(room_key, c, state)
                    continue

                if c.game_type == GameType.CHECKERS:
                    from app.services.checkers_engine import apply_move as ck_apply, is_game_over as ck_over
                    uid = str(user.id)
                    state = json.loads(c.game_state)
                    my_color = "white" if uid == str(c.creator_id) else "black"
                    if state.get("winner"):
                        await _send(websocket, {"type": "error", "detail": "Jogo já terminado"}); continue
                    if state.get("current_player") != my_color:
                        await _send(websocket, {"type": "error", "detail": "Não é a tua vez"}); continue
                    frm = msg.get("from"); to = msg.get("to")
                    if frm is None or to is None:
                        await _send(websocket, {"type": "error", "detail": "Falta from/to"}); continue
                    try:
                        new_state = ck_apply(state, int(frm), int(to))
                    except ValueError as e:
                        await _send(websocket, {"type": "error", "detail": str(e)}); continue
                    winner = ck_over(new_state)
                    async with AsyncSessionLocal() as db:
                        fresh = await db.get(Challenge, challenge_id)
                        if not fresh: continue
                        fresh.game_state = json.dumps(new_state)
                        fresh.current_turn = new_state.get("current_player")
                        if winner:
                            fresh.status = ChallengeStatus.FINISHED
                            fresh.finish_reason = "win"
                            import uuid as _uuid
                            fresh.winner_id = fresh.creator_id if winner == "white" else fresh.opponent_id
                        await db.commit()
                    c = await _load_challenge(challenge_id)
                    if c: await _broadcast_state(room_key, c, new_state)
                    continue

                # NTI
                if c.game_type == GameType.LUDO:
                    from app.services.nti_engine import apply_move, is_game_over
                    uid = str(user.id)
                    state = json.loads(c.game_state)
                    order = state.get("player_order", ["red", "yellow", "blue", "green"])
                    my_color = order[0] if uid == str(c.creator_id) else (order[1] if len(order) > 1 else "yellow")
                    if state.get("current_player") != my_color:
                        await _send(websocket, {"type": "error", "detail": "Não é a tua vez"}); continue
                    if not state.get("dice"):
                        await _send(websocket, {"type": "error", "detail": "Lança os dados primeiro"}); continue
                    di = msg.get("dice_index"); ti = msg.get("token_index")
                    if di is None or ti is None:
                        await _send(websocket, {"type": "error", "detail": "Falta dice_index ou token_index"}); continue
                    if not any(m["dice_index"] == di and m["token_index"] == ti for m in state.get("valid_moves", [])):
                        await _send(websocket, {"type": "error", "detail": "Movimento inválido"}); continue
                    new_state = apply_move(state, my_color, di, ti)
                    winner_color = is_game_over(new_state)
                    async with AsyncSessionLocal() as db:
                        fresh = await db.get(Challenge, challenge_id)
                        if not fresh: continue
                        fresh.game_state = json.dumps(new_state)
                        fresh.current_turn = new_state.get("current_player")
                        if winner_color:
                            fresh.status = ChallengeStatus.FINISHED
                            fresh.finish_reason = "win"
                            fresh.winner_id = fresh.creator_id if order and order[0] == winner_color else fresh.opponent_id
                        await db.commit()
                    c = await _load_challenge(challenge_id)
                    if c: await _broadcast_state(room_key, c, new_state)
                    continue

                # Chess
                uid = str(user.id)
                my_color = c.creator_color if uid == str(c.creator_id) else (
                    "black" if c.creator_color == "white" else "white"
                )
                state = json.loads(c.game_state)
                board = chess.Board(state["fen"])
                expected = "white" if board.turn == chess.WHITE else "black"
                if my_color != expected:
                    await _send(websocket, {"type": "error", "detail": f"Não é a tua vez ({expected})"}); continue
                uci = str(msg.get("move", "")).strip()
                try:
                    move = chess.Move.from_uci(uci)
                except ValueError:
                    await _send(websocket, {"type": "error", "detail": f"UCI inválido: {uci}"}); continue
                if move not in board.legal_moves:
                    await _send(websocket, {"type": "error", "detail": f"Movimento ilegal: {uci}"}); continue
                board.push(move)
                state["fen"] = board.fen()
                state["moves"].append(uci)
                state["is_check"] = board.is_check()
                state["is_checkmate"] = board.is_checkmate()
                state["is_stalemate"] = board.is_stalemate()
                state["is_game_over"] = board.is_game_over()
                new_turn = "black" if board.turn == chess.BLACK else "white"
                finished = board.is_game_over()
                winner_id = str(user.id) if finished and board.is_checkmate() else None
                finish_reason = ("checkmate" if board.is_checkmate() else
                                 "stalemate" if board.is_stalemate() else "draw" if finished else None)
                async with AsyncSessionLocal() as db:
                    fresh = await db.get(Challenge, challenge_id)
                    if not fresh: continue
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
                if c: await _broadcast_state(room_key, c, state)

            # ── Roll dice (NTI) ───────────────────────────────────
            elif t == "roll_dice":
                c = await _load_challenge(challenge_id)
                if not c or c.status != ChallengeStatus.IN_PROGRESS or c.game_type != GameType.LUDO:
                    await _send(websocket, {"type": "error", "detail": "Inválido"}); continue
                from app.services.nti_engine import process_roll, process_bonus_roll
                uid = str(user.id)
                state = json.loads(c.game_state)
                order = state.get("player_order", ["red", "yellow", "blue", "green"])
                my_color = order[0] if uid == str(c.creator_id) else (order[1] if len(order) > 1 else "yellow")
                if state.get("current_player") != my_color:
                    await _send(websocket, {"type": "error", "detail": "Não é a tua vez"}); continue
                bonus = state.get("bonus_dice", [])
                if bonus:
                    new_state, _ = process_bonus_roll(state, my_color, bonus)
                elif state.get("dice") is None:
                    new_state, _ = process_roll(state, my_color)
                else:
                    await _send(websocket, {"type": "error", "detail": "Dados já lançados"}); continue
                async with AsyncSessionLocal() as db:
                    fresh = await db.get(Challenge, challenge_id)
                    if not fresh: continue
                    fresh.game_state = json.dumps(new_state)
                    fresh.current_turn = new_state.get("current_player")
                    await db.commit()
                c = await _load_challenge(challenge_id)
                if c: await _broadcast_state(room_key, c, new_state)

            # ── Resign ────────────────────────────────────────────
            elif t == "resign":
                c = await _load_challenge(challenge_id)
                if not c or c.status != ChallengeStatus.IN_PROGRESS: continue
                uid = str(user.id)
                async with AsyncSessionLocal() as db:
                    fresh = await db.get(Challenge, challenge_id)
                    if not fresh: continue
                    fresh.winner_id = fresh.opponent_id if uid == str(fresh.creator_id) else fresh.creator_id
                    fresh.status = ChallengeStatus.FINISHED
                    fresh.finish_reason = "resign"
                    await db.commit()
                c = await _load_challenge(challenge_id)
                if c:
                    state = json.loads(c.game_state) if c.game_state else {}
                    await _broadcast_state(room_key, c, state)

    except WebSocketDisconnect:
        pass
    finally:
        room = _rooms.get(room_key, {})
        room.pop(str(user.id), None)

        c = await _load_challenge(challenge_id)
        if c and c.status == ChallengeStatus.IN_PROGRESS:
            await asyncio.sleep(3)
            if str(user.id) in _rooms.get(room_key, {}): return
            await _broadcast(room_key, {
                "type": "player_disconnected",
                "player_id": str(user.id),
                "player_name": user.full_name,
                "timeout_seconds": 30,
            })
            await asyncio.sleep(27)
            if str(user.id) in _rooms.get(room_key, {}): return
            async with AsyncSessionLocal() as db:
                fresh = await db.get(Challenge, challenge_id)
                if fresh and fresh.status == ChallengeStatus.IN_PROGRESS:
                    fresh.winner_id = fresh.opponent_id if str(fresh.creator_id) == str(user.id) else fresh.creator_id
                    fresh.status = ChallengeStatus.FINISHED
                    fresh.finish_reason = "disconnect"
                    await db.commit()
            c = await _load_challenge(challenge_id)
            if c:
                state = json.loads(c.game_state) if c.game_state else {}
                await _broadcast_state(room_key, c, state)

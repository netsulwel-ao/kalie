"""
Games endpoints — Chess and Ludo.
Backend is the source of truth for all game state.

POST /games/challenges                        — create challenge
GET  /games/challenges/{id}                   — get challenge state
POST /games/challenges/{id}/join              — join challenge
POST /games/challenges/{id}/invite/{user_id}  — invite a specific user
POST /games/challenges/{id}/move              — make a move
POST /games/challenges/{id}/resign            — resign
GET  /games/challenges/code/{code}            — find by invite code
"""
import json
import secrets
import uuid
from typing import Optional

import chess
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DB, VerifiedUser
from app.models.game import Challenge, ChallengeStatus, GameType
from app.models.notification import Notification
from app.models.user import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class CreateChallengeRequest(BaseModel):
    game_type: GameType
    color: Optional[str] = "white"       # chess only: "white" | "black" | "random"
    time_control: int = 600              # seconds per player (600=10min, 300=5min, 180=3min)


class MakeMoveRequest(BaseModel):
    # Chess: UCI move string e.g. "e2e4", "e7e8q"
    # Ludo: not implemented yet (uses existing LudoPlay.tsx flow)
    move: str


# ── Helpers ───────────────────────────────────────────────────────────────────
def _generate_invite_code() -> str:
    return secrets.token_urlsafe(8)[:8].upper()


def _challenge_to_dict(c: Challenge, current_user_id: str) -> dict:
    # Parse state from the in-memory object (already updated)
    state = json.loads(c.game_state) if c.game_state else None

    uid = str(current_user_id).strip()
    creator_id = str(c.creator_id).strip()
    opp_id = str(c.opponent_id).strip() if c.opponent_id else None

    my_color = None
    if c.game_type == GameType.CHESS:
        if uid == creator_id:
            my_color = c.creator_color
        elif opp_id and uid == opp_id:
            my_color = "black" if c.creator_color == "white" else "white"
    elif c.game_type == GameType.TICTACTOE:
        if uid == creator_id:
            my_color = "X"
        elif opp_id and uid == opp_id:
            my_color = "O"
    elif c.game_type == GameType.CHECKERS:
        if uid == creator_id:
            my_color = "white"
        elif opp_id and uid == opp_id:
            my_color = "black"

    is_my_turn = False
    if c.game_type == GameType.CHESS and state and c.status == ChallengeStatus.IN_PROGRESS:
        fen = state.get("fen", "")
        if fen and my_color:
            try:
                board = chess.Board(fen)
                is_my_turn = (
                    (my_color == "white" and board.turn == chess.WHITE) or
                    (my_color == "black" and board.turn == chess.BLACK)
                )
            except Exception:
                pass
    elif c.game_type == GameType.TICTACTOE and state and c.status == ChallengeStatus.IN_PROGRESS:
        is_my_turn = (
            state.get("current_player") == my_color and
            state.get("winner") is None
        )
    elif c.game_type == GameType.CHECKERS and state and c.status == ChallengeStatus.IN_PROGRESS:
        sel = state.get("selected")
        is_my_turn = (
            state.get("current_player") == my_color and
            state.get("winner") is None and
            (sel is None or True)  # during chain capture, same player continues
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
        "created_at": c.created_at.isoformat(),
        "creator": {
            "id": str(c.creator.id),
            "username": c.creator.username,
            "full_name": c.creator.full_name,
            "avatar_url": c.creator.avatar_url,
        } if c.creator else None,
        "opponent": {
            "id": str(c.opponent.id),
            "username": c.opponent.username,
            "full_name": c.opponent.full_name,
            "avatar_url": c.opponent.avatar_url,
        } if c.opponent else None,
        "is_my_turn": is_my_turn,
        "my_color": my_color,
    }


def _is_my_turn(c: Challenge, user_id: str) -> bool:
    if c.game_type == GameType.CHESS and c.game_state:
        state = json.loads(c.game_state)
        fen = state.get("fen", "")
        board = chess.Board(fen)
        my_color = _my_color(c, user_id)
        if my_color == "white":
            return board.turn == chess.WHITE
        elif my_color == "black":
            return board.turn == chess.BLACK
    return False


def _my_color(c: Challenge, user_id: str) -> Optional[str]:
    if c.game_type != GameType.CHESS:
        return None
    if str(c.creator_id) == user_id:
        return c.creator_color
    if c.opponent_id and str(c.opponent_id) == user_id:
        return "black" if c.creator_color == "white" else "white"
    return None


def _initial_chess_state() -> dict:
    board = chess.Board()
    return {
        "fen": board.fen(),
        "moves": [],
        "is_check": False,
        "is_checkmate": False,
        "is_stalemate": False,
        "is_game_over": False,
    }


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/challenges", status_code=status.HTTP_201_CREATED)
async def create_challenge(data: CreateChallengeRequest, db: DB, current_user: VerifiedUser):
    """Create a new game challenge."""
    color = data.color
    if color == "random":
        import random
        color = random.choice(["white", "black"])

    # Generate unique invite code
    for _ in range(10):
        code = _generate_invite_code()
        existing = await db.execute(select(Challenge).where(Challenge.invite_code == code))
        if not existing.scalar_one_or_none():
            break

    initial_state = None
    if data.game_type == GameType.CHESS:
        initial_state = json.dumps(_initial_chess_state())
    elif data.game_type == GameType.LUDO:
        from app.services.nti_engine import initial_state as nti_initial
        initial_state = json.dumps(nti_initial(num_players=2))
    elif data.game_type == GameType.TICTACTOE:
        initial_state = json.dumps({
            "board": [None] * 9,
            "current_player": "X",
            "winner": None,
            "move_count": 0,
            "game_started": False,
        })
    elif data.game_type == GameType.CHECKERS:
        from app.services.checkers_engine import initial_state as checkers_initial
        initial_state = json.dumps(checkers_initial())

    challenge = Challenge(
        game_type=data.game_type,
        creator_id=current_user.id,
        invite_code=code,
        creator_color=color if data.game_type == GameType.CHESS else None,
        game_state=initial_state,
        current_turn="white" if data.game_type == GameType.CHESS else None,
        time_control=max(60, min(3600, data.time_control)),  # clamp 1min–60min
    )
    db.add(challenge)
    await db.flush()
    await db.refresh(challenge, ["creator"])

    return _challenge_to_dict(challenge, str(current_user.id))


@router.get("/challenges/code/{code}")
async def get_challenge_by_code(code: str, db: DB, current_user: CurrentUser):
    """Find a challenge by invite code."""
    result = await db.execute(
        select(Challenge).where(Challenge.invite_code == code.upper())
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio não encontrado")
    # Load relationships
    await db.refresh(challenge, ["creator", "opponent"])
    return _challenge_to_dict(challenge, str(current_user.id))


@router.get("/challenges/{challenge_id}")
async def get_challenge(challenge_id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Get challenge state."""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio não encontrado")
    await db.refresh(challenge, ["creator", "opponent", "winner"])
    return _challenge_to_dict(challenge, str(current_user.id))


@router.post("/challenges/{challenge_id}/invite/{target_user_id}", status_code=status.HTTP_201_CREATED)
async def invite_user(
    challenge_id: uuid.UUID,
    target_user_id: uuid.UUID,
    db: DB,
    current_user: VerifiedUser,
):
    """Invite a specific user to join the challenge. They receive a notification."""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio não encontrado")
    if str(challenge.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Só o criador pode convidar")
    if challenge.status != ChallengeStatus.WAITING:
        raise HTTPException(status_code=400, detail="Desafio já não está disponível")

    target = await db.get(User, target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    if str(target_user_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Não podes convidar-te a ti mesmo")

    game_name = "Xadrez" if challenge.game_type == GameType.CHESS else "Ludo"
    mins = challenge.time_control // 60
    time_label = f"{mins} min" if mins >= 1 else f"{challenge.time_control}s"
    notif = Notification(
        user_id=target_user_id,
        type="game_invite",
        title=f"Convite para jogar {game_name}",
        body=f"{current_user.full_name} convidou-te para uma partida de {game_name} ({time_label} por jogador).",
        data=json.dumps({
            "challenge_id": str(challenge_id),
            "invite_code": challenge.invite_code,
            "game_type": challenge.game_type,
            "time_control": challenge.time_control,
            "from_user": {
                "id": str(current_user.id),
                "username": current_user.username,
                "full_name": current_user.full_name,
                "avatar_url": current_user.avatar_url,
            },
        }),
    )
    db.add(notif)
    await db.flush()
    return {"message": f"Convite enviado para {target.full_name}"}


@router.get("/notifications")
async def get_notifications(db: DB, current_user: CurrentUser):
    """Get all notifications for the current user."""
    from sqlalchemy import desc
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    notifs = result.scalars().all()
    return [
        {
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "body": n.body,
            "data": json.loads(n.data) if n.data else None,
            "read": n.read,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifs
    ]


@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: uuid.UUID, db: DB, current_user: CurrentUser):
    notif = await db.get(Notification, notif_id)
    if not notif or str(notif.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    notif.read = True
    await db.flush()
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read(db: DB, current_user: CurrentUser):
    from sqlalchemy import update
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read == False)
        .values(read=True)
    )
    await db.flush()
    return {"ok": True}


@router.post("/challenges/{challenge_id}/join")
async def join_challenge(challenge_id: uuid.UUID, db: DB, current_user: VerifiedUser):
    """Join an existing challenge as opponent. Status stays WAITING until creator starts."""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio não encontrado")
    if challenge.status != ChallengeStatus.WAITING:
        raise HTTPException(status_code=400, detail="Este desafio já não está disponível")
    if str(challenge.creator_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Não podes entrar no teu próprio desafio")
    if challenge.opponent_id is not None:
        raise HTTPException(status_code=400, detail="Este desafio já tem um adversário")

    # Set opponent but keep status WAITING — creator must click "Iniciar"
    challenge.opponent_id = current_user.id
    await db.flush()
    await db.refresh(challenge, ["creator", "opponent"])
    await db.commit()

    # Notify creator via WebSocket — load fresh challenge with all relations
    from app.api.v1.endpoints.games_ws import _rooms, _send, _build_state, _load_challenge, _user_dict
    room_key = str(challenge_id)
    opp_id = str(current_user.id)

    if room_key in _rooms:
        fresh = await _load_challenge(str(challenge_id))
        if fresh:
            state_data = json.loads(fresh.game_state) if fresh.game_state else {}
            for uid, ws in list(_rooms[room_key].items()):
                if uid == opp_id:
                    continue
                await _send(ws, {
                    "type": "player_joined",
                    "player": _user_dict(current_user),
                    "challenge": _build_state(fresh, state_data, uid),
                })

    # Return fresh dict using already-refreshed challenge
    return _challenge_to_dict(challenge, opp_id)


@router.post("/challenges/{challenge_id}/move")
async def make_move(challenge_id: uuid.UUID, data: MakeMoveRequest, db: DB, current_user: VerifiedUser):
    """Make a move. Backend validates and updates state."""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio não encontrado")
    if challenge.status != ChallengeStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="O jogo não está em curso")

    # Verify it's the player's turn
    if not _is_my_turn(challenge, str(current_user.id)):
        raise HTTPException(status_code=400, detail="Não é a tua vez")

    if challenge.game_type == GameType.CHESS:
        state = json.loads(challenge.game_state)
        board = chess.Board(state["fen"])

        try:
            move = chess.Move.from_uci(data.move)
        except ValueError:
            raise HTTPException(status_code=400, detail="Movimento inválido")

        if move not in board.legal_moves:
            raise HTTPException(status_code=400, detail="Movimento ilegal")

        board.push(move)
        state["fen"] = board.fen()
        state["moves"].append(data.move)
        state["is_check"] = board.is_check()
        state["is_checkmate"] = board.is_checkmate()
        state["is_stalemate"] = board.is_stalemate()
        state["is_game_over"] = board.is_game_over()

        challenge.game_state = json.dumps(state)
        challenge.current_turn = "black" if board.turn == chess.BLACK else "white"

        if board.is_game_over():
            challenge.status = ChallengeStatus.FINISHED
            if board.is_checkmate():
                # The player who just moved wins
                challenge.winner_id = current_user.id
                challenge.finish_reason = "checkmate"
            else:
                challenge.finish_reason = "draw"

    await db.flush()
    await db.refresh(challenge, ["creator", "opponent", "winner"])
    return _challenge_to_dict(challenge, str(current_user.id))


@router.post("/challenges/{challenge_id}/resign")
async def resign(challenge_id: uuid.UUID, db: DB, current_user: VerifiedUser):
    """Resign from a game."""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio não encontrado")
    if challenge.status != ChallengeStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="O jogo não está em curso")

    # Winner is the other player
    if str(challenge.creator_id) == str(current_user.id):
        challenge.winner_id = challenge.opponent_id
    else:
        challenge.winner_id = challenge.creator_id

    challenge.status = ChallengeStatus.FINISHED
    challenge.finish_reason = "resign"
    await db.flush()
    await db.refresh(challenge, ["creator", "opponent", "winner"])
    return _challenge_to_dict(challenge, str(current_user.id))

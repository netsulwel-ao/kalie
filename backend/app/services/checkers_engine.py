"""
Checkers (Damas) engine — regras angolanas.

Peças:
  "wp" = white piece (branco normal)  — começa em baixo (rows 5..7), move para cima
  "wk" = white king  (dama branca)
  "bp" = black piece (preto normal)   — começa em cima (rows 0..2), move para baixo
  "bk" = black king  (dama preta)

Branco = criador, começa em baixo, move para cima.
Preto  = adversário, começa em cima, move para baixo.

Regras angolanas:
  - Peça normal: move PARA A FRENTE.
  - Captura: pode voltar atrás APENAS para capturar.
  - Captura é OBRIGATÓRIA.
  - Capturas em cadeia obrigatórias.
  - Dama: move em qualquer diagonal, qualquer distância.
  - Promoção: branco chega a row 0, preto chega a row 7.
"""
from __future__ import annotations
from typing import Optional


def row(pos: int) -> int: return pos // 8
def col(pos: int) -> int: return pos % 8
def in_bounds(r: int, c: int) -> bool: return 0 <= r <= 7 and 0 <= c <= 7

def is_white(piece: str) -> bool: return bool(piece) and piece[0] == "w"
def is_black(piece: str) -> bool: return bool(piece) and piece[0] == "b"
def is_king(piece: str) -> bool: return bool(piece) and piece[1] == "k"
def owner(piece: str) -> str: return "white" if is_white(piece) else "black"


def initial_state() -> dict:
    board: dict[str, str] = {}
    for r in range(8):
        for c in range(8):
            if (r + c) % 2 == 1:
                p = r * 8 + c
                if r <= 2:
                    board[str(p)] = "bp"   # preto em cima, move para baixo
                elif r >= 5:
                    board[str(p)] = "wp"   # branco em baixo, move para cima
    return {
        "board": board,
        "current_player": "white",
        "selected": None,
        "must_capture": False,
        "winner": None,
        "move_count": 0,
        "captured_white": 0,
        "captured_black": 0,
    }


def _forward_dirs(piece: str) -> list[tuple[int, int]]:
    if is_white(piece):
        return [(-1, -1), (-1, 1)]   # branco move para cima
    else:
        return [(1, -1), (1, 1)]     # preto move para baixo


def _get_simple_moves(pos: int, piece: str, board: dict) -> list[int]:
    moves = []
    dirs = [(-1,-1),(-1,1),(1,-1),(1,1)] if is_king(piece) else _forward_dirs(piece)
    if is_king(piece):
        for dr, dc in dirs:
            r, c = row(pos) + dr, col(pos) + dc
            while in_bounds(r, c):
                dest = r * 8 + c
                if str(dest) in board:
                    break
                moves.append(dest)
                r += dr; c += dc
    else:
        for dr, dc in dirs:
            r2, c2 = row(pos) + dr, col(pos) + dc
            if in_bounds(r2, c2):
                dest = r2 * 8 + c2
                if str(dest) not in board:
                    moves.append(dest)
    return moves


def _get_captures(pos: int, piece: str, board: dict, player: str) -> list[dict]:
    captures = []
    dirs = [(-1,-1),(-1,1),(1,-1),(1,1)]
    enemy = "black" if player == "white" else "white"

    if is_king(piece):
        for dr, dc in dirs:
            r, c = row(pos) + dr, col(pos) + dc
            while in_bounds(r, c):
                mid = r * 8 + c
                mid_piece = board.get(str(mid))
                if mid_piece:
                    if owner(mid_piece) == enemy:
                        r2, c2 = r + dr, c + dc
                        while in_bounds(r2, c2):
                            dest = r2 * 8 + c2
                            if str(dest) in board:
                                break
                            captures.append({"from": pos, "over": mid, "to": dest})
                            r2 += dr; c2 += dc
                    break
                r += dr; c += dc
    else:
        for dr, dc in dirs:
            r2, c2 = row(pos) + dr, col(pos) + dc
            if not in_bounds(r2, c2): continue
            mid = r2 * 8 + c2
            mid_piece = board.get(str(mid))
            if not mid_piece or owner(mid_piece) != enemy: continue
            r3, c3 = r2 + dr, c2 + dc
            if in_bounds(r3, c3):
                dest = r3 * 8 + c3
                if str(dest) not in board:
                    captures.append({"from": pos, "over": mid, "to": dest})
    return captures


def _all_captures_for_player(player: str, board: dict) -> list[dict]:
    caps = []
    for ps, piece in board.items():
        if owner(piece) == player:
            caps.extend(_get_captures(int(ps), piece, board, player))
    return caps


def _all_moves_for_player(player: str, board: dict) -> list[dict]:
    captures = _all_captures_for_player(player, board)
    if captures:
        return captures
    moves = []
    for ps, piece in board.items():
        if owner(piece) == player:
            for dest in _get_simple_moves(int(ps), piece, board):
                moves.append({"from": int(ps), "to": dest, "over": None})
    return moves


def _moves_from(pos: int, player: str, board: dict, capture_only: bool = False) -> list[dict]:
    piece = board.get(str(pos))
    if not piece or owner(piece) != player:
        return []
    caps = _get_captures(pos, piece, board, player)
    if capture_only:
        return caps
    all_caps = _all_captures_for_player(player, board)
    if all_caps:
        return caps
    simples = [{"from": pos, "to": d, "over": None} for d in _get_simple_moves(pos, piece, board)]
    return caps + simples


def apply_move(state: dict, frm: int, to: int) -> dict:
    import copy
    state = copy.deepcopy(state)
    board = state["board"]
    player = state["current_player"]
    piece = board.get(str(frm))

    if not piece or owner(piece) != player:
        raise ValueError(f"No piece at {frm} for {player}")

    legal = _moves_from(frm, player, board, capture_only=(state.get("selected") is not None))
    match = next((m for m in legal if m["from"] == frm and m["to"] == to), None)
    if not match:
        raise ValueError(f"Illegal move {frm}→{to}")

    del board[str(frm)]
    board[str(to)] = piece

    captured_mid = None
    if match["over"] is not None:
        captured_mid = match["over"]
        del board[str(captured_mid)]
        if player == "white":
            state["captured_black"] = state.get("captured_black", 0) + 1
        else:
            state["captured_white"] = state.get("captured_white", 0) + 1

    # Promotion
    if not is_king(piece):
        r = row(to)
        if (player == "white" and r == 0) or (player == "black" and r == 7):
            board[str(to)] = piece[0] + "k"

    state["move_count"] = state.get("move_count", 0) + 1

    # Chain capture
    if captured_mid is not None:
        new_piece = board.get(str(to))
        chain = _get_captures(to, new_piece, board, player)
        if chain:
            state["selected"] = to
            state["must_capture"] = True
            state["winner"] = None
            return state

    state["selected"] = None
    state["must_capture"] = False
    next_player = "black" if player == "white" else "white"
    state["current_player"] = next_player

    next_moves = _all_moves_for_player(next_player, board)
    if not next_moves or not any(owner(p) == next_player for p in board.values()):
        state["winner"] = player

    return state


def get_legal_moves(state: dict) -> list[dict]:
    player = state["current_player"]
    board = state["board"]
    selected = state.get("selected")
    if selected is not None:
        piece = board.get(str(selected))
        if piece:
            return _get_captures(selected, piece, board, player)
        return []
    return _all_moves_for_player(player, board)


def is_game_over(state: dict) -> Optional[str]:
    return state.get("winner")

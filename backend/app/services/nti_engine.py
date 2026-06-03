"""
NTI (Não te Irrites) — Motor do jogo com regras angolanas.

Regras:
- 2 dados independentes por turno
- Ordem: vermelho → verde → amarelo → azul
- Para sair de casa: precisa de um 6 num dos dados
- Se não tiver peças na estrada E não tirar 6: passa a vez
- Números iguais (ex: 3+3): repete os dois dados (bónus)
- Se um dado calhar 6: repete só esse dado (bónus do 6)
- Cada dado pode mover uma peça diferente ou a mesma peça duas vezes
- Captura: cai na mesma casa que adversário (fora das casas seguras) → manda para casa

Percurso (sentido horário, 80 casas absolutas 0-indexed):
  out7=6, out8=7, ..., out15=14(larga-r), out16=15(saída-g), ..., out35=34(larga-g),
  out36=35(saída-y), ..., out75=74(larga-y), out76=75(saída-b), ..., out80=79,
  out1=0, out2=1, ..., out6=5(larga-b) → volta out7=6

Posições relativas (0 = saída do jogador):
  red:    rel=0 → abs=6,  rel=8  → abs=14 (larga, entra corredor)
  green:  rel=0 → abs=15, rel=19 → abs=34 (larga, entra corredor)
  yellow: rel=0 → abs=35, rel=39 → abs=74 (larga, entra corredor)
  blue:   rel=0 → abs=75, rel=10 → abs=5  (larga, entra corredor)

Posições no estado:
  -1 = em casa (base)
  0..ENTRY_REL[color] = pista principal (relativo ao início do jogador)
  ENTRY_REL+1..ENTRY_REL+9 = corredor privado (1º..9º passo)
  ENTRY_REL+10 = vitória
"""
import random
from typing import Optional

TRACK_LEN = 80       # 80 casas externas
HOME_COL_LEN = 9     # 9 casas no corredor privado

# Posição relativa da casa larga (última antes do corredor) por cor
# Após esta posição relativa, o peão entra no corredor privado
ENTRY_REL = {
    "red":    8,   # out7(0)→out8(1)→...→out15(8,larga)
    "green":  19,  # out16(0)→out17(1)→...→out35(19,larga)
    "yellow": 39,  # out36(0)→out37(1)→...→out75(39,larga)
    "blue":   10,  # out76(0)→out77(1)→...→out80(4)→out1(5)→...→out6(10,larga)
}

# Posição de vitória por cor
WIN_POS = {c: ENTRY_REL[c] + HOME_COL_LEN + 1 for c in ENTRY_REL}
# red=18, green=29, yellow=49, blue=20

# Posição de início na pista absoluta (0-indexed, out1=0, out7=6, etc.)
PLAYER_START = {"red": 6, "green": 15, "yellow": 35, "blue": 75}

# Casas seguras absolutas (0-indexed): saídas + estrelas + casas largas
# Saídas: out7=6, out16=15, out36=35, out76=75
# Estrelas: out75=74, out25=24, out48=47, out66=65
# Casas largas: out15=14, out35=34, out75=74, out6=5
SAFE_ABSOLUTE = {6, 15, 35, 75, 73, 24, 46, 56, 14, 34, 5}

# Ordem de jogo
PLAYER_ORDER = ["red", "green", "yellow", "blue"]


def _rel_to_abs(color: str, rel_pos: int) -> int:
    """Converte posição relativa para absoluta (0-indexed, 0=out1)."""
    if rel_pos > ENTRY_REL[color]:
        return -1  # no corredor privado, sem posição absoluta
    return (PLAYER_START[color] + rel_pos) % TRACK_LEN


def initial_state(num_players: int = 2) -> dict:
    colors = PLAYER_ORDER[:num_players]
    tokens = {}
    for color in PLAYER_ORDER:
        tokens[color] = [{"status": "home", "position": -1} for _ in range(4)]

    return {
        "tokens": tokens,
        "num_players": num_players,
        "current_player": colors[0],
        "player_order": colors,
        "dice": None,
        "dice_used": [False, False],
        "valid_moves": [],
        "bonus_dice": [],
        "six_count": 0,
        "move_count": 0,
        "game_started": True,
    }


def _compute_valid_moves(state: dict, color: str) -> list[dict]:
    """Calcula todos os movimentos possíveis para os dados não usados."""
    dice = state.get("dice") or []
    dice_used = state.get("dice_used", [False, False])
    tokens = state["tokens"][color]
    entry = ENTRY_REL[color]
    win = WIN_POS[color]
    moves = []

    for di, (d_val, d_used) in enumerate(zip(dice, dice_used)):
        if d_used:
            continue
        for ti, token in enumerate(tokens):
            if token["status"] == "win":
                continue
            if token["status"] == "home":
                # Sair de casa: precisa de 6
                if d_val == 6:
                    moves.append({"dice_index": di, "token_index": ti,
                                  "from": -1, "to": 0})
            else:
                pos = token["position"]
                new_pos = pos + d_val

                # Verificar se entra/avança no corredor privado
                if pos <= entry and new_pos > entry:
                    # Entra no corredor: steps_past = new_pos - entry
                    new_pos = entry + (new_pos - entry)

                if new_pos <= win:
                    moves.append({"dice_index": di, "token_index": ti,
                                  "from": pos, "to": new_pos})

    return moves


def _next_player(state: dict, color: str) -> str:
    order = state["player_order"]
    idx = order.index(color)
    for _ in range(len(order)):
        idx = (idx + 1) % len(order)
        nc = order[idx]
        if not all(t["status"] == "win" for t in state["tokens"][nc]):
            return nc
    return color


def process_roll(state: dict, color: str) -> tuple[dict, list[int]]:
    import copy
    state = copy.deepcopy(state)

    if state["current_player"] != color:
        raise ValueError(f"Não é a vez de {color}")
    if state["dice"] is not None:
        raise ValueError("Dados já lançados")

    d1 = random.randint(1, 6)
    d2 = random.randint(1, 6)
    state["dice"] = [d1, d2]
    state["dice_used"] = [False, False]
    state["bonus_dice"] = []

    moves = _compute_valid_moves(state, color)
    state["valid_moves"] = moves

    if not moves:
        state["dice"] = None
        state["dice_used"] = [False, False]
        state["current_player"] = _next_player(state, color)
        state["six_count"] = 0

    return state, [d1, d2]


def process_bonus_roll(state: dict, color: str, dice_indices: list[int]) -> tuple[dict, list[int]]:
    import copy
    state = copy.deepcopy(state)

    new_values = []
    for di in dice_indices:
        new_val = random.randint(1, 6)
        state["dice"][di] = new_val
        state["dice_used"][di] = False
        new_values.append(new_val)

    state["bonus_dice"] = []
    moves = _compute_valid_moves(state, color)
    state["valid_moves"] = moves

    if not moves:
        state["dice"] = None
        state["dice_used"] = [False, False]
        state["current_player"] = _next_player(state, color)
        state["six_count"] = 0

    return state, new_values


def apply_move(state: dict, color: str, dice_index: int, token_index: int) -> dict:
    import copy
    state = copy.deepcopy(state)

    valid = state.get("valid_moves", [])
    move = next((m for m in valid
                 if m["dice_index"] == dice_index and m["token_index"] == token_index), None)
    if not move:
        raise ValueError(f"Movimento inválido: dado={dice_index} peça={token_index}")

    dice_val = state["dice"][dice_index]
    tokens = state["tokens"][color]
    token = tokens[token_index]
    entry = ENTRY_REL[color]
    win = WIN_POS[color]

    if token["status"] == "home":
        token["status"] = "active"
        token["position"] = 0
    else:
        pos = token["position"]
        new_pos = pos + dice_val

        if pos <= entry and new_pos > entry:
            new_pos = entry + (new_pos - entry)

        if new_pos >= win:
            token["status"] = "win"
            token["position"] = win
        else:
            token["position"] = new_pos
            # Captura (só na pista principal, fora das casas seguras)
            if new_pos <= entry:
                abs_pos = _rel_to_abs(color, new_pos)
                if abs_pos not in SAFE_ABSOLUTE:
                    for oc, ot_list in state["tokens"].items():
                        if oc == color:
                            continue
                        for ot in ot_list:
                            if ot["status"] != "active":
                                continue
                            ot_entry = ENTRY_REL[oc]
                            if ot["position"] > ot_entry:
                                continue  # no corredor privado, seguro
                            if _rel_to_abs(oc, ot["position"]) == abs_pos:
                                ot["status"] = "home"
                                ot["position"] = -1

    state["dice_used"][dice_index] = True
    state["move_count"] += 1

    # Verificar vitória
    if all(t["status"] == "win" for t in tokens):
        state["dice"] = None
        state["dice_used"] = [False, False]
        state["valid_moves"] = []
        state["bonus_dice"] = []
        return state

    remaining_moves = _compute_valid_moves(state, color)
    state["valid_moves"] = remaining_moves
    all_used = all(state["dice_used"])

    if all_used or not remaining_moves:
        d = state["dice"]

        if all_used:
            bonus = []
            if d[0] == d[1]:
                bonus = [0, 1]
            else:
                if d[0] == 6:
                    bonus.append(0)
                if d[1] == 6:
                    bonus.append(1)

            if bonus:
                state["bonus_dice"] = bonus
                state["dice_used"] = [True, True]
                state["valid_moves"] = []
                return state

        if not remaining_moves:
            state["dice"] = None
            state["dice_used"] = [False, False]
            state["bonus_dice"] = []
            state["valid_moves"] = []
            state["current_player"] = _next_player(state, color)
            state["six_count"] = 0

    return state


def is_game_over(state: dict) -> Optional[str]:
    for color in state["player_order"]:
        if all(t["status"] == "win" for t in state["tokens"][color]):
            return color
    return None

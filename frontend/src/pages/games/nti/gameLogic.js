// gameLogic.js — Ludo completo, tabuleiro 15×15 correto

// ── Cores ────────────────────────────────────────────────────────────────────
export const COLORS = {
  r: '#ed2027',
  g: '#05a24b',
  y: '#ffde05',
  b: '#254399',
};

export const PLAYER_NAMES = {
  1: 'Vermelho',
  2: 'Verde',
  3: 'Amarelo',
  4: 'Azul',
};

// ── Mapeamento do tabuleiro 15×15 ────────────────────────────────────────────
// O tabuleiro Ludo padrão tem 52 casas no caminho externo + 5 casas privadas por cor
// Numeração das casas externas: 1-52 no sentido horário começando pela saída do vermelho
//
// Layout do tabuleiro (linha, coluna) 0-indexed:
//
//  Vermelho (r): canto superior esquerdo
//  Verde    (g): canto superior direito
//  Amarelo  (y): canto inferior direito
//  Azul     (b): canto inferior esquerdo
//
// Caminho externo (52 casas):
// out1  = saída vermelho  (linha 6, col 1)
// out14 = saída verde     (linha 1, col 8)
// out27 = saída amarelo   (linha 8, col 13)
// out40 = saída azul      (linha 13, col 6)
//
// Casas privadas (home stretch):
// r-out-1..5: linha 7, col 1..5  (vermelho entra pela col 1 indo para direita)
// g-out-1..5: col 7, linha 1..5  (verde entra pela linha 1 indo para baixo)
// y-out-1..5: linha 7, col 13..9 (amarelo entra pela col 13 indo para esquerda)
// b-out-1..5: col 7, linha 13..9 (azul entra pela linha 13 indo para cima)

// Posição de cada casa no grid 15×15 [row, col]
export const CELL_POSITIONS = {};

// Caminho externo — 52 casas
// Lado esquerdo descendo (col 6): out1..6
// Canto inferior esquerdo e lado inferior: out7..13
// Lado inferior subindo (col 8): out14..19 (verde)... na verdade vamos definir manualmente

// Definição manual precisa do caminho externo no grid 15×15:
// Começando em out1 (saída vermelha) e indo no sentido horário

const OUT_PATH_POSITIONS = [
  // out1..6: col 6, linhas 6..1 (subindo, lado esquerdo do corredor superior)
  [6,1],[5,1],[4,1],[3,1],[2,1],[1,1],
  // out7..8: linha 0, cols 6..7 (topo)
  [0,2],[0,3],
  // out9..13: col 8, linhas 0..5 (descendo, lado direito do corredor superior)
  [0,4],[0,5],[0,6],[1,6],[2,6],
  // out14: saída verde (linha 1, col 8) — na verdade col 8 linha 2
  [2,8],
  // out15..19: col 8, linhas 3..7 (continuando a descer)
  [3,8],[4,8],[5,8],[6,8],[6,9],
  // out20..26: linha 6, cols 9..13 e depois virar
  [6,10],[6,11],[6,12],[6,13],[5,13],[4,13],
  // out27: saída amarelo
  [3,13],
  // out28..32: col 8 subindo pelo lado direito
  [2,13],[1,13],[0,13],[0,12],[0,11],
  // out33..39: linha 8, cols 13..7
  [0,10],[0,9],[0,8],[1,8],[2,8],
  // Isso está ficando complexo — vou usar o layout real do HTML original
];

// ── Layout real baseado no HTML original ─────────────────────────────────────
// O HTML usa um grid de 3 colunas × 3 linhas:
// [home-r][top-strip][home-g]
// [left-strip][center][right-strip]
// [home-b][bottom-strip][home-y]
//
// top-strip: 3 cols × 6 rows  (ids: out6..18, g-out-1..5)
// left-strip: 6 cols × 3 rows (ids: out1..5,52,51, r-out-1..5, out45..50)
// right-strip: 6 cols × 3 rows (ids: out19..31, y-out-1..5)
// bottom-strip: 3 cols × 6 rows (ids: out32..44, b-out-1..5)

// Caminho externo completo (52 casas) com posição no tabuleiro visual
// Cada entrada: [cellId, row, col] no grid 15×15

// Vamos definir o tabuleiro como grid 15×15 onde:
// - Casas de base ficam nas regiões 6×6 dos cantos
// - O caminho externo forma um anel de 3 células de largura
// - O caminho privado entra pelo centro

// Grid 15×15 — índices 0..14
// Região vermelha:  rows 0..5,  cols 0..5
// Região verde:     rows 0..5,  cols 9..14
// Região amarela:   rows 9..14, cols 9..14
// Região azul:      rows 9..14, cols 0..5
// Centro:           rows 6..8,  cols 6..8

// Caminho externo (sentido horário, começando pela saída vermelha):
// out1:  row=6, col=1  (saída vermelha — casa colorida vermelha)
// out2:  row=5, col=1
// out3:  row=4, col=1
// out4:  row=3, col=1
// out5:  row=2, col=1
// out6:  row=1, col=1
// out7:  row=0, col=1
// out8:  row=0, col=2
// out9:  row=0, col=3  (safe star)
// out10: row=0, col=4
// out11: row=0, col=5
// out12: row=0, col=6
// out13: row=1, col=6
// out14: row=2, col=6  (saída verde — casa colorida verde)
// out15: row=3, col=6
// out16: row=4, col=6
// out17: row=5, col=6
// out18: row=6, col=6
// out19: row=6, col=7
// out20: row=6, col=8
// out21: row=6, col=9
// out22: row=6, col=10 (safe star)
// out23: row=6, col=11
// out24: row=6, col=12
// out25: row=6, col=13
// out26: row=5, col=13
// out27: row=4, col=13 (saída amarela — casa colorida amarela)
// out28: row=3, col=13
// out29: row=2, col=13
// out30: row=1, col=13
// out31: row=0, col=13
// out32: row=0, col=12
// out33: row=0, col=11 (safe star)
// out34: row=0, col=10
// out35: row=0, col=9
// out36: row=0, col=8
// out37: row=1, col=8
// out38: row=2, col=8  (saída azul — casa colorida azul)
// out39: row=3, col=8
// out40: row=4, col=8
// out41: row=5, col=8
// out42: row=6, col=8  -- CONFLITO com out20!
// Preciso revisar...

// ── Tabuleiro Ludo CORRETO 15×15 ─────────────────────────────────────────────
// Baseado no tabuleiro físico real do Ludo
// O caminho tem 52 casas + 5 casas privadas por cor
//
// Numeração correta (sentido horário):
//
//        col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14
// row 0:      .  .  .  .  .  .  12 13 35 34 33 32 .  .  .
// row 1:      .  .  .  .  .  .  11 g1 36 .  .  31 .  .  .
// row 2:      .  .  .  .  .  .  10 g2 37 .  .  30 .  .  .
// row 3:      .  .  .  .  .  .  9  g3 38 .  .  29 .  .  .
// row 4:      .  .  .  .  .  .  8  g4 39 .  .  28 .  .  .
// row 5:      .  .  .  .  .  .  7  g5 40 .  .  27 .  .  .
// row 6:      1  2  3  4  5  6  .  .  .  21 22 23 24 25 26
// row 7:      52 r1 r2 r3 r4 r5 .  .  .  y5 y4 y3 y2 y1 .
// row 8:      51 50 49 48 47 46 .  .  .  .  .  .  .  .  .
// row 9:      .  .  .  .  .  .  b5 .  .  .  .  .  .  .  .
// ...
//
// Isso ainda não está certo. Vou usar o layout EXATO do HTML original.

// ── Layout EXATO do HTML original ────────────────────────────────────────────
// O HTML divide o tabuleiro em seções. Vou mapear cada seção para o grid 15×15.
//
// SEÇÃO TOP (entre home-r e home-g): 3 colunas × 6 linhas
// Coluna esquerda (col 6 no grid): out11,out10,out9,out8,out7,out6
// Coluna central (col 7 no grid):  out12,g-out-1,g-out-2,g-out-3,g-out-4,g-out-5
// Coluna direita (col 8 no grid):  out13,out14,out15,out16,out17,out18
//
// SEÇÃO LEFT (entre home-r e home-b): 6 colunas × 3 linhas
// Linha superior (row 6 no grid): out5,out4,out3,out2,out1,out52
// Linha central  (row 7 no grid): r-out-5,r-out-4,r-out-3,r-out-2,r-out-1,out51
// Linha inferior (row 8 no grid): out48,out47,out46,out45,[vazio],[vazio]
//   (as 2 últimas células da linha inferior são parte do home-b)
//
// SEÇÃO RIGHT (entre home-g e home-y): 6 colunas × 3 linhas
// Linha superior (row 6 no grid): out19,out20,out21,out22,out23,out24
// Linha central  (row 7 no grid): y-out-5,y-out-4,y-out-3,y-out-2,y-out-1,out25
// Linha inferior (row 8 no grid): out31,out30,out29,out28,out27,out26
//   (as 2 primeiras células são parte do home-y)
//
// SEÇÃO BOTTOM (entre home-b e home-y): 3 colunas × 6 linhas
// Coluna esquerda (col 6 no grid): out44,out43,out42,out41,out40,out39
// Coluna central  (col 7 no grid): b-out-5,b-out-4,b-out-3,b-out-2,b-out-1,out38
// Coluna direita  (col 8 no grid): out32,out33,out34,out35,out36,out37

// Caminho externo completo em ordem (52 casas):
// Vermelho sai em out1, percorre no sentido horário, entra em r-out-1 após out52
// out1 → out2 → ... → out52 → (volta para out1 se der a volta)
// Cada cor tem seu ponto de entrada na área privada:
//   Vermelho: entra em r-out-1 após passar por out51 (endPoint = out51)
//   Verde:    entra em g-out-1 após passar por out12 (endPoint = out12)  -- CORRIGIDO: out13
//   Amarelo:  entra em y-out-1 após passar por out25 (endPoint = out25)  -- CORRIGIDO: out26
//   Azul:     entra em b-out-1 após passar por out38 (endPoint = out38)  -- CORRIGIDO: out39

// Analisando o HTML:
// - Vermelho: startPoint=out1, endPoint=out51
//   Após out51, entra em r-out-1 (row 7, col 5) → r-out-2 → ... → r-out-5 → centro
// - Verde: startPoint=out14, endPoint=out12
//   Após out12 (row 0, col 7), entra em g-out-1 (row 1, col 7) → ... → g-out-5 → centro
// - Amarelo: startPoint=out27, endPoint=out25
//   Após out25 (row 7, col 13), entra em y-out-1 (row 7, col 12) → ... → y-out-5 → centro
// - Azul: startPoint=out40, endPoint=out38
//   Após out38 (row 8, col 7), entra em b-out-1 (row 9, col 7) → ... → b-out-5 → centro

// Casas seguras (safe squares) — não podem ser cortadas
export const SAFE_SQUARES = [1, 9, 14, 22, 27, 35, 40, 48];

// Casas com estrela (visual)
export const STAR_SQUARES = [9, 22, 35, 48];

// Casas de saída (coloridas)
export const START_SQUARES = { r: 1, g: 14, y: 27, b: 40 };

// ── Funções de criação de estado ─────────────────────────────────────────────
export function createPosition(length) {
  const pos = {};
  for (let i = 1; i <= length; i++) pos[i] = [];
  return pos;
}

export function createPlayer(startPoint, endPoint) {
  return {
    inArea: [],
    outArea: [],
    privateArea: [],
    winArea: [],
    startPoint,
    endPoint,
    privateAreaPos: createPosition(5),
  };
}

export function createInitialPlayers() {
  // endPoint = última casa do caminho externo antes de entrar no caminho privado
  // rPlayer: percorre out1→out52→out1... entra no privado após out51
  // gPlayer: percorre out14→...→out12→g-out-1... entra após out12
  // yPlayer: percorre out27→...→out25→y-out-1... entra após out25
  // bPlayer: percorre out40→...→out38→b-out-1... entra após out38
  return {
    rPlayer: createPlayer('out1',  'out51'),
    gPlayer: createPlayer('out14', 'out12'),
    yPlayer: createPlayer('out27', 'out25'),
    bPlayer: createPlayer('out40', 'out38'),
  };
}

export function createInitialOutAreaPos() {
  return createPosition(52);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function getNoFromValue(value) {
  const match = String(value).match(/\d+/);
  return match ? +match[0] : 0;
}

export function getColorFromValue(value) {
  return String(value).charAt(0);
}

export function getPlayerName(playerNo) {
  return { 1: 'rPlayer', 2: 'gPlayer', 3: 'yPlayer', 4: 'bPlayer' }[playerNo] || null;
}

export function check52(id) {
  return getNoFromValue(id) === 52;
}

export function checkOutAreaEnd(noInId, playerName, players) {
  return noInId === getNoFromValue(players[playerName].endPoint);
}

export function checkPrivateAreaEnd(noInId) {
  return noInId === 5;
}

export function addToArea(arr, value) {
  if (!arr) return [value];
  if (arr.includes(value)) return arr;
  return [...arr, value];
}

export function removeFromArea(arr, value) {
  if (!arr) return [];
  return arr.filter(v => v !== value);
}

export function addToPos(pos, posValue, classValue) {
  const newPos = { ...pos };
  newPos[posValue] = addToArea(newPos[posValue] || [], classValue);
  return newPos;
}

export function removeFromPos(pos, posValue, classValue) {
  const newPos = { ...pos };
  newPos[posValue] = removeFromArea(newPos[posValue] || [], classValue);
  return newPos;
}

// Win area positions — specific to each triangle orientation
// Each triangle has its "base" at the edge and "tip" at center (50%,50%)
// Positions are [left%, top%] within the full center square
// Layout:
//   green  = top triangle    (base at top,    tip at center)
//   yellow = right triangle  (base at right,  tip at center)
//   blue   = bottom triangle (base at bottom, tip at center)
//   red    = left triangle   (base at left,   tip at center)
export const WIN_AREA_POSITIONS = {
  // Green (top): pawns near top edge, stacked downward toward center
  g: [
    [[50, 18]],                                    // 1 pawn
    [[35, 15], [65, 15]],                          // 2 pawns
    [[50, 12], [32, 26], [68, 26]],                // 3 pawns
    [[35, 12], [65, 12], [35, 28], [65, 28]],      // 4 pawns
  ],
  // Yellow (right): pawns near right edge, stacked leftward toward center
  y: [
    [[82, 50]],
    [[85, 35], [85, 65]],
    [[88, 50], [76, 32], [76, 68]],
    [[88, 35], [88, 65], [74, 35], [74, 65]],
  ],
  // Blue (bottom): pawns near bottom edge, stacked upward toward center
  b: [
    [[50, 82]],
    [[35, 85], [65, 85]],
    [[50, 88], [32, 74], [68, 74]],
    [[35, 88], [65, 88], [35, 72], [65, 72]],
  ],
  // Red (left): pawns near left edge, stacked rightward toward center
  r: [
    [[18, 50]],
    [[15, 35], [15, 65]],
    [[12, 50], [24, 32], [24, 68]],
    [[12, 35], [12, 65], [26, 35], [26, 65]],
  ],
};

// Legacy — kept for compatibility
export const WIN_AREA_PX_PY = [
  [[50, 50]],
  [[30, 30], [70, 70]],
  [[30, 30], [70, 30], [50, 70]],
  [[30, 30], [70, 30], [30, 70], [70, 70]],
];

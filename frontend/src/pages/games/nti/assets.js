// assets.js — helpers para recortar sprites

// ── pawns.png: 210×210, grid 4×4 ─────────────────────────────────────────────
// Linha 0 (y=0%):   azul   (b)
// Linha 1 (y=33%):  verde  (g)
// Linha 2 (y=66%):  vermelho (r)
// Linha 3 (y=100%): amarelo (y)
// Cada célula: 210/4 = 52.5px → background-size: 400% 400%
// posX: col * (100/3)  → 0%, 33.33%, 66.66%, 100%
// posY: row * (100/3)  → 0%, 33.33%, 66.66%, 100%

const PAWN_ROW = { b: 0, g: 1, r: 2, y: 3 };

export function getPawnStyle(color) {
  const row = PAWN_ROW[color] ?? 2;
  const posY = (row / 3) * 100;
  return {
    backgroundImage: 'url(/images/pawns.png)',
    backgroundSize: '400% 400%',
    backgroundRepeat: 'no-repeat',
    backgroundPositionX: '0%',
    backgroundPositionY: `${posY}%`,
  };
}


// ── dice_roll.png: 948×790, grid 6 cols × 5 rows ─────────────────────────────
// 30 frames de animação do dado girando
// posX: col * (100/5)  → 0%, 20%, 40%, 60%, 80%, 100%
// posY: row * (100/4)  → 0%, 25%, 50%, 75%, 100%

export function getDiceRollStyle(frame) {
  // frame: 0-29
  const col = frame % 6;
  const row = Math.floor(frame / 6);
  const posX = (col / 5) * 100;
  const posY = (row / 4) * 100;
  return {
    backgroundImage: 'url(/images/dice_roll.png)',
    backgroundSize: '600% 500%',
    backgroundRepeat: 'no-repeat',
    backgroundPositionX: `${posX}%`,
    backgroundPositionY: `${posY}%`,
  };
}

export const TOTAL_ROLL_FRAMES = 30;

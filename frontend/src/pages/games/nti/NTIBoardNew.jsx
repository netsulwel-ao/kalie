import React from 'react';
import { COLORS, WIN_AREA_POSITIONS, getColorFromValue } from './gameLogic';
import { getPawnStyle } from './assets';

// ── Animações CSS ─────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes pawnGlow {
    from { transform: scale(0.82); filter: brightness(0.9); }
    to   { transform: scale(1.18); filter: brightness(1.3) drop-shadow(0 0 6px rgba(255,220,50,0.9)); }
  }
  @keyframes pawnPulse {
    0%,100% { transform: scale(1); filter: brightness(1); }
    50%     { transform: scale(1.12); filter: brightness(1.2) drop-shadow(0 0 5px rgba(255,255,255,0.6)); }
  }
  @keyframes pawnBounce {
    0%  { transform: scale(1) translateY(0); }
    35% { transform: scale(1.3) translateY(-5px); }
    70% { transform: scale(0.95) translateY(1px); }
    100%{ transform: scale(1) translateY(0); }
  }
`;
let injected = false;
function injectStyles() {
  if (injected) return; injected = true;
  const el = document.createElement('style');
  el.textContent = STYLES;
  document.head.appendChild(el);
}
injectStyles();

// ── Paleta ────────────────────────────────────────────────────────────────────
const BOARD = {
  bg: '#1a1200', border: '#c8960c',
  cellBg: '#fdf6e3', cellBorder: '#c8960c44',
};

// ── Tabuleiro NTI angolano: 80 casas externas + 9 casas privadas por cor ──────
//
// Pista externa: out1..out80 (sentido horário)
//   out1  = saída Vermelho  (casa 0 do vermelho)
//   out21 = saída Amarelo   (casa 0 do amarelo)
//   out41 = saída Azul      (casa 0 do azul)
//   out61 = saída Verde     (casa 0 do verde)
//
// Entre cada saída: 20 casas (0..19, onde 0=saída e 20=próxima saída)
// Estrelas (casas seguras): out1, out8, out21, out28, out41, out48, out61, out68
//
// Corredor privado: 9 casas (I..IX em romano)
//   Vermelho entra após out15 → r-out-1..r-out-9
//   Amarelo  entra após out35 → y-out-1..y-out-9
//   Azul     entra após out55 → b-out-1..b-out-9
//   Verde    entra após out75 → g-out-1..g-out-9
//
// Grid visual: 23 colunas × 23 linhas
//   Cantos (9×9): casas base de cada cor
//   Faixas (5 células de largura): pista externa
//   Centro (5×5): área de vitória + corredores privados

// Cores e suas propriedades (ordem no tabuleiro: r=top-left, g=top-right, y=bottom-right, b=bottom-left)
// Saídas reais: out7(r), out16(g), out36(y), out76(b)
const COLOR_DEFS = {
  r: { name: 'red',    hex: COLORS.r, start: 7,  label: 'Vermelho' },
  g: { name: 'green',  hex: COLORS.g, start: 16, label: 'Verde'    },
  y: { name: 'yellow', hex: COLORS.y, start: 36, label: 'Amarelo'  },
  b: { name: 'blue',   hex: COLORS.b, start: 76, label: 'Azul'     },
};

// Casas seguras (estrelas):
//   Left strip   col 2, pos 5: out75  (paralela à saída vermelha out7)
//   Top strip    col 0, pos 5: out15  (paralela à saída verde out16) — também entrada corredor r
//   Right strip  col 0, pos 5: out35  (paralela à saída amarela out36) — também entrada corredor g
//   Bottom strip col 2, pos 5: out66  (paralela à saída azul out76)
const SAFE = new Set([74, 15, 35, 57, 25, 47]);

// Numeração romana para o corredor privado
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX'];

// ── Peão ──────────────────────────────────────────────────────────────────────
function Pawn({ cls, isGlowing, onClick }) {
  const color = getColorFromValue(cls);
  const spriteStyle = getPawnStyle(color);
  return (
    <div
      onClick={onClick}
      title={cls}
      style={{
        width: '85%', height: '85%', borderRadius: '50%',
        cursor: isGlowing ? 'pointer' : 'default',
        animation: isGlowing ? 'pawnGlow 0.5s ease-in-out infinite alternate' : 'none',
        ...spriteStyle, backgroundSize: '400% 400%',
      }}
    />
  );
}

// ── Célula genérica ───────────────────────────────────────────────────────────
function Cell({ id, bg, label, labelColor, isStar, isStartCell, mapColor, pawns = [], glowPawns = [], onPawnClick, onCellClick }) {
  const count = pawns.length;
  const isHighlighted = pawns.some(p => glowPawns.includes(p));

  return (
    <div
      onClick={() => onCellClick && onCellClick(id)}
      style={{
        background: mapColor || bg || BOARD.cellBg,
        border: mapColor ? `2px solid rgba(255,255,255,0.6)` : `1px solid ${BOARD.cellBorder}`,
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexWrap: 'wrap', overflow: 'hidden',
        width: '100%', height: '100%', boxSizing: 'border-box',
        cursor: onCellClick ? 'pointer' : 'default',
        boxShadow: isHighlighted ? 'inset 0 0 6px 2px rgba(255,220,50,0.6)' : 'none',
      }}>
      {/* Label da casa */}
      {label !== undefined && (isStartCell || count === 0) && !isStar && (
        <div style={{
          position: 'absolute',
          ...(isStartCell ? {
            inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace",
            color: labelColor || 'rgba(255,255,255,0.95)',
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            pointerEvents: 'none', userSelect: 'none',
          } : {
            bottom: 1, right: 2,
            fontSize: '6px', lineHeight: 1, fontFamily: 'monospace', fontWeight: 700,
            color: labelColor || 'rgba(0,0,0,0.4)', pointerEvents: 'none', userSelect: 'none',
          }),
        }}>{label}</div>
      )}
      {/* Número de ordem do mapeamento */}
      {mapColor && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 900, color: 'rgba(255,255,255,0.95)',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          pointerEvents: 'none', userSelect: 'none',
        }}>{label}</div>
      )}
      {/* Estrela — só nas casas seguras que não são saídas */}
      {isStar && count === 0 && !mapColor && (
        <div style={{
          position: 'absolute', inset: '8%',
          backgroundImage: 'url(/images/star2.png)',
          backgroundSize: 'contain', backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center', opacity: 0.55, pointerEvents: 'none',
        }} />
      )}
      {/* Peões */}
      {pawns.map(cls => (
        <div key={cls} style={{
          width: count === 1 ? '82%' : count <= 4 ? '48%' : '33%',
          height: count === 1 ? '82%' : count <= 4 ? '48%' : '33%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Pawn cls={cls} isGlowing={glowPawns.includes(cls)} onClick={() => onPawnClick(cls)} />
        </div>
      ))}
    </div>
  );
}

// ── Casa larga de entrada no corredor (ocupa as 3 colunas/linhas da faixa) ───
// É a última casa externa antes do corredor privado de cada cor.
// Visualmente ocupa toda a largura/altura da faixa (span 3).
// out15 e out35 são também casas seguras (estrelas).
// Seta de entrada por cor: aponta na direção em que a peça entra no corredor
const WIDE_ARROW = { r: '→', g: '↓', y: '←', b: '↑' };

function WideEntryCell({ id, colorChar, label, cellContents, glowPawns, onPawnClick, onCellClick, mapEntry }) {
  const def = COLOR_DEFS[colorChar];
  const pawns = cellContents[id] || [];
  const count = pawns.length;
  const isHighlighted = pawns.some(p => glowPawns.includes(p));
  const arrow = WIDE_ARROW[colorChar];

  return (
    <div
      onClick={() => onCellClick && onCellClick(id)}
      style={{
        background: mapEntry ? mapEntry.color : BOARD.cellBg,
        border: mapEntry ? `2px solid rgba(255,255,255,0.6)` : `2px solid ${def.hex}`,
        borderRadius: 4,
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexWrap: 'wrap', overflow: 'hidden',
        width: '100%', height: '100%', boxSizing: 'border-box',
        cursor: onCellClick ? 'pointer' : 'default',
        boxShadow: isHighlighted
          ? `inset 0 0 8px 3px rgba(255,220,50,0.7)`
          : mapEntry ? 'none' : `inset 0 0 6px 1px ${def.hex}55`,
      }}>
      {mapEntry ? (
        <div style={{
          fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.95)',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          pointerEvents: 'none', userSelect: 'none',
        }}>{mapEntry.order}</div>
      ) : (
        <>
          {count === 0 && (
            <div style={{
              position: 'absolute', bottom: 2, right: 4,
              fontSize: '7px', fontFamily: 'monospace', fontWeight: 700,
              color: 'rgba(0,0,0,0.35)', pointerEvents: 'none', userSelect: 'none',
            }}>{label}</div>
          )}
          {count === 0 && (
            <div style={{
              fontSize: '22px', opacity: 0.6, color: def.hex,
              fontWeight: 900, pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
            }}>{arrow}</div>
          )}
        </>
      )}
      {pawns.map(cls => (
        <div key={cls} style={{
          width: count === 1 ? '60%' : count <= 4 ? '28%' : '22%',
          height: count === 1 ? '60%' : count <= 4 ? '80%' : '60%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Pawn cls={cls} isGlowing={glowPawns.includes(cls)} onClick={() => onPawnClick(cls)} />
        </div>
      ))}
    </div>
  );
}
// ── Casa base (home) ──────────────────────────────────────────────────────────
function HomeBase({ colorChar, inAreaContents, glowPawns, onPawnClick }) {
  const def = COLOR_DEFS[colorChar];
  const bg = def.hex;
  return (
    <div style={{
      background: `radial-gradient(ellipse at 30% 30%, ${bg}dd, ${bg}ff)`,
      width: '100%', height: '100%', padding: '10%', boxSizing: 'border-box',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
      gap: '8%', border: `3px solid ${BOARD.border}`,
    }}>
      {[1,2,3,4].map(i => {
        const cls = `${colorChar}-pawn${i}`;
        const hasPawn = inAreaContents[`${colorChar}-${i}`];
        return (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.22)', borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.25)',
          }}>
            {hasPawn && (
              <Pawn cls={cls} isGlowing={glowPawns.includes(cls)} onClick={() => onPawnClick(cls)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Célula privada (corredor colorido) ────────────────────────────────────────
function PrivateCell({ id, colorChar, privateCellContents, glowPawns, onPawnClick, onCellClick, mapEntry }) {
  const def = COLOR_DEFS[colorChar];
  const pawns = privateCellContents[id] || [];
  const count = pawns.length;
  const stepMatch = id.match(/-out-(\d+)$/);
  const stepNo = stepMatch ? parseInt(stepMatch[1]) : null;
  const romanLabel = stepNo !== null ? ROMAN[stepNo - 1] : null;
  const isHighlighted = pawns.some(p => glowPawns.includes(p));

  return (
    <div
      onClick={() => onCellClick && onCellClick(id)}
      style={{
        background: mapEntry ? mapEntry.color : def.hex,
        border: mapEntry ? `2px solid rgba(255,255,255,0.6)` : `1px solid ${BOARD.cellBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexWrap: 'wrap', width: '100%', height: '100%',
        boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
        cursor: onCellClick ? 'pointer' : 'default',
        boxShadow: isHighlighted ? 'inset 0 0 6px 2px rgba(255,220,50,0.7)' : 'none',
      }}>
      {(mapEntry ? (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 900, color: 'rgba(255,255,255,0.95)',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          pointerEvents: 'none', userSelect: 'none',
        }}>{mapEntry.order}</div>
      ) : (romanLabel && count === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: '8px', fontWeight: 900, color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Georgia, serif', pointerEvents: 'none', userSelect: 'none',
        }}>{romanLabel}</div>
      )))}
      {pawns.map(cls => (
        <div key={cls} style={{
          width: count === 1 ? '82%' : '50%', height: count === 1 ? '82%' : '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Pawn cls={cls} isGlowing={glowPawns.includes(cls)} onClick={() => onPawnClick(cls)} />
        </div>
      ))}
    </div>
  );
}

// ── Centro (vitória) ──────────────────────────────────────────────────────────
function CenterArea({ winCellContents }) {
  const triangles = [
    { c: 'g', clip: 'polygon(0% 0%, 100% 0%, 50% 50%)' },
    { c: 'y', clip: 'polygon(100% 0%, 100% 100%, 50% 50%)' },
    { c: 'b', clip: 'polygon(0% 100%, 100% 100%, 50% 50%)' },
    { c: 'r', clip: 'polygon(0% 0%, 0% 100%, 50% 50%)' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', border: `3px solid ${BOARD.border}` }}>
      {triangles.map(({ c, clip }) => {
        const pawns = winCellContents[c] || [];
        const count = pawns.length;
        const positions = WIN_AREA_POSITIONS[c]?.[Math.min(count, 4) - 1] || [[50, 50]];
        return (
          <div key={c} style={{ position: 'absolute', inset: 0, background: COLORS[c], clipPath: clip }}>
            {pawns.map((cls, i) => {
              const pos = positions[i] || positions[positions.length - 1] || [50, 50];
              return (
                <div key={cls} style={{
                  position: 'absolute', left: `${pos[0]}%`, top: `${pos[1]}%`,
                  transform: 'translate(-50%,-50%)', width: '22%', height: '22%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))', zIndex: 2,
                }}>
                  <Pawn cls={cls} isGlowing={false} onClick={() => {}} />
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)', width: '30%', height: '30%',
        backgroundImage: 'url(/images/star2.png)', backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
        zIndex: 3, filter: 'drop-shadow(0 0 4px rgba(255,200,0,0.8))',
      }} />
    </div>
  );
}

// ── Tabuleiro principal ───────────────────────────────────────────────────────
//
// Layout do grid (23×23 células):
//
//  [home-r 9×9] [top-strip 5×9]    [home-y 9×9]
//  [left-strip 9×5] [center 5×5]   [right-strip 9×5]
//  [home-b 9×9] [bottom-strip 5×9] [home-g 9×9]
//
// Faixas externas têm 5 células de largura (3 colunas: esq, centro, dir)
// Cada lado tem 20 casas distribuídas nas 3 colunas × N linhas
//
// Top strip (entre home-r e home-y): 3 cols × 9 linhas
//   col esq (col 9):  out20, out19, out18, out17, out16, out15, out14, out13, out12
//   col mid (col 10): out21(saída y), y-out-1..y-out-8  [corredor amarelo]
//   col dir (col 11): out22, out23, out24, out25, out26, out27, out28, out29, out30
//   (mas temos 3 colunas de 5 células = 15 células, precisamos de 20 casas por lado)
//
// Vamos usar 5 colunas × 9 linhas para cada faixa:
//   Top:    cols 9-13, rows 0-8   (20 casas + corredor)
//   Right:  cols 14-22, rows 9-13 (20 casas + corredor)
//   Bottom: cols 9-13, rows 14-22 (20 casas + corredor)
//   Left:   cols 0-8, rows 9-13   (20 casas + corredor)
//
// Simplificação: usar grid CSS com proporções fixas

export default function NTIBoard({ state, onPawnClick, mapCells = {}, onCellClick = null }) {
  const {
    cellContents = {}, privateCellContents = {}, winCellContents = {},
    inAreaContents = {}, glowPawns = [],
  } = state;

  // ── Mapa de labels — percurso horário completo ───────────────────────────
  // out7(r=0)→out8(1)→...→out15(8,larga-r)
  // out16(g=0)→out17(1)→...→out35(19,larga-g)
  // out36(y=0)→out37(1)→...→out75(39,larga-y)
  // out76(b=0)→out77(1)→...→out80(4)→out1(5)→...→out6(10,larga-b)
  const LABEL_MAP = {};
  // Vermelho: out7..out15 → 0..8
  for (let i = 0; i <= 8; i++)  LABEL_MAP[7 + i] = i;
  // Verde: out16..out35 → 0..19
  for (let i = 0; i <= 19; i++) LABEL_MAP[16 + i] = i;
  // Amarelo: out36..out75 → 0..39
  for (let i = 0; i <= 39; i++) LABEL_MAP[36 + i] = i;
  // Azul: out76..out80 → 0..4, out1..out6 → 5..10
  for (let i = 0; i <= 4; i++)  LABEL_MAP[76 + i] = i;
  for (let i = 1; i <= 6; i++)  LABEL_MAP[i] = 4 + i;

  function getCellBg(outNo) {
    // Casas de saída — pintadas com a cor sólida do jogador
    if (outNo === START_CELLS.r) return COLORS.r;  // out7  = saída vermelho
    if (outNo === START_CELLS.g) return COLORS.g;  // out16 = saída verde
    if (outNo === START_CELLS.y) return COLORS.y;  // out36 = saída amarelo
    if (outNo === START_CELLS.b) return COLORS.b;  // out76 = saída azul
    return BOARD.cellBg;
  }

  function renderOut(outNo) {
    const id = `out${outNo}`;
    const pawns = cellContents[id] || [];
    const isStart = Object.values(START_CELLS).includes(outNo);
    const isStar  = SAFE.has(outNo) && !isStart;
    const mapEntry = mapCells[id];
    const label = mapEntry
      ? String(mapEntry.order)
      : isStart ? '0' : (LABEL_MAP[outNo] !== undefined ? String(LABEL_MAP[outNo]) : '');
    const labelColor = isStart ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.4)';

    return (
      <Cell
        key={id}
        id={id}
        bg={getCellBg(outNo)}
        label={label}
        labelColor={labelColor}
        isStar={isStar}
        isStartCell={isStart && !mapEntry}
        mapColor={mapEntry?.color || null}
        pawns={pawns}
        glowPawns={glowPawns}
        onPawnClick={onPawnClick}
        onCellClick={onCellClick}
      />
    );
  }

  function renderPrivate(colorChar, step) {
    const id = `${colorChar}-out-${step}`;
    const mapEntry = mapCells[id];
    return (
      <PrivateCell
        key={id} id={id} colorChar={colorChar}
        privateCellContents={privateCellContents}
        glowPawns={glowPawns}
        onPawnClick={onPawnClick}
        onCellClick={onCellClick}
        mapEntry={mapEntry}
      />
    );
  }

  // ── Saídas reais (casas externas pintadas com a cor) ─────────────────────
  const START_CELLS = { r: 7, g: 16, y: 36, b: 76 };

  // ══════════════════════════════════════════════════════════════════════════
  // PERCURSO SENTIDO HORÁRIO (80 casas):
  //
  // LEFT strip (horizontal, 3 rows × 10 cols):
  //   row 0 (topo):  percurso VERMELHO saindo da saída (out7) em direção à borda
  //                  e depois voltando pelo topo até à casa larga
  //   row 1 (meio):  corredor vermelho r-out-1..9 (I=borda, IX=centro)
  //   row 2 (baixo): percurso AZUL vindo do centro (após out6 larga) em direção à borda
  //
  // Percurso vermelho no left strip (sentido horário = da saída out7 para a esquerda):
  //   out7(saída,col5) → out8(col6) → out9(col7) → out10(col8) → out11(col9)
  //   depois vira no canto e sobe pelo top strip
  //   vindo do top: out15(larga,col0) ← out14(col1) ← out13(col2) ← out12(col3)
  //   Mas a casa larga está na col0 e out7 na col5 — o percurso vai:
  //   [WIDE out15] | out12 | out13 | out14 | out7(saída) | out8 | out9 | out10 | out11 | [→ top]
  //
  // Percurso azul no left strip (sentido horário = vindo do bottom, indo para a direita):
  //   [WIDE out6] | out1 | out2 | out3 | out4 | out5 | out77... wait
  //   Azul sai de out76(bottom), vai para out77,out78,out79,out80 (bottom col0)
  //   depois entra no left strip row2: out80→...→out70
  //   Mas out80 está no bottom. O left strip row2 contém: out70..out75(estrela)..out77..
  //
  // SIMPLIFICAÇÃO FINAL — mapeamento direto baseado na posição visual confirmada:
  //
  // LEFT strip row0 (da esquerda=borda para direita=centro):
  //   [WIDE-r] | out12 | out13 | out14 | out7(saída-r) | out8 | out9 | out10 | out11 | →top
  //
  // LEFT strip row2 (da esquerda=borda para direita=centro):
  //   [WIDE-b] | out5 | out4 | out3 | out2 | out1 | out80 | out79 | out78 | →bottom
  //   (azul vem do bottom strip, entra no left pela direita e vai para a esquerda/borda)
  //   Sentido horário: azul sai de out76, vai out77→out78→out79→out80→out1→out2→out3→out4→out5→out6(larga)
  //   No left strip row2, da direita(centro) para esquerda(borda):
  //   out80(col9) | out79(col8) | out78(col7) | out77(col6) | out76... wait out76 está no bottom
  //   Então left row2: out80 | out79 | out78 | out77 | out75(estrela) | out74 | out73 | out72 | out71 | out70
  //   (out76 está no bottom, out75 é estrela no left)
  //
  // LEFT strip row1 (corredor vermelho, I=borda/col1, IX=centro/col9):
  //   [WIDE] | r-out-1(I) | r-out-2 | ... | r-out-9(IX)
  //
  // ══════════════════════════════════════════════════════════════════════════

  // LEFT strip: col0=borda(esq), col9=centro(dir)
  // row0: [WIDE-r] out12 out13 out14 out7(saída) out8 out9 out10 out11
  // row1: [WIDE]   r-I   r-II  r-III r-IV        r-V  r-VI r-VII r-VIII r-IX
  // row2: [WIDE-b] out5  out4  out3  out2         out1 out80 out79 out78 out77... wait
  // Azul no left row2 vem da direita (centro) para esquerda (borda):
  // col9=out80, col8=out79, col7=out78, col6=out77, col5=out75(estrela), col4=out74, col3=out73, col2=out72, col1=out71
  // col0=[WIDE-b out6] — mas out6 é a casa larga do BOTTOM, não do left!
  // O left strip row2 não tem casa larga — apenas casas normais do percurso azul.
  // A casa larga azul (out6) está no BOTTOM strip.
  //
  // Revisão: cada faixa tem UMA casa larga (a da sua própria cor de corredor):
  //   LEFT  → corredor vermelho → casa larga vermelha (out15)
  //   TOP   → corredor verde   → casa larga verde (out35)
  //   RIGHT → corredor amarelo → casa larga amarela (out75)
  //   BOTTOM→ corredor azul    → casa larga azul (out6)
  //
  // As outras rows da faixa são percursos de outras cores — sem casa larga.

  const leftStrip = [
    { type: 'wide1',  colorChar: 'r', outNo: 15, label: '8' },
    { type: 'normal', ids: ['out14', 'r-out-1', 'out71'] },
    { type: 'normal', ids: ['out13', 'r-out-2', 'out72'] },
    { type: 'normal', ids: ['out12', 'r-out-3', 'out73'] },
    { type: 'normal', ids: ['out7',  'r-out-4', 'out74'] },
    { type: 'normal', ids: ['out8',  'r-out-5', 'out56'] },
    { type: 'normal', ids: ['out9',  'r-out-6', 'out77'] },
    { type: 'normal', ids: ['out10', 'r-out-7', 'out78'] },
    { type: 'normal', ids: ['out11', 'r-out-8', 'out79'] },
    { type: 'normal', ids: ['out30', 'r-out-9', 'out80'] },
  ];
  // Percurso vermelho row0 (esq→dir): out14,out13,out12,out7(saída),out8,out9,out10,out11,out30
  // Percurso azul row2 (esq→dir): out71,out72,out73,out74,out56,out77,out78,out79,out80
  // Corredor vermelho row1 (esq=I, dir=IX): r-out-1..r-out-9

  // TOP: percurso horário entra pelo canto topo-esq (vindo de out30 no left)
  // col0 de cima(borda) para baixo(centro): out20,out19,out18,out17,out25(estrela),out31,out32,out33,out34
  // col2 de cima(borda) para baixo(centro): out21,out22,out23,out24,out16(saída-g),out26,out27,out28,out29
  // Percurso: entra em out30(left col9 row0) → sobe pelo top col0 de baixo para cima:
  //   out34→out33→out32→out31→out25→out17→out18→out19→out20 → vira na larga (out35) →
  //   desce pelo top col2 de cima para baixo: out21→out22→out23→out24→out16→out26→out27→out28→out29
  // Então col0 deve estar em ordem INVERSA (out34 em cima, out20 em baixo):
  const topStrip = [
    { type: 'wide1',  colorChar: 'g', outNo: 35, label: '19' },
    { type: 'normal', ids: ['out34', 'g-out-1', 'out21'] },
    { type: 'normal', ids: ['out33', 'g-out-2', 'out22'] },
    { type: 'normal', ids: ['out32', 'g-out-3', 'out23'] },
    { type: 'normal', ids: ['out31', 'g-out-4', 'out24'] },
    { type: 'normal', ids: ['out25', 'g-out-5', 'out16'] },
    { type: 'normal', ids: ['out17', 'g-out-6', 'out26'] },
    { type: 'normal', ids: ['out18', 'g-out-7', 'out27'] },
    { type: 'normal', ids: ['out19', 'g-out-8', 'out28'] },
    { type: 'normal', ids: ['out20', 'g-out-9', 'out29'] },
  ];
  // Percurso: out30(left)→out34(top col0 row0)→...→out20(top col0 row8)→out35(larga)→out21(top col2 row0)→...→out29(top col2 row8)→right

  // RIGHT: percurso horário entra pelo canto topo-dir (vindo de out29 no top col2)
  // row0 de esq(centro) para dir(borda): out51,out50,out49,out48,out47,out46,out45,out44,out43
  // row2 de esq(centro) para dir(borda): out52,out53,out54,out55,out36(saída-y),out37,out38,out39,out40
  // Percurso: entra em out29(top col2 row8) → right row0 col0=out51 → ... → col8=out43 → larga(out75) →
  //   right row2 col8=out40 → ... → col0=out52 → sai para bottom
  // Mas o mapeamento mostra right row2 indo out40→out39→...→out36→out55→out54→out53→out52
  // Isso significa que row2 vai da DIREITA para a ESQUERDA (col8→col0)
  // Para que o percurso seja contínuo: entra pela larga (col9), vai col8→col7→...→col0
  // Então row2 deve ter: col0=out52, col1=out53, ..., col4=out36, ..., col8=out40
  // E o percurso visual vai col8(out40)→col7(out39)→...→col0(out52) — correto com a ordem atual ✅
  const rightStrip = [
    { type: 'normal', ids: ['out51', 'y-out-9', 'out52'] },
    { type: 'normal', ids: ['out50', 'y-out-8', 'out53'] },
    { type: 'normal', ids: ['out49', 'y-out-7', 'out54'] },
    { type: 'normal', ids: ['out48', 'y-out-6', 'out55'] },
    { type: 'normal', ids: ['out47', 'y-out-5', 'out36'] },
    { type: 'normal', ids: ['out46', 'y-out-4', 'out37'] },
    { type: 'normal', ids: ['out45', 'y-out-3', 'out38'] },
    { type: 'normal', ids: ['out44', 'y-out-2', 'out39'] },
    { type: 'normal', ids: ['out43', 'y-out-1', 'out40'] },
    { type: 'wide1',  colorChar: 'y', outNo: 75, label: '39' },
  ];
  // Percurso: out29(top)→out51(right row0 col0)→...→out43(col8)→out75(larga)→out40(row2 col8)→...→out52(col0)→bottom

  // BOTTOM: percurso horário entra pelo canto baixo-dir (vindo de out52 no right row2)
  // col2 de cima(centro) para baixo(borda): out70,out69,out68,out67,out66,out57,out58,out59,out60
  // col0 de cima(centro) para baixo(borda): out61,out62,out63,out64,out65,out76(saída-b),out1,out2,out3
  // Percurso: entra em out52(right row2 col0) → bottom col2 row0=out70 → ... → row8=out60 → larga(out6) →
  //   bottom col0 row8=out3 → ... → row0=out61 → sai para left
  // Mas o mapeamento mostra: out70→out69→...→out66→out57→...→out60→out6(larga)→out3→out2→out1→out76→out65→...→out61
  // Isso significa col2 vai de cima(out70) para baixo(out60) ✅
  // E col0 vai de baixo(out3) para cima(out61) — ou seja col0 está em ordem INVERSA no percurso
  // Para que o percurso seja contínuo após a larga: out6(larga)→out3(col0 row8)→out2(row7)→...→out61(row0)
  // Então col0 deve ter: row0=out61, row1=out62, ..., row5=out76, row6=out1, row7=out2, row8=out3
  // E o percurso visual vai row8(out3)→row7(out2)→...→row0(out61) — correto com a ordem atual ✅
  const bottomStrip = [
    { type: 'normal', ids: ['out61', 'b-out-9', 'out70'] },
    { type: 'normal', ids: ['out62', 'b-out-8', 'out69'] },
    { type: 'normal', ids: ['out63', 'b-out-7', 'out68'] },
    { type: 'normal', ids: ['out64', 'b-out-6', 'out67'] },
    { type: 'normal', ids: ['out65', 'b-out-5', 'out66'] },
    { type: 'normal', ids: ['out76', 'b-out-4', 'out57'] },
    { type: 'normal', ids: ['out1',  'b-out-3', 'out58'] },
    { type: 'normal', ids: ['out2',  'b-out-2', 'out59'] },
    { type: 'normal', ids: ['out3',  'b-out-1', 'out60'] },
    { type: 'wide1',  colorChar: 'b', outNo: 6, label: '10' },
  ];
  // Percurso: out52(right)→out70(bottom col2 row0)→...→out60(row8)→out6(larga)→out3(col0 row8)→...→out61(row0)→left

  // ── Renderização das faixas ───────────────────────────────────────────────
  // isHorizontal=true  → left/right strip: colunas no eixo X, 3 linhas no eixo Y
  // isHorizontal=false → top/bottom strip: linhas no eixo Y, 3 colunas no eixo X
  //
  // Para a casa larga (wide2):
  //   horizontal: ocupa 1 coluna × span 3 linhas → gridRow: 'span 3'
  //   vertical:   ocupa span 3 colunas × 1 linha → gridColumn: 'span 3'
  //
  // Usamos CSS Grid com template explícito:
  //   horizontal: gridTemplateRows: '1fr 1fr 1fr', gridAutoFlow: 'column'
  //   vertical:   gridTemplateColumns: '1fr 1fr 1fr', gridAutoFlow: 'row'

  function renderStrip(strip, isHorizontal) {
    if (isHorizontal) {
      // Left / Right strip: cada elemento do array é uma COLUNA
      // Grid: 3 linhas × N colunas
      return (
        <div style={{
          display: 'grid',
          gridTemplateRows: '1fr 1fr 1fr',
          gridAutoColumns: '1fr',
          gridAutoFlow: 'column',
          width: '100%', height: '100%',
        }}>
          {strip.map((col, ci) => {
            if (col.type === 'normal') {
              return col.ids.map((id, ri) => (
                <div key={`${ci}-${ri}`} style={{ minWidth: 0, minHeight: 0 }}>
                  {renderCellById(id)}
                </div>
              ));
            }
            if (col.type === 'wide1') {
              return (
                <div key={`wide-${ci}`} style={{ gridRow: 'span 3', minWidth: 0, minHeight: 0 }}>
                  <WideEntryCell
                    id={`out${col.outNo}`}
                    colorChar={col.colorChar}
                    label={col.label}
                    cellContents={cellContents}
                    glowPawns={glowPawns}
                    onPawnClick={onPawnClick}
                    onCellClick={onCellClick}
                    mapEntry={mapCells[`out${col.outNo}`]}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    } else {
      // Top / Bottom strip: cada elemento do array é uma LINHA
      // Grid: N linhas × 3 colunas
      return (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gridAutoRows: '1fr',
          gridAutoFlow: 'row',
          width: '100%', height: '100%',
        }}>
          {strip.map((row, ri) => {
            if (row.type === 'normal') {
              return row.ids.map((id, ci) => (
                <div key={`${ri}-${ci}`} style={{ minWidth: 0, minHeight: 0 }}>
                  {renderCellById(id)}
                </div>
              ));
            }
            if (row.type === 'wide1') {
              return (
                <div key={`wide-${ri}`} style={{ gridColumn: 'span 3', minWidth: 0, minHeight: 0 }}>
                  <WideEntryCell
                    id={`out${row.outNo}`}
                    colorChar={row.colorChar}
                    label={row.label}
                    cellContents={cellContents}
                    glowPawns={glowPawns}
                    onPawnClick={onPawnClick}
                    onCellClick={onCellClick}
                    mapEntry={mapCells[`out${row.outNo}`]}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }
  }

  function renderCellById(id) {
    if (!id) return <div style={{ width: '100%', height: '100%', background: BOARD.bg }} />;

    // Private cell
    if (id.includes('-out-')) {
      const colorChar = id.charAt(0);
      return renderPrivate(colorChar, parseInt(id.match(/-out-(\d+)/)[1]));
    }

    // External cell
    const no = parseInt(id.replace('out', ''));
    if (isNaN(no)) return <div style={{ width: '100%', height: '100%', background: BOARD.bg }} />;
    return renderOut(no);
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '38% 24% 38%',
      gridTemplateRows: '38% 24% 38%',
      width: '100%', aspectRatio: '1 / 1',
      background: BOARD.bg,
      border: `4px solid ${BOARD.border}`,
      borderRadius: 8, overflow: 'hidden',
      boxShadow: `0 0 40px rgba(200,150,12,0.35), 0 0 80px rgba(0,0,0,0.6)`,
    }}>
      {/* Row 1: home-r (top-left), top strip, home-g (top-right) */}
      <HomeBase colorChar="r" inAreaContents={inAreaContents} glowPawns={glowPawns} onPawnClick={onPawnClick} />
      {renderStrip(topStrip, false)}
      <HomeBase colorChar="g" inAreaContents={inAreaContents} glowPawns={glowPawns} onPawnClick={onPawnClick} />

      {/* Row 2: left strip, center, right strip */}
      {renderStrip(leftStrip, true)}
      <CenterArea winCellContents={winCellContents} />
      {renderStrip(rightStrip, true)}

      {/* Row 3: home-b (bottom-left), bottom strip, home-y (bottom-right) */}
      <HomeBase colorChar="b" inAreaContents={inAreaContents} glowPawns={glowPawns} onPawnClick={onPawnClick} />
      {renderStrip(bottomStrip, false)}
      <HomeBase colorChar="y" inAreaContents={inAreaContents} glowPawns={glowPawns} onPawnClick={onPawnClick} />
    </div>
  );
}

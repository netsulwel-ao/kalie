import React, { useMemo } from 'react';
import { COLORS, SAFE_SQUARES, STAR_SQUARES, WIN_AREA_PX_PY, WIN_AREA_POSITIONS, getColorFromValue, getNoFromValue } from './gameLogic';
import { getPawnStyle } from './assets';

// ── Injectar keyframes CSS necessários ───────────────────────────────────────
const LUDO_STYLES = `
  @keyframes pawnGlow {
    from { transform: scale(0.82); filter: brightness(0.9); }
    to   { transform: scale(1.18); filter: brightness(1.3) drop-shadow(0 0 6px rgba(255,220,50,0.9)); }
  }
  @keyframes pawnPulse {
    0%, 100% { transform: scale(1);    filter: brightness(1)   drop-shadow(0 0 0px transparent); }
    50%       { transform: scale(1.12); filter: brightness(1.2) drop-shadow(0 0 5px rgba(255,255,255,0.6)); }
  }
  @keyframes pawnBounce {
    0%   { transform: scale(1) translateY(0); }
    35%  { transform: scale(1.3) translateY(-5px); }
    70%  { transform: scale(0.95) translateY(1px); }
    100% { transform: scale(1) translateY(0); }
  }
  @keyframes pawnLand {
    0%   { transform: scale(1.2) translateY(-3px); }
    60%  { transform: scale(0.9) translateY(2px); }
    100% { transform: scale(1) translateY(0); }
  }
  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.7); }
  }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.textContent = LUDO_STYLES;
  document.head.appendChild(el);
}
injectStyles();

// ── Paleta dourada do tabuleiro ───────────────────────────────────────────────
const BOARD = {
  bg:         '#1a1200',
  border:     '#c8960c',
  cellBg:     '#fdf6e3',
  cellBorder: '#c8960c44',
  darkCell:   '#1a1200',
  stripBg:    '#fdf6e3',
};

// ── Peão usando sprite pawns.png ──────────────────────────────────────────────
function Pawn({ cls, isGlowing, isPulsing, isMoving, isLanding, onClick }) {
  const color = getColorFromValue(cls);
  const spriteStyle = getPawnStyle(color);

  let anim = 'none';
  if (isGlowing) anim = 'pawnGlow 0.5s ease-in-out infinite alternate';
  else if (isPulsing) anim = 'pawnPulse 1.1s ease-in-out infinite';
  else if (isLanding) anim = 'pawnLand 0.28s ease-out forwards';
  else if (isMoving) anim = 'pawnBounce 0.28s ease-in-out';

  return (
    <div
      onClick={onClick}
      title={cls}
      style={{
        width: '85%',
        height: '85%',
        borderRadius: '50%',
        cursor: isGlowing ? 'pointer' : 'default',
        position: 'relative',
        flexShrink: 0,
        animation: anim,
        transition: isGlowing || isPulsing ? 'none' : 'transform 0.15s ease',
        ...spriteStyle,
        backgroundSize: '400% 400%',
      }}
    />
  );
}

// ── Célula do tabuleiro ───────────────────────────────────────────────────────
function Cell({ id, bg, isStar, pawns = [], glowPawns = [], pulsePawns = [], movingPawn, movingStep, currentMovingCell, onPawnClick }) {
  const count = pawns.length;
  const isHighlighted = pawns.some(p => glowPawns.includes(p));

  // Cell number label: 0 = exit cell, 1-12 = steps after exit
  // out1=0, out2=1, ..., out13=12, out14=0, out15=1, ...
  const no = getNoFromValue(id);
  const isExternal = !id.includes('-out-') && no >= 1 && no <= 52;
  const cellLabel = isExternal ? ((no - 1) % 13) : null;
  // Exit cells (0) get special color treatment
  const isExitCell = cellLabel === 0;

  return (
    <div
      id={id}
      style={{
        background: bg || BOARD.cellBg,
        border: `1px solid ${BOARD.cellBorder}`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        transition: 'background 0.2s',
        boxShadow: isHighlighted ? 'inset 0 0 6px 2px rgba(255,220,50,0.6)' : 'none',
      }}
    >
      {/* Cell number label */}
      {cellLabel !== null && count === 0 && !isStar && (
        <div style={{
          position: 'absolute',
          bottom: 1,
          right: 2,
          fontSize: '7px',
          lineHeight: 1,
          color: isExitCell ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.45)',
          fontFamily: 'monospace',
          fontWeight: 700,
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          {cellLabel}
        </div>
      )}
      {/* Estrela */}
      {isStar && count === 0 && (
        <div style={{
          position: 'absolute', inset: '8%',
          backgroundImage: 'url(/images/star2.png)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          opacity: 0.55,
          pointerEvents: 'none',
        }} />
      )}
      {/* Peões */}
      {pawns.map((cls) => (
        <div
          key={movingPawn === cls ? `${cls}-step-${movingStep}` : cls}
          style={{
            width:  count === 1 ? '82%' : count === 2 ? '50%' : count <= 4 ? '48%' : '33%',
            height: count === 1 ? '82%' : count === 2 ? '50%' : count <= 4 ? '48%' : '33%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pawn
            cls={cls}
            isGlowing={glowPawns.includes(cls)}
            isPulsing={!glowPawns.includes(cls) && pulsePawns.includes(cls)}
            isMoving={movingPawn === cls}
            isLanding={movingPawn === cls && currentMovingCell === id}
            onClick={() => onPawnClick(cls)}
          />
        </div>
      ))}
    </div>
  );
}

// ── Casa base (home) ──────────────────────────────────────────────────────────
function HomeBase({ color, inAreaContents, glowPawns, pulsePawns = [], onPawnClick }) {
  const bg = COLORS[color];
  // Gradiente suave sobre a cor base
  const gradient = `radial-gradient(ellipse at 30% 30%, ${bg}dd, ${bg}ff)`;

  return (
    <div style={{
      background: gradient,
      width: '100%', height: '100%',
      padding: '12%',
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '10%',
      border: `3px solid ${BOARD.border}`,
    }}>
      {[1, 2, 3, 4].map(i => {
        const cls = `${color}-pawn${i}`;
        const hasPawn = inAreaContents[`${color}-${i}`];
        const isGlowing = glowPawns.includes(cls);
        return (
          <div
            key={i}
            id={`in-${color}-${i}`}
            style={{
              background: 'rgba(255,255,255,0.22)',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.25)',
            }}
          >
            {hasPawn && (
              <Pawn cls={cls} isGlowing={isGlowing} isPulsing={!isGlowing && pulsePawns.includes(cls)} isMoving={false} isLanding={false} onClick={() => onPawnClick(cls)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Centro (área de vitória) ──────────────────────────────────────────────────
// Grid layout:
//   [r-home]  [top-strip → g-out-*]  [g-home]
//   [left → r-out-*]  [CENTER]  [right → y-out-*]
//   [b-home]  [bottom → b-out-*]  [y-home]
//
// So the center triangles must point toward their color's home stretch:
//   top    → green  (g)
//   right  → yellow (y)
//   bottom → blue   (b)
//   left   → red    (r)
function CenterArea({ winCellContents }) {
  const triangles = [
    { color: 'g', clip: 'polygon(0% 0%, 100% 0%, 50% 50%)' },   // top → green
    { color: 'y', clip: 'polygon(100% 0%, 100% 100%, 50% 50%)' }, // right → yellow
    { color: 'b', clip: 'polygon(0% 100%, 100% 100%, 50% 50%)' }, // bottom → blue
    { color: 'r', clip: 'polygon(0% 0%, 0% 100%, 50% 50%)' },    // left → red
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', border: `3px solid ${BOARD.border}` }}>
      {triangles.map(({ color, clip }) => {
        const pawns = winCellContents[color] || [];
        const count = pawns.length;
        // Use per-color positions for correct triangle placement
        const colorPositions = WIN_AREA_POSITIONS[color];
        const positions = colorPositions
          ? (colorPositions[Math.min(count, 4) - 1] || colorPositions[0])
          : [[50, 50]];

        return (
          <div key={color} style={{
            position: 'absolute', inset: 0,
            background: COLORS[color],
            clipPath: clip,
          }}>
            {pawns.map((cls, i) => {
              const pos = positions[i] || positions[positions.length - 1] || [50, 50];
              return (
                <div key={cls} style={{
                  position: 'absolute',
                  left: `${pos[0]}%`, top: `${pos[1]}%`,
                  transform: 'translate(-50%,-50%)',
                  width: '22%', height: '22%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))',
                  zIndex: 2,
                }}>
                  <Pawn cls={cls} isGlowing={false} onClick={() => {}} />
                </div>
              );
            })}
          </div>
        );
      })}
      {/* Estrela central */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '30%', height: '30%',
        backgroundImage: 'url(/images/star2.png)',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        zIndex: 3,
        filter: 'drop-shadow(0 0 4px rgba(255,200,0,0.8))',
      }} />
    </div>
  );
}

// ── Célula privada (home stretch colorida) ────────────────────────────────────
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

function PrivateCell({ id, color, privateCellContents, glowPawns, pulsePawns = [], movingPawn, movingStep, currentMovingCell, onPawnClick }) {
  const pawns = privateCellContents[id] || [];
  const count = pawns.length;
  const isHighlighted = pawns.some(p => glowPawns.includes(p));

  // Extract the step number from id like "r-out-3" → 3
  const stepMatch = id.match(/-out-(\d+)$/);
  const stepNo = stepMatch ? parseInt(stepMatch[1]) : null;
  const romanLabel = stepNo !== null ? ROMAN[stepNo - 1] : null;

  return (
    <div id={id} style={{
      background: COLORS[color],
      border: `1px solid ${BOARD.cellBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexWrap: 'wrap',
      width: '100%', height: '100%',
      boxSizing: 'border-box', overflow: 'hidden',
      position: 'relative',
      boxShadow: isHighlighted ? 'inset 0 0 6px 2px rgba(255,220,50,0.7)' : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Roman numeral label — shown when cell is empty */}
      {romanLabel && count === 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          fontWeight: 900,
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Georgia, serif',
          letterSpacing: '0.5px',
          pointerEvents: 'none',
          userSelect: 'none',
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}>
          {romanLabel}
        </div>
      )}
      {pawns.map((cls) => (
        <div key={movingPawn === cls ? `${cls}-step-${movingStep}` : cls} style={{
          width: count === 1 ? '82%' : '50%',
          height: count === 1 ? '82%' : '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Pawn
            cls={cls}
            isGlowing={glowPawns.includes(cls)}
            isPulsing={!glowPawns.includes(cls) && pulsePawns.includes(cls)}
            isMoving={movingPawn === cls}
            isLanding={movingPawn === cls && currentMovingCell === id}
            onClick={() => onPawnClick(cls)}
          />
        </div>
      ))}
    </div>
  );
}

// ── Tabuleiro principal ───────────────────────────────────────────────────────
export default function LudoBoard({ state, onPawnClick }) {
  const {
    cellContents, privateCellContents, winCellContents, inAreaContents,
    glowPawns, pulsePawns = [], movingPawn, movingPath, movingStep,
  } = state;
  const trailCells = useMemo(() => {
    if (!movingPawn || !movingPath.length) return new Set();
    return new Set(movingPath.slice(0, movingStep));
  }, [movingPawn, movingPath, movingStep]);

  // Célula atual da peça em movimento
  const currentMovingCell = movingStep > 0 && movingPath.length > 0
    ? movingPath[movingStep - 1]
    : null;

  function getCellBg(id) {
    if (id === 'out1')  return COLORS.r;
    if (id === 'out14') return COLORS.g;
    if (id === 'out27') return COLORS.y;
    if (id === 'out40') return COLORS.b;
    if (trailCells.has(id)) return '#fff3a0';
    return BOARD.cellBg;
  }

  function renderCell(id) {
    if (!id) return null;
    const no = getNoFromValue(id);
    const isPrivate = id.includes('-out-');
    const isStar = STAR_SQUARES.includes(no) && !isPrivate;

    if (isPrivate) {
      const color = getColorFromValue(id);
      // During animation: inject moving pawn into current cell, remove from others
      const basePrivate = { ...privateCellContents };
      if (movingPawn && movingPath.length > 0) {
        // Remove moving pawn from all private cells
        for (const key in basePrivate) {
          if (basePrivate[key]?.includes(movingPawn)) {
            basePrivate[key] = basePrivate[key].filter(p => p !== movingPawn);
          }
        }
        // Add to current animated cell
        if (currentMovingCell === id) {
          basePrivate[id] = [...(basePrivate[id] || []), movingPawn];
        }
      }
      return (
        <PrivateCell
          id={id} color={color}
          privateCellContents={basePrivate}
          glowPawns={glowPawns}
          pulsePawns={pulsePawns}
          movingPawn={movingPawn}
          movingStep={movingStep}
          currentMovingCell={currentMovingCell}
          onPawnClick={onPawnClick}
        />
      );
    }

    // External cell
    let pawns = cellContents[id] || [];

    if (movingPawn && movingPath.length > 0) {
      // Remove moving pawn from its original cell
      if (pawns.includes(movingPawn)) {
        pawns = pawns.filter(p => p !== movingPawn);
      }
      // Add moving pawn to current animated cell
      if (currentMovingCell === id && !pawns.includes(movingPawn)) {
        pawns = [...pawns, movingPawn];
      }
    }

    return (
      <Cell
        id={id}
        bg={getCellBg(id)}
        isStar={isStar}
        pawns={pawns}
        glowPawns={glowPawns}
        pulsePawns={pulsePawns}
        movingPawn={movingPawn}
        movingStep={movingStep}
        currentMovingCell={currentMovingCell}
        onPawnClick={onPawnClick}
      />
    );
  }

  // Layouts exatos do HTML original
  const topStrip = [
    ['out11', 'out12',    'out13'],
    ['out10', 'g-out-1',  'out14'],
    ['out9',  'g-out-2',  'out15'],
    ['out8',  'g-out-3',  'out16'],
    ['out7',  'g-out-4',  'out17'],
    ['out6',  'g-out-5',  'out18'],
  ];
  const leftStrip = [
    ['out52',   'out1',    'out2',    'out3',    'out4',    'out5'],
    ['out51',   'r-out-1', 'r-out-2', 'r-out-3', 'r-out-4', 'r-out-5'],
    ['out50',   'out49',   'out48',   'out47',   'out46',   'out45'],
  ];
  const rightStrip = [
    ['out19',   'out20',   'out21',   'out22',   'out23',   'out24'],
    ['y-out-5', 'y-out-4', 'y-out-3', 'y-out-2', 'y-out-1', 'out25'],
    ['out31',   'out30',   'out29',   'out28',   'out27',   'out26'],
  ];
  const bottomStrip = [
    ['out44', 'b-out-5', 'out32'],
    ['out43', 'b-out-4', 'out33'],
    ['out42', 'b-out-3', 'out34'],
    ['out41', 'b-out-2', 'out35'],
    ['out40', 'b-out-1', 'out36'],
    ['out39', 'out38',   'out37'],
  ];

  function renderStrip(rows) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {row.map((id, ci) => (
              <div key={id || `e${ri}${ci}`} style={{ flex: 1, minWidth: 0 }}>
                {id ? renderCell(id) : <div style={{ width: '100%', height: '100%', background: BOARD.bg }} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '40% 20% 40%',
      gridTemplateRows: '40% 20% 40%',
      width: '100%',
      aspectRatio: '1 / 1',
      background: BOARD.bg,
      border: `4px solid ${BOARD.border}`,
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: `0 0 40px rgba(200,150,12,0.35), 0 0 80px rgba(0,0,0,0.6)`,
    }}>
      <HomeBase color="r" inAreaContents={inAreaContents} glowPawns={glowPawns} pulsePawns={pulsePawns} onPawnClick={onPawnClick} />
      {renderStrip(topStrip)}
      <HomeBase color="g" inAreaContents={inAreaContents} glowPawns={glowPawns} pulsePawns={pulsePawns} onPawnClick={onPawnClick} />

      {renderStrip(leftStrip)}
      <CenterArea winCellContents={winCellContents} />
      {renderStrip(rightStrip)}

      <HomeBase color="b" inAreaContents={inAreaContents} glowPawns={glowPawns} pulsePawns={pulsePawns} onPawnClick={onPawnClick} />
      {renderStrip(bottomStrip)}
      <HomeBase color="y" inAreaContents={inAreaContents} glowPawns={glowPawns} pulsePawns={pulsePawns} onPawnClick={onPawnClick} />
    </div>
  );
}

// (getPawnOriginalCell no longer needed — animation handled directly in renderCell)

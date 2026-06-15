/**
 * LudoBoard — SVG Ludo board, standard 15x15 layout.
 *
 * Layout (0-indexed col, row):
 *   - Red home:    cols 0-5,  rows 0-5
 *   - Green home:  cols 9-14, rows 0-5
 *   - Yellow home: cols 9-14, rows 9-14
 *   - Blue home:   cols 0-5,  rows 9-14
 *   - Center:      cols 6-8,  rows 6-8
 *   - Track: 52 cells around the perimeter of the inner 9x9
 *
 * Track order (clockwise, starting at Red's entry col=1,row=6):
 * Red enters at track[0], Green at track[13], Yellow at track[26], Blue at track[39]
 */

interface TokenState {
  status: "home" | "active" | "win";
  position: number;
}

interface LudoGameState {
  tokens: Record<string, TokenState[]>;
  num_players: number;
  dice: number | null;
  six_count: number;
  move_count: number;
}

interface LudoBoardProps {
  gameState: LudoGameState;
  myColor: string;
  validTokens: number[];
  canMove: boolean;
  onMoveToken: (tokenIndex: number) => void;
}

const C: Record<string, string> = {
  red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#eab308",
};

// Standard 52-cell Ludo track [col, row], clockwise from Red's start
const TRACK: [number, number][] = [
  [1,6],[1,7],[1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[6,9],[6,10],[6,11],[6,12],[6,13],
  [7,13],[8,13],[8,12],[8,11],[8,10],[8,9],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],
  [13,7],[13,6],[13,5],[13,4],[13,3],[13,2],[13,1],[12,1],[11,1],[8,1],[8,2],[8,3],
  [8,4],[8,5],[8,6],[7,6],[6,6],[6,5],[6,4],[6,3],[6,2],[6,1],[5,1],[4,1],[3,1],[2,1],
  [1,1],[1,2],[1,3],[1,4],[1,5],
];

// Safe cells (star) — track indices
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Home column (5 colored cells leading to center) per color
const HOME_COL: Record<string, [number, number][]> = {
  red:    [[2,7],[3,7],[4,7],[5,7],[6,7]],
  green:  [[7,2],[7,3],[7,4],[7,5],[7,6]],
  yellow: [[12,7],[11,7],[10,7],[9,7],[8,7]],
  blue:   [[7,12],[7,11],[7,10],[7,9],[7,8]],
};

// Start index in TRACK per color
const START: Record<string, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

// 4 home base slot positions per color (inside the corner square)
const HOME_SLOTS: Record<string, [number, number][]> = {
  red:    [[1.5,1.5],[3.5,1.5],[1.5,3.5],[3.5,3.5]],
  green:  [[10.5,1.5],[12.5,1.5],[10.5,3.5],[12.5,3.5]],
  yellow: [[10.5,10.5],[12.5,10.5],[10.5,12.5],[12.5,12.5]],
  blue:   [[1.5,10.5],[3.5,10.5],[1.5,12.5],[3.5,12.5]],
};

function buildPath(color: string): ([number, number] | "win")[] {
  const s = START[color];
  const path: ([number, number] | "win")[] = [];
  for (let i = 0; i < 51; i++) path.push(TRACK[(s + i) % 52]);
  path.push(...HOME_COL[color]);
  path.push("win");
  return path;
}

const PATHS: Record<string, ([number, number] | "win")[]> = {
  red: buildPath("red"), green: buildPath("green"),
  yellow: buildPath("yellow"), blue: buildPath("blue"),
};

function buildCellMap(gs: LudoGameState) {
  const map = new Map<string, { color: string; idx: number }[]>();
  for (const [color, tokens] of Object.entries(gs.tokens)) {
    const path = PATHS[color];
    if (!path) continue;
    tokens.forEach((t, idx) => {
      if (t.status === "active" && t.position >= 0) {
        const cell = path[t.position];
        if (cell !== "win") {
          const k = `${(cell as [number,number])[0]},${(cell as [number,number])[1]}`;
          if (!map.has(k)) map.set(k, []);
          map.get(k)!.push({ color, idx });
        }
      }
    });
  }
  return map;
}

const S = 40; // cell size px
const B = 15 * S; // board size

export function LudoBoard({ gameState, myColor, validTokens, canMove, onMoveToken }: LudoBoardProps) {
  const cellMap = buildCellMap(gameState);

  // Cell background color
  const cellBg = (col: number, row: number): string => {
    // Home corners
    if (col <= 5 && row <= 5) return "#ef444418";
    if (col >= 9 && row <= 5) return "#22c55e18";
    if (col >= 9 && row >= 9) return "#eab30818";
    if (col <= 5 && row >= 9) return "#3b82f618";
    // Center
    if (col >= 6 && col <= 8 && row >= 6 && row <= 8) return "#ffd45b18";
    // Home columns
    for (const [color, cells] of Object.entries(HOME_COL)) {
      if (cells.some(([c, r]) => c === col && r === row)) return C[color] + "33";
    }
    return "#1a1a2e";
  };

  const renderGrid = () => {
    const cells: JSX.Element[] = [];
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        const x = col * S, y = row * S;
        const bg = cellBg(col, row);
        const trackIdx = TRACK.findIndex(([c, r]) => c === col && r === row);
        const isSafe = trackIdx >= 0 && SAFE.has(trackIdx);
        // Is this a start cell?
        const startColor = Object.entries(START).find(([, si]) => {
          const [tc, tr] = TRACK[si];
          return tc === col && tr === row;
        })?.[0];

        cells.push(
          <g key={`${col}-${row}`}>
            <rect x={x} y={y} width={S} height={S} fill={bg} stroke="#ffffff0a" strokeWidth={0.5} />
            {isSafe && !startColor && (
              <text x={x+S/2} y={y+S/2+5} textAnchor="middle" fontSize={14} fill="#ffd45b" opacity={0.6}>★</text>
            )}
            {startColor && (
              <circle cx={x+S/2} cy={y+S/2} r={S/2-4} fill={C[startColor]+"33"} stroke={C[startColor]+"88"} strokeWidth={1.5} />
            )}
          </g>
        );
      }
    }
    return cells;
  };

  // Render home area inner circle per color
  const renderHomeAreas = () => (
    <>
      {(["red","green","yellow","blue"] as const).map(color => {
        const centers: Record<string,[number,number]> = {
          red:[2.5,2.5], green:[11.5,2.5], yellow:[11.5,11.5], blue:[2.5,11.5]
        };
        const [cx, cy] = centers[color];
        return (
          <g key={color}>
            <rect x={cx*S-S*1.5} y={cy*S-S*1.5} width={S*3} height={S*3}
              rx={8} fill={C[color]+"22"} stroke={C[color]+"55"} strokeWidth={1.5} />
          </g>
        );
      })}
    </>
  );

  // Render center triangle/star
  const renderCenter = () => {
    const cx = 7.5 * S, cy = 7.5 * S;
    return (
      <g>
        <polygon points={`${6*S},${6*S} ${9*S},${6*S} ${7.5*S},${7.5*S}`} fill="#ef444433" />
        <polygon points={`${9*S},${6*S} ${9*S},${9*S} ${7.5*S},${7.5*S}`} fill="#22c55e33" />
        <polygon points={`${9*S},${9*S} ${6*S},${9*S} ${7.5*S},${7.5*S}`} fill="#eab30833" />
        <polygon points={`${6*S},${9*S} ${6*S},${6*S} ${7.5*S},${7.5*S}`} fill="#3b82f633" />
        <text x={cx} y={cy+6} textAnchor="middle" fontSize={22} fill="#ffd45b" opacity={0.5}>★</text>
      </g>
    );
  };

  // Render tokens on the track
  const renderTrackTokens = () => {
    const els: JSX.Element[] = [];
    cellMap.forEach((occupants, key) => {
      const [col, row] = key.split(",").map(Number);
      const x = col * S + S / 2;
      const y = row * S + S / 2;
      const n = occupants.length;
      occupants.forEach((occ, i) => {
        const isMyToken = occ.color === myColor;
        const isValid = isMyToken && canMove && validTokens.includes(occ.idx);
        // Offset for stacked tokens
        const ox = n > 1 ? (i % 2 === 0 ? -8 : 8) : 0;
        const oy = n > 2 ? (i < 2 ? -8 : 8) : 0;
        const r = isValid ? 13 : 11;
        els.push(
          <g key={`track-${occ.color}-${occ.idx}`}
            onClick={isValid ? () => onMoveToken(occ.idx) : undefined}
            style={{ cursor: isValid ? "pointer" : "default" }}>
            {isValid && <circle cx={x+ox} cy={y+oy} r={r+4} fill={C[occ.color]+"33"} className="animate-pulse" />}
            <circle cx={x+ox} cy={y+oy} r={r} fill={C[occ.color]}
              stroke={isValid ? "#ffd45b" : "#00000040"} strokeWidth={isValid ? 2.5 : 1.5} />
            <circle cx={x+ox} cy={y+oy} r={r*0.45} fill="white" opacity={0.35} />
            {isValid && <circle cx={x+ox} cy={y+oy} r={4} fill="#ffd45b" />}
          </g>
        );
      });
    });
    return els;
  };

  // Render home base tokens
  const renderHomeTokens = () => {
    const els: JSX.Element[] = [];
    for (const [color, tokens] of Object.entries(gameState.tokens)) {
      const slots = HOME_SLOTS[color];
      if (!slots) continue;
      tokens.forEach((token, idx) => {
        if (token.status !== "home") return;
        const [sc, sr] = slots[idx] || slots[0];
        const x = sc * S, y = sr * S;
        const isMyToken = color === myColor;
        const isValid = isMyToken && canMove && validTokens.includes(idx);
        const r = isValid ? 14 : 12;
        els.push(
          <g key={`home-${color}-${idx}`}
            onClick={isValid ? () => onMoveToken(idx) : undefined}
            style={{ cursor: isValid ? "pointer" : "default" }}>
            {isValid && <circle cx={x} cy={y} r={r+5} fill={C[color]+"33"} className="animate-pulse" />}
            <circle cx={x} cy={y} r={r} fill={C[color]}
              stroke={isValid ? "#ffd45b" : "#00000040"} strokeWidth={isValid ? 2.5 : 1.5} />
            <circle cx={x} cy={y} r={r*0.45} fill="white" opacity={0.35} />
            {isValid && <circle cx={x} cy={y} r={4} fill="#ffd45b" />}
            <text x={x} y={y+4} textAnchor="middle" fontSize={10} fill="white" fontWeight="bold">{idx+1}</text>
          </g>
        );
      });
    }
    return els;
  };

  // Render win tokens in center
  const renderWinTokens = () => {
    const els: JSX.Element[] = [];
    let i = 0;
    for (const [color, tokens] of Object.entries(gameState.tokens)) {
      tokens.forEach(t => {
        if (t.status !== "win") return;
        const cx = 7.5*S + (i%3-1)*14;
        const cy = 7.5*S + (Math.floor(i/3)-1)*14;
        els.push(<circle key={`win-${color}-${i}`} cx={cx} cy={cy} r={6}
          fill={C[color]} stroke="#ffd45b" strokeWidth={1.5} />);
        i++;
      });
    }
    return els;
  };

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${B} ${B}`} width="100%" style={{ display:"block", maxWidth: 520, borderRadius:12, border:"1px solid #ffffff15" }}>
        <rect width={B} height={B} fill="#0d0d14" rx={12} />
        {renderGrid()}
        {renderHomeAreas()}
        {renderCenter()}
        {renderTrackTokens()}
        {renderHomeTokens()}
        {renderWinTokens()}
      </svg>
    </div>
  );
}

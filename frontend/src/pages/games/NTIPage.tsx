/**
 * NTI (Não te Irrites) — Ludo multiplayer em tempo real.
 * Usa o LudoBoard.jsx original com adaptador do estado do backend.
 * Backend é a fonte de verdade. WebSocket para sincronização.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Copy, Check, Share2, Send,
  MessageCircle, X, Loader2, WifiOff, Crown,
  RotateCcw, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import api, { extractApiError } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
// @ts-ignore
import NTIBoard from "./nti/NTIBoardNew";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Player { id: string; username: string; full_name: string; avatar_url: string | null; }
interface TokenState { status: "home" | "active" | "win"; position: number; }
interface NTIGameState {
  tokens: Record<string, TokenState[]>;
  num_players: number;
  current_player: string;
  player_order: string[];
  dice: [number, number] | null;      // dois dados
  dice_used: [boolean, boolean];      // quais foram usados
  valid_moves: Array<{                // movimentos possíveis
    dice_index: number;
    token_index: number;
    from: number;
    to: number;
  }>;
  bonus_dice: number[];               // índices dos dados bónus a relançar 
  six_count: number;
  move_count: number;
  game_started: boolean;
}
interface ChallengeData {
  id: string; game_type: string; status: string; invite_code: string;
  time_control: number;
  game_state: NTIGameState | null;
  winner_id: string | null; finish_reason: string | null;
  creator: Player | null; opponent: Player | null;
  is_my_turn: boolean; my_color: string | null;
}
interface ChatMsg { sender: Player; text: string; ts: string; }

// ── Color config ──────────────────────────────────────────────────────────────
const COLOR_LABELS: Record<string, string> = {
  red: "Vermelho", green: "Verde", yellow: "Amarelo", blue: "Azul",
};
const COLOR_HEX: Record<string, string> = {
  red: "#ef4444", green: "#22c55e", yellow: "#eab308", blue: "#3b82f6",
};
// Map backend color names to LudoBoard single-char keys
const COLOR_TO_CHAR: Record<string, string> = {
  red: "r", green: "g", yellow: "y", blue: "b",
};

// ── Constantes do tabuleiro NTI (80 casas + 9 privadas) ──────────────────────
const TRACK_LEN = 80;
const HOME_COL_LEN = 9;

// Posição de início na pista absoluta (0-indexed)
const PLAYER_START_ABS: Record<string, number> = {
  red: 6, green: 15, yellow: 35, blue: 75,
};

// Posição relativa da casa larga (entrada no corredor) por cor
const ENTRY_REL: Record<string, number> = {
  red: 8, green: 19, yellow: 39, blue: 10,
};

// Posição de vitória por cor (ENTRY_REL + HOME_COL_LEN + 1)
const WIN_POS: Record<string, number> = {
  red: 18, green: 29, yellow: 49, blue: 20,
};

// Convert relative position to absolute out-cell id (out1..out80)
function relToOutId(color: string, relPos: number): string | null {
  if (relPos < 0 || relPos > ENTRY_REL[color]) return null;
  const abs = (PLAYER_START_ABS[color] + relPos) % TRACK_LEN;
  return `out${abs + 1}`; // out1..out80
}

// Convert home-column position to private cell id (r-out-1..r-out-9)
function relToPrivateId(color: string, relPos: number): string | null {
  // relPos = ENTRY_REL[color]+1 → step 1, ENTRY_REL[color]+9 → step 9
  const step = relPos - ENTRY_REL[color]; // 1..9
  if (step < 1 || step > HOME_COL_LEN) return null;
  return `${COLOR_TO_CHAR[color]}-out-${step}`;
}

function buildLudoBoardState(gs: NTIGameState | null, myColor: string | null, glowTokenIndices: number[]) {
  const cellContents: Record<string, string[]> = {};
  const privateCellContents: Record<string, string[]> = {};
  const winCellContents: Record<string, string[]> = {};
  const inAreaContents: Record<string, boolean> = {};

  for (const color of ["red", "green", "yellow", "blue"]) {
    const c = COLOR_TO_CHAR[color];
    for (let i = 1; i <= 4; i++) {
      inAreaContents[`${c}-${i}`] = false;
    }
  }

  if (!gs) {
    return { cellContents, privateCellContents, winCellContents, inAreaContents, glowPawns: [], movingPawn: null, movingPath: [], movingStep: 0 };
  }

  const glowPawns: string[] = [];
  const activeColors = gs.player_order ?? Object.keys(gs.tokens);

  for (const color of activeColors) {
    const tokens = gs.tokens[color];
    if (!tokens) continue;
    const c = COLOR_TO_CHAR[color];
    if (!c) continue;
    const winPos = WIN_POS[color];
    const entryRel = ENTRY_REL[color];

    tokens.forEach((token, idx) => {
      const pawnId = `${c}-pawn${idx + 1}`;
      const homeKey = `${c}-${idx + 1}`;

      if (token.status === "home" || token.position < 0) {
        inAreaContents[homeKey] = true;
      } else if (token.status === "win" || token.position >= winPos) {
        winCellContents[c] = winCellContents[c] || [];
        winCellContents[c].push(pawnId);
        inAreaContents[homeKey] = false;
      } else if (token.position > entryRel) {
        // Corredor privado
        const cellId = relToPrivateId(color, token.position);
        if (cellId) {
          privateCellContents[cellId] = privateCellContents[cellId] || [];
          privateCellContents[cellId].push(pawnId);
        }
        inAreaContents[homeKey] = false;
      } else {
        // Pista principal
        const cellId = relToOutId(color, token.position);
        if (cellId) {
          cellContents[cellId] = cellContents[cellId] || [];
          cellContents[cellId].push(pawnId);
        }
        inAreaContents[homeKey] = false;
      }

      if (myColor === color && glowTokenIndices.includes(idx)) {
        glowPawns.push(pawnId);
      }
    });
  }

  return {
    cellContents,
    privateCellContents,
    winCellContents,
    inAreaContents,
    glowPawns,
    movingPawn: null,
    movingPath: [],
    movingStep: 0,
  };
}

// ── Dice components ───────────────────────────────────────────────────────────
// Dot positions for each face value (left%, top%)
const DOTS: Record<number, [number, number][]> = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,22],[72,22],[28,50],[72,50],[28,78],[72,78]],
};

// Static dice face with CSS dots
function DiceFace({ value, size = 48, highlight = false }: { value: number; size?: number; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "relative bg-white rounded-xl shadow-lg flex-shrink-0 border-2 transition-all",
        highlight ? "border-accent-gold shadow-[0_0_12px_rgba(255,215,0,0.5)]" : "border-zinc-200",
      )}
      style={{ width: size, height: size }}
    >
      {(DOTS[value] ?? []).map(([l, t], i) => (
        <div
          key={i}
          className="absolute rounded-full bg-zinc-900"
          style={{
            left: `${l}%`, top: `${t}%`,
            width: "16%", height: "16%",
            transform: "translate(-50%,-50%)",
          }}
        />
      ))}
    </div>
  );
}

// Animated dice using sprite sheet
function DiceRolling({ size = 48, frame }: { size?: number; frame: number }) {
  const col = frame % 6;
  const row = Math.floor(frame / 6);
  const posX = (col / 5) * 100;
  const posY = (row / 4) * 100;

  return (
    <div
      className="rounded-xl flex-shrink-0 border-2 border-zinc-300"
      style={{
        width: size, height: size,
        backgroundImage: "url(/images/dice_roll.png)",
        backgroundSize: "600% 500%",
        backgroundRepeat: "no-repeat",
        backgroundPositionX: `${posX}%`,
        backgroundPositionY: `${posY}%`,
      }}
    />
  );
}

// Two dice display — rolling animation or static result
function TwoDice({
  dice, diceUsed, rolling, bonusDice, size = 48,
}: {
  dice: [number, number] | null;
  diceUsed: [boolean, boolean];
  rolling: boolean;
  bonusDice: number[];
  size?: number;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!rolling) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % 30), 55);
    return () => clearInterval(t);
  }, [rolling]);

  if (rolling) {
    return (
      <div className="flex items-center gap-2">
        <DiceRolling size={size} frame={frame} />
        <DiceRolling size={size} frame={(frame + 15) % 30} />
      </div>
    );
  }

  if (!dice) return null;

  return (
    <div className="flex items-center gap-2">
      {dice.map((val, i) => {
        const isUsed = diceUsed[i];
        const isBonus = bonusDice.includes(i);
        return (
          <div key={i} className={cn("relative transition-all", isUsed && "opacity-30")}>
            <DiceFace value={val} size={size} highlight={val === 6 || isBonus} />
            {isUsed && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-zinc-500 rotate-45 absolute" />
              </div>
            )}
            {isBonus && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent-gold rounded-full flex items-center justify-center">
                <span className="text-[8px] font-black text-zinc-900">+</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NTIPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedTime, setSelectedTime] = useState(600);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [disconnected, setDisconnected] = useState<{ name: string; secondsLeft: number } | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);

  const chatOpenRef = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const isInProgress = challenge?.status === "in_progress";
  const isWaiting = challenge?.status === "waiting";
  const isFinished = challenge?.status === "finished";
  const isCreator = !!(user?.id && challenge?.creator?.id &&
    String(user.id) === String(challenge.creator.id));

  useEffect(() => {
    if (!isInProgress) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isInProgress]);

  useEffect(() => {
    api.get(`/games/challenges/${challengeId}`)
      .then(({ data }) => { setChallenge(data); if (data.time_control) setSelectedTime(data.time_control); })
      .catch((e) => setError(extractApiError(e)))
      .finally(() => setLoading(false));
  }, [challengeId]);

  const connectWS = useCallback(() => {
    if (!challengeId) return;
    const token = localStorage.getItem("access_token") ?? "";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/game/${challengeId}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") {
          setChallenge(msg.challenge);
          setDiceRolling(false);
        } else if (msg.type === "chat") {
          setChatMessages((prev) => [...prev, msg]);
          if (!chatOpenRef.current) setUnreadChat((n) => n + 1);
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        } else if (msg.type === "countdown") {
          setCountdown(msg.seconds);
        } else if (msg.type === "started") {
          setCountdown(null);
        } else if (msg.type === "player_joined" || msg.type === "player_reconnected") {
          if (msg.challenge) setChallenge(msg.challenge);
          else api.get(`/games/challenges/${challengeId}`).then(({ data }) => setChallenge(data));
          if (msg.type === "player_reconnected") {
            if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
            setDisconnected(null);
          }
        } else if (msg.type === "player_disconnected") {
          const timeout = msg.timeout_seconds ?? 0;
          if (timeout > 0) {
            if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
            setDisconnected({ name: msg.player_name, secondsLeft: timeout });
            disconnectTimerRef.current = setInterval(() => {
              setDisconnected((prev) => {
                if (!prev) return null;
                if (prev.secondsLeft <= 1) { clearInterval(disconnectTimerRef.current!); return null; }
                return { ...prev, secondsLeft: prev.secondsLeft - 1 };
              });
            }, 1000);
          }
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      reconnectRef.current = setTimeout(connectWS, 2000);
    };
  }, [challengeId]);

  useEffect(() => {
    connectWS();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  function sendWS(msg: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function handleStart() { sendWS({ type: "start", time_control: selectedTime }); }

  function handleRollDice() {
    if (!challenge?.is_my_turn || !isInProgress) return;
    setDiceRolling(true);
    sendWS({ type: "roll_dice" });
  }

  function handleResign() {
    if (!confirm("Tens a certeza que queres desistir?")) return;
    sendWS({ type: "resign" });
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendWS({ type: "chat", text: chatInput.trim() });
    setChatInput("");
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/jogos/nti/${challengeId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const url = `${window.location.origin}/jogos/nti/${challengeId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Desafio-te para NTI no Kalie! Entra aqui: ${url}`)}`);
  }

  // Handle pawn click from LudoBoard
  function handlePawnClick(pawnCls: string) {
    if (!challenge?.is_my_turn || !isInProgress) return;
    const gs = challenge.game_state;
    if (!gs || !gs.dice) return;
    const myColor = challenge.my_color;
    if (!myColor) return;
    const c = COLOR_TO_CHAR[myColor];
    if (!pawnCls.startsWith(c)) return;
    // Extract token index from pawn class like "r-pawn1" → 0
    const match = pawnCls.match(/pawn(\d+)$/);
    if (!match) return;
    const tokenIndex = parseInt(match[1]) - 1;

    // Find valid moves for this token (pick first available dice)
    const validMoves = gs.valid_moves ?? [];
    const move = validMoves.find((m) => m.token_index === tokenIndex);
    if (!move) return;

    sendWS({ type: "move", dice_index: move.dice_index, token_index: tokenIndex });
  }

  // Build LudoBoard state from backend state
  const gs = challenge?.game_state;
  const myColor = challenge?.my_color ?? null;

  // Glow tokens that have valid moves
  const glowTokenIndices = (isInProgress && challenge?.is_my_turn && gs?.dice)
    ? [...new Set((gs.valid_moves ?? []).map((m) => m.token_index))]
    : [];

  const boardState = buildLudoBoardState(gs ?? null, myColor, glowTokenIndices);

  // ── Modo de mapeamento manual ─────────────────────────────────────────────
  const [mapMode, setMapMode] = useState(false);
  const [mapColor, setMapColor] = useState<string>("red");
  const [mapCells, setMapCells] = useState<Record<string, { color: string; order: number }>>({});
  const [mapOrder, setMapOrder] = useState(1);

  const MAP_HEX: Record<string, string> = {
    red: "#ff4444", green: "#22dd66", yellow: "#ffcc00", blue: "#4488ff",
  };

  function handleMapCellClick(cellId: string) {
    if (!mapMode) return;
    setMapCells(prev => {
      // Se já está mapeada com a mesma cor, remove
      if (prev[cellId]?.color === MAP_HEX[mapColor]) {
        const next = { ...prev };
        delete next[cellId];
        return next;
      }
      // Adiciona/substitui
      return { ...prev, [cellId]: { color: MAP_HEX[mapColor], order: mapOrder } };
    });
    setMapOrder(o => o + 1);
  }

  function resetMap() {
    setMapCells({});
    setMapOrder(1);
  }

  // Exporta a rota como lista ordenada de IDs
  const mapRoute = Object.entries(mapCells)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([id, v]) => `${v.order}:${id}`)
    .join(" → ");
  const [testMode, setTestMode] = useState(false);
  const [testPos, setTestPos] = useState<Record<string, number>>({ red: 0, green: 0, yellow: 0, blue: 0 });
  const [testAuto, setTestAuto] = useState(false);
  const testColors = ["red", "green", "yellow", "blue"];

  useEffect(() => {
    if (!testAuto) return;
    const t = setInterval(() => {
      setTestPos(prev => {
        const next = { ...prev };
        for (const c of testColors) {
          const max = WIN_POS[c];
          next[c] = (prev[c] + 1) > max ? 0 : prev[c] + 1;
        }
        return next;
      });
    }, 400);
    return () => clearInterval(t);
  }, [testAuto]);

  function buildTestState(): ReturnType<typeof buildLudoBoardState> {
    const cellContents: Record<string, string[]> = {};
    const privateCellContents: Record<string, string[]> = {};
    const winCellContents: Record<string, string[]> = {};
    const inAreaContents: Record<string, boolean> = {};
    for (const color of testColors) {
      const c = COLOR_TO_CHAR[color];
      for (let i = 1; i <= 4; i++) inAreaContents[`${c}-${i}`] = false;
    }
    for (const color of testColors) {
      const c = COLOR_TO_CHAR[color];
      const pos = testPos[color];
      const entry = ENTRY_REL[color];
      const win = WIN_POS[color];
      const pawnId = `${c}-pawn1`;
      if (pos < 0) {
        inAreaContents[`${c}-1`] = true;
      } else if (pos >= win) {
        winCellContents[c] = [pawnId];
      } else if (pos > entry) {
        const cellId = relToPrivateId(color, pos);
        if (cellId) { privateCellContents[cellId] = [pawnId]; }
      } else {
        const cellId = relToOutId(color, pos);
        if (cellId) { cellContents[cellId] = (cellContents[cellId] || []); cellContents[cellId].push(pawnId); }
      }
    }
    return { cellContents, privateCellContents, winCellContents, inAreaContents, glowPawns: [], movingPawn: null, movingPath: [], movingStep: 0 };
  }

  const opponent = isCreator ? challenge?.opponent : challenge?.creator;
  const currentPlayerColor = gs?.current_player ?? null;
  const dice = gs?.dice ?? null;
  const diceUsed = gs?.dice_used ?? [false, false];
  const bonusDice = gs?.bonus_dice ?? [];
  const validMoves = gs?.valid_moves ?? [];
  const hasMoves = validMoves.length > 0;
  const needsRoll = isInProgress && challenge?.is_my_turn && !dice && bonusDice.length === 0;
  const needsBonusRoll = isInProgress && challenge?.is_my_turn && bonusDice.length > 0;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-themed-muted" />
    </div>
  );

  if (error) return (
    <div className="glass-panel rounded-xl p-8 text-center max-w-md mx-auto mt-12">
      <p className="text-accent-sos mb-4">{error}</p>
      <Button onClick={() => navigate("/jogos")}>Voltar aos Jogos</Button>
    </div>
  );

  return (
    <div className="py-6 max-w-6xl mx-auto">

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-themed-muted text-body-lg mb-4">O jogo começa em</p>
            <div className="text-[120px] font-black font-space-grotesk text-accent-games leading-none"
              style={{ textShadow: "0 0 60px rgba(191,90,242,0.5)" }}>
              {countdown}
            </div>
          </div>
        </div>
      )}

      {/* Disconnect banner */}
      {disconnected && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 glass-panel luminous-edge rounded-full px-5 py-3 flex items-center gap-3 border border-accent-sos/30 shadow-2xl">
          <WifiOff className="w-4 h-4 text-accent-sos" />
          <p className="text-body-sm text-themed-primary">
            <span className="font-bold">{disconnected.name}</span> desconectou-se
          </p>
          <div className="w-10 h-10 rounded-full bg-accent-sos/10 border-2 border-accent-sos/30 flex items-center justify-center">
            <span className="text-accent-sos font-bold text-sm">{disconnected.secondsLeft}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/jogos")} className="text-themed-muted hover:text-themed-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-h2 font-space-grotesk text-themed-primary">NTI</h1>
        <span className="text-label-caps text-themed-muted bg-white/5 px-3 py-1 rounded-full border border-white/10 font-mono">
          #{challenge?.invite_code}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setTestMode(v => !v)}
            className={cn("glass-panel px-3 py-2 rounded-xl text-xs font-bold border transition-all",
              testMode ? "border-accent-gold/40 text-accent-gold" : "border-white/10 text-themed-muted hover:text-themed-primary")}
          >
            Teste
          </button>
          <button
            onClick={() => setMapMode(v => !v)}
            className={cn("glass-panel px-3 py-2 rounded-xl text-xs font-bold border transition-all",
              mapMode ? "border-accent-feed/40 text-accent-feed" : "border-white/10 text-themed-muted hover:text-themed-primary")}
          >
            Mapa
          </button>
          <button
            onClick={() => { setChatOpen((v) => !v); setUnreadChat(0); }}
            className="relative glass-panel px-3 py-2 rounded-xl text-themed-muted hover:text-themed-primary transition-all border border-white/10"
          >
            <MessageCircle className="w-5 h-5" />
            {unreadChat > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-sos text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadChat}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Board + controls */}
        <div className="lg:col-span-8 flex flex-col gap-4">

          {/* Opponent */}
          <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
            {opponent ? (
              <>
                <Avatar className="w-9 h-9 flex-shrink-0">
                  <AvatarImage src={opponent.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-white/10 text-sm">{opponent.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-bold text-themed-primary truncate">{opponent.full_name}</p>
                  <p className="text-xs text-themed-muted">Adversário</p>
                </div>
                {!challenge?.is_my_turn && isInProgress && (
                  <div className="flex items-center gap-1.5 text-accent-games text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    A jogar...
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-themed-muted" />
                </div>
                <p className="text-themed-muted text-body-sm">A aguardar adversário...</p>
              </div>
            )}
          </div>

          {/* The real NTI Board */}
          {testMode ? (
            <div className="flex flex-col gap-3">
              {/* Painel de controlo do teste */}
              <div className="glass-panel rounded-xl p-3 flex flex-wrap items-center gap-2 border border-accent-gold/30">
                <span className="text-accent-gold text-xs font-bold uppercase tracking-wide">Modo Teste</span>
                <button onClick={() => setTestAuto(v => !v)}
                  className={cn("px-3 py-1 rounded-lg text-xs font-bold border transition-all",
                    testAuto ? "bg-accent-games/20 border-accent-games/40 text-accent-games" : "glass-panel border-white/10 text-themed-muted")}>
                  {testAuto ? "⏸ Parar" : "▶ Auto"}
                </button>
                {testColors.map(color => (
                  <div key={color} className="flex items-center gap-1">
                    <span className="text-xs font-mono" style={{ color: COLOR_HEX[color] }}>
                      {COLOR_LABELS[color]}: {testPos[color]}/{WIN_POS[color]}
                    </span>
                    <button onClick={() => setTestPos(p => ({ ...p, [color]: Math.max(-1, p[color] - 1) }))}
                      className="w-5 h-5 rounded text-xs glass-panel border border-white/10 text-themed-muted hover:text-themed-primary">‹</button>
                    <button onClick={() => setTestPos(p => ({ ...p, [color]: Math.min(WIN_POS[color], p[color] + 1) }))}
                      className="w-5 h-5 rounded text-xs glass-panel border border-white/10 text-themed-muted hover:text-themed-primary">›</button>
                  </div>
                ))}
                <button onClick={() => { setTestMode(false); setTestAuto(false); setTestPos({ red: 0, green: 0, yellow: 0, blue: 0 }); }}
                  className="ml-auto px-3 py-1 rounded-lg text-xs font-bold border border-accent-sos/30 text-accent-sos glass-panel">
                  Fechar
                </button>
              </div>
              <NTIBoard state={buildTestState()} onPawnClick={() => {}} />
            </div>
          ) : mapMode ? (
            <div className="flex flex-col gap-3">
              {/* Painel de mapeamento */}
              <div className="glass-panel rounded-xl p-3 flex flex-wrap items-center gap-2 border border-accent-gold/30">
                <span className="text-accent-gold text-xs font-bold uppercase tracking-wide">Mapeamento</span>
                {/* Seletor de cor */}
                {(["red","green","yellow","blue"] as const).map(c => (
                  <button key={c} onClick={() => setMapColor(c)}
                    className={cn("px-3 py-1 rounded-lg text-xs font-bold border transition-all",
                      mapColor === c ? "border-white/60" : "border-white/10 opacity-50")}
                    style={{ background: MAP_HEX[c], color: "#fff" }}>
                    {COLOR_LABELS[c]}
                  </button>
                ))}
                <span className="text-themed-muted text-xs">Passo: {mapOrder - 1}</span>
                <button onClick={resetMap}
                  className="px-3 py-1 rounded-lg text-xs font-bold glass-panel border border-white/10 text-themed-muted">
                  Limpar
                </button>
                <button onClick={() => { setMapMode(false); resetMap(); }}
                  className="ml-auto px-3 py-1 rounded-lg text-xs font-bold border border-accent-sos/30 text-accent-sos glass-panel">
                  Fechar
                </button>
              </div>
              {/* Rota mapeada */}
              {mapRoute && (
                <div className="glass-panel rounded-xl p-2 border border-white/5 overflow-x-auto">
                  <p className="text-xs font-mono text-themed-muted whitespace-nowrap">{mapRoute}</p>
                </div>
              )}
              <NTIBoard
                state={{ cellContents: {}, privateCellContents: {}, winCellContents: {}, inAreaContents: {}, glowPawns: [] }}
                onPawnClick={() => {}}
                mapCells={mapCells}
                onCellClick={handleMapCellClick}
              />
            </div>
          ) : (
            <NTIBoard state={boardState} onPawnClick={handlePawnClick} />
          )}

          {/* My info + dice controls */}
          <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarImage src={user?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-accent-games/20 text-accent-games text-sm">{user?.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-bold text-themed-primary truncate">
                {user?.full_name} <span className="text-themed-muted font-normal">(Tu)</span>
              </p>
              {myColor && (
                <p className="text-xs font-semibold" style={{ color: COLOR_HEX[myColor] }}>
                  {COLOR_LABELS[myColor]}
                </p>
              )}
            </div>

            {/* Dice + roll button */}
            {isInProgress && (
              <div className="flex items-center gap-3 flex-wrap">
                {/* Dados */}
                <TwoDice
                  dice={dice}
                  diceUsed={diceUsed}
                  rolling={diceRolling}
                  bonusDice={bonusDice}
                  size={44}
                />

                {/* Botão lançar (turno inicial ou bónus) */}
                {(needsRoll || needsBonusRoll) && !diceRolling && (
                  <Button
                    size="sm"
                    className={cn(
                      "font-bold",
                      needsBonusRoll
                        ? "bg-accent-gold text-zinc-900 hover:brightness-110"
                        : "bg-accent-games text-white hover:brightness-110",
                    )}
                    onClick={handleRollDice}
                  >
                    {needsBonusRoll
                      ? `Bónus: relançar dado${bonusDice.length > 1 ? "s" : ""} ${bonusDice.map((i) => i + 1).join(" e ")}`
                      : "Lançar Dados"}
                  </Button>
                )}

                {/* Instrução de escolha */}
                {challenge?.is_my_turn && dice && hasMoves && !diceRolling && (
                  <span className="text-accent-feed text-xs font-bold">Escolhe uma peça</span>
                )}
                {challenge?.is_my_turn && dice && !hasMoves && !diceRolling && !needsBonusRoll && (
                  <span className="text-themed-muted text-xs">Sem movimentos</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Result */}
          {isFinished && (
            <div className={cn("glass-panel luminous-edge rounded-xl p-5 text-center border",
              challenge?.winner_id === user?.id ? "border-accent-feed/30" : "border-accent-sos/30")}>
              <Crown className={cn("w-10 h-10 mx-auto mb-2",
                challenge?.winner_id === user?.id ? "text-accent-gold" : "text-zinc-600")} />
              <p className="text-h3 font-space-grotesk text-themed-primary mb-1">
                {challenge?.winner_id === user?.id ? "Vitória!" : challenge?.winner_id ? "Derrota" : "Empate"}
              </p>
              <p className="text-themed-muted text-body-sm capitalize mb-4">{challenge?.finish_reason}</p>
              <Button className="w-full" onClick={() => navigate("/jogos")}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Novo Jogo
              </Button>
            </div>
          )}

          {/* Waiting room */}
          {isWaiting && (
            <div className="glass-panel luminous-edge rounded-xl p-5">
              <h3 className="text-body-md font-bold text-themed-primary mb-1">Sala de Espera</h3>
              <p className="text-body-sm text-themed-muted mb-4">Partilha o código para o adversário entrar.</p>

              {isCreator && (
                <div className="mb-4">
                  <p className="text-label-caps text-themed-muted uppercase mb-2">Tempo por jogador</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[{ label: "1 min", secs: 60 }, { label: "3 min", secs: 180 },
                      { label: "5 min", secs: 300 }, { label: "10 min", secs: 600 }].map(({ label, secs }) => (
                      <button key={secs} onClick={() => setSelectedTime(secs)}
                        className={cn("py-2 rounded-xl text-xs font-bold border transition-all",
                          selectedTime === secs
                            ? "bg-accent-games/15 border-accent-games/40 text-accent-games"
                            : "glass-panel border-white/5 text-themed-muted hover:border-white/15")}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center glass-panel rounded-xl py-4 mb-4 border border-white/5">
                <p className="text-label-caps text-themed-muted uppercase mb-1">Código</p>
                <p className="text-3xl font-black font-mono text-themed-primary tracking-[0.2em]">
                  {challenge?.invite_code}
                </p>
              </div>

              <div className="flex gap-2 mb-4">
                <Button variant="glass" className="flex-1" onClick={copyInviteLink}>
                  {copied ? <><Check className="w-4 h-4 mr-2 text-accent-feed" />Copiado!</>
                    : <><Copy className="w-4 h-4 mr-2" />Copiar Link</>}
                </Button>
                <Button variant="glass" onClick={shareWhatsApp}><Share2 className="w-4 h-4" /></Button>
              </div>

              {challenge?.opponent ? (
                <div className="flex items-center gap-3 glass-panel rounded-xl px-3 py-2.5 mb-4 border border-accent-feed/20">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={challenge.opponent.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs bg-accent-feed/20 text-accent-feed">
                      {challenge.opponent.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-themed-primary truncate">{challenge.opponent.full_name}</p>
                    <p className="text-xs text-accent-feed">Pronto para jogar</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-accent-feed animate-pulse flex-shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-themed-muted text-body-sm mb-4">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  A aguardar adversário...
                </div>
              )}

              {isCreator ? (
                <Button
                  className={cn("w-full font-bold transition-all",
                    challenge?.opponent
                      ? "bg-accent-games text-white hover:brightness-110"
                      : "bg-white/5 text-themed-muted cursor-not-allowed border border-white/10")}
                  disabled={!challenge?.opponent}
                  onClick={handleStart}
                >
                  {challenge?.opponent ? "Iniciar Partida" : "Aguarda o adversário"}
                </Button>
              ) : (
                <p className="text-center text-themed-muted text-body-sm py-2">
                  A aguardar que o criador inicie...
                </p>
              )}
            </div>
          )}

          {/* Turn indicator */}
          {isInProgress && currentPlayerColor && (
            <div className="glass-panel luminous-edge rounded-xl p-4 border"
              style={{ borderColor: COLOR_HEX[currentPlayerColor] + "40" }}>
              <p className="text-label-caps text-themed-muted uppercase mb-2">Turno actual</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLOR_HEX[currentPlayerColor] }} />
                <p className="text-body-md font-bold text-themed-primary">
                  {COLOR_LABELS[currentPlayerColor]}
                  {challenge?.is_my_turn && " (Tu)"}
                </p>
              </div>

              {/* Dados do turno actual */}
              {dice && (
                <div className="flex items-center gap-2 mb-2">
                  <TwoDice dice={dice} diceUsed={diceUsed} rolling={false} bonusDice={bonusDice} size={36} />
                  {bonusDice.length > 0 && (
                    <span className="text-xs text-accent-gold font-bold">Bónus!</span>
                  )}
                </div>
              )}

              {gs?.move_count !== undefined && (
                <p className="text-xs text-themed-muted">Jogada #{gs.move_count + 1}</p>
              )}
            </div>
          )}

          {isInProgress && (
            <Button variant="glass" onClick={handleResign}
              className="w-full border-accent-sos/20 text-accent-sos hover:bg-accent-sos/10">
              <Flag className="w-4 h-4 mr-2" />
              Desistir
            </Button>
          )}
        </div>
      </div>

      {/* Chat */}
      {chatOpen && (
        <div className="fixed bottom-4 right-4 w-80 glass-panel luminous-edge rounded-2xl overflow-hidden z-40 shadow-2xl flex flex-col"
          style={{ height: 380 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-body-sm font-bold text-themed-primary">Chat da Partida</h3>
            <button onClick={() => setChatOpen(false)} className="text-themed-muted hover:text-themed-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {chatMessages.length === 0 && (
              <p className="text-themed-muted text-xs text-center mt-4">Sem mensagens ainda.</p>
            )}
            {chatMessages.map((msg, i) => {
              const isMe = msg.sender.id === user?.id;
              return (
                <div key={i} className={cn("flex gap-2 max-w-[90%]", isMe && "ml-auto flex-row-reverse")}>
                  <Avatar className="w-6 h-6 flex-shrink-0">
                    <AvatarImage src={msg.sender.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-white/10">{msg.sender.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={cn("px-3 py-2 rounded-xl text-xs",
                    isMe ? "bg-accent-games/20 text-themed-primary" : "bg-white/5 text-themed-secondary")}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          <form onSubmit={sendChat} className="flex gap-2 p-3 border-t border-white/5">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 input-themed rounded-full px-3 py-2 text-xs"
              placeholder="Escreve uma mensagem..." maxLength={200} />
            <button type="submit" className="text-accent-games hover:brightness-110 transition-all flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

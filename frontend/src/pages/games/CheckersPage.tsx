/**
 * Damas — multiplayer em tempo real via WebSocket.
 * Arquitectura idêntica ao ChessPage. Backend é fonte de verdade.
 * Regras angolanas: peças movem para a frente; só voltam atrás para capturar.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Copy, Check, Share2, Send,
  MessageCircle, X as XIcon, Loader2, WifiOff, Crown,
  RotateCcw, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import api, { extractApiError } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Player { id: string; username: string; full_name: string; avatar_url: string | null; }
interface CheckersState {
  board: Record<string, string>;
  current_player: "white" | "black";
  selected: number | null;
  must_capture: boolean;
  winner: string | null;
  move_count: number;
  captured_white: number;
  captured_black: number;
}
interface ChallengeData {
  id: string; game_type: string; status: string; invite_code: string;
  time_control: number;
  game_state: CheckersState | null;
  winner_id: string | null; finish_reason: string | null;
  creator: Player | null; opponent: Player | null;
  is_my_turn: boolean; my_color: "white" | "black" | null;
}
interface ChatMsg { sender: Player; text: string; ts: string; }
interface LegalMove { from: number; to: number; over: number | null; }

function row(pos: number) { return Math.floor(pos / 8); }
function col(pos: number) { return pos % 8; }

// ── Board Square ──────────────────────────────────────────────────────────────
function Square({
  pos: _pos, piece, isDark, isSelected, isLegalDest, isLegalSrc, isChainPiece,
  myColor: _myColor, onClick,
}: {
  pos: number; piece: string | null; isDark: boolean;
  isSelected: boolean; isLegalDest: boolean; isLegalSrc: boolean; isChainPiece: boolean;
  myColor: "white" | "black" | null; onClick: () => void;
}) {
  const isWhite = piece?.startsWith("w");
  const isBlack = piece?.startsWith("b");
  const isKing  = piece?.endsWith("k");
  const canInteract = isSelected || isLegalDest || isLegalSrc || isChainPiece;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center transition-all",
        isDark ? "bg-[#5d4037]" : "bg-[#d7ccc8]",
        isSelected && "ring-2 ring-inset ring-yellow-400",
        isLegalDest && isDark && "ring-2 ring-inset ring-green-400/80",
        canInteract && "cursor-pointer",
      )}
      style={{ aspectRatio: "1" }}
    >
      {isLegalDest && !piece && (
        <div className="w-[34%] h-[34%] rounded-full bg-green-400/60 pointer-events-none" />
      )}
      {isLegalDest && piece && (
        <div className="absolute inset-0 ring-2 ring-inset ring-green-400/80 pointer-events-none" />
      )}
      {piece && (
        <div className={cn(
          "w-[76%] h-[76%] rounded-full flex items-center justify-center",
          "shadow-[0_3px_8px_rgba(0,0,0,0.5)] border-2 transition-transform",
          isWhite ? "bg-gradient-to-br from-white to-zinc-200 border-zinc-400"    : "",
          isBlack ? "bg-gradient-to-br from-zinc-700 to-zinc-950 border-zinc-500" : "",
          isSelected && "scale-110",
          isLegalSrc && !isSelected && "ring-2 ring-yellow-300/70",
          isChainPiece && "ring-4 ring-yellow-400 animate-pulse",
        )}>
          {isKing && (
            <Crown className={cn("w-[50%] h-[50%]", isWhite ? "text-accent-gold" : "text-yellow-400")} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CheckersPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedTime, setSelectedTime] = useState(300);

  // Board interaction
  const [selected, setSelected] = useState<number | null>(null);
  const [legalMoves, setLegalMoves] = useState<LegalMove[]>([]);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Countdown + disconnect
  const [countdown, setCountdown] = useState<number | null>(null);
  const [disconnected, setDisconnected] = useState<{ name: string; secondsLeft: number } | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WS
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const isInProgress = challenge?.status === "in_progress";
  const isWaiting    = challenge?.status === "waiting";
  const isFinished   = challenge?.status === "finished";
  const isCreator    = !!(user?.id && challenge?.creator?.id && String(user.id) === String(challenge.creator.id));
  const opponent     = isCreator ? challenge?.opponent : challenge?.creator;
  const myColor      = challenge?.my_color ?? null;
  const gs           = challenge?.game_state ?? null;

  useEffect(() => {
    if (!isInProgress) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; return ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isInProgress]);

  // Initial fetch
  useEffect(() => {
    api.get(`/games/challenges/${challengeId}`)
      .then(({ data }) => { setChallenge(data); if (data.time_control) setSelectedTime(data.time_control); })
      .catch((e) => setError(extractApiError(e)))
      .finally(() => setLoading(false));
  }, [challengeId]);

  // Poll for opponent
  useEffect(() => {
    if (challenge?.status !== "waiting" || challenge?.opponent) return;
    const iv = setInterval(() => {
      api.get(`/games/challenges/${challengeId}`)
        .then(({ data }) => { if (data.opponent) setChallenge(data); })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(iv);
  }, [challenge?.status, challenge?.opponent, challengeId]);

  const chatOpenRef = useRef(chatOpen);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

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
          setCountdown(null);
          setSelected(null);
          setLegalMoves([]);
        } else if (msg.type === "chat") {
          setChatMsgs((p) => [...p, msg]);
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
        } else if (msg.type === "error") {
          console.warn("[Checkers WS]", msg.detail);
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

  function sendWS(msg: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
  }

  function handleStart()  { sendWS({ type: "start", time_control: selectedTime }); }
  function handleResign() { if (!confirm("Tens a certeza que queres desistir?")) return; sendWS({ type: "resign" }); }
  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendWS({ type: "chat", text: chatInput.trim() });
    setChatInput("");
  }
  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/jogos/damas/${challengeId}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  function shareWhatsApp() {
    const url = `${window.location.origin}/jogos/damas/${challengeId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Desafio-te para Damas no Kalie! Entra aqui: ${url}`)}`);
  }

  // ── Legal move computation (client-side for highlights) ───────────────────
  const clientLegalMoves = useMemo((): LegalMove[] => {
    if (!gs || !myColor || !challenge?.is_my_turn) return [];
    const board = gs.board;
    const player = myColor;

    function isOwn(p: string) { return p.startsWith(player === "white" ? "w" : "b"); }
    function isEnemy(p: string) { return p.startsWith(player === "white" ? "b" : "w"); }
    function inB(r: number, c: number) { return r >= 0 && r <= 7 && c >= 0 && c <= 7; }
    // Forward: white moves up (row-), red moves down (row+)
    const fwdDirs = player === "white" ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];

    function getCaptures(pos: number): LegalMove[] {
      const piece = board[String(pos)];
      if (!piece) return [];
      const isKing = piece.endsWith("k");
      const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
      const caps: LegalMove[] = [];

      if (isKing) {
        for (const [dr, dc] of dirs) {
          let r = row(pos) + dr, c = col(pos) + dc;
          while (inB(r, c)) {
            const mid = r * 8 + c;
            const mp = board[String(mid)];
            if (mp) {
              if (isEnemy(mp)) {
                let r2 = r + dr, c2 = c + dc;
                while (inB(r2, c2)) {
                  const dest = r2 * 8 + c2;
                  if (!board[String(dest)]) caps.push({ from: pos, over: mid, to: dest });
                  else break;
                  r2 += dr; c2 += dc;
                }
              }
              break;
            }
            r += dr; c += dc;
          }
        }
      } else {
        for (const [dr, dc] of dirs) {
          const r2 = row(pos) + dr, c2 = col(pos) + dc;
          if (!inB(r2, c2)) continue;
          const mid = r2 * 8 + c2;
          const mp = board[String(mid)];
          if (!mp || !isEnemy(mp)) continue;
          const r3 = r2 + dr, c3 = c2 + dc;
          if (inB(r3, c3) && !board[String(r3 * 8 + c3)])
            caps.push({ from: pos, over: mid, to: r3 * 8 + c3 });
        }
      }
      return caps;
    }

    function getMoves(pos: number): LegalMove[] {
      const piece = board[String(pos)];
      if (!piece) return [];
      const isKing = piece.endsWith("k");
      // Use outer fwdDirs (white=up, red=down)
      const moves: LegalMove[] = [];

      if (isKing) {
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
          let r = row(pos) + dr, c = col(pos) + dc;
          while (inB(r, c)) {
            const dest = r * 8 + c;
            if (board[String(dest)]) break;
            moves.push({ from: pos, to: dest, over: null });
            r += dr; c += dc;
          }
        }
      } else {
        for (const [dr, dc] of fwdDirs) {
          const r2 = row(pos) + dr, c2 = col(pos) + dc;
          if (inB(r2, c2) && !board[String(r2 * 8 + c2)])
            moves.push({ from: pos, to: r2 * 8 + c2, over: null });
        }
      }
      return moves;
    }

    // Chain capture: only from selected piece
    const chainPos = gs.selected;
    if (chainPos !== null && chainPos !== undefined) {
      return getCaptures(chainPos);
    }

    // All captures (mandatory)
    const allCaps: LegalMove[] = [];
    for (const [ps, piece] of Object.entries(board)) {
      if (isOwn(piece)) allCaps.push(...getCaptures(parseInt(ps)));
    }
    if (allCaps.length > 0) return allCaps;

    // Simple moves
    const allMoves: LegalMove[] = [];
    for (const [ps, piece] of Object.entries(board)) {
      if (isOwn(piece)) allMoves.push(...getMoves(parseInt(ps)));
    }
    return allMoves;
  }, [gs, myColor, challenge?.is_my_turn]);

  // ── Square click ──────────────────────────────────────────────────────────
  function handleSquareClick(pos: number) {
    if (!challenge?.is_my_turn || !isInProgress || gs?.winner) return;

    const piece = gs?.board[String(pos)];
    const isOwn = piece && myColor && piece.startsWith(myColor === "white" ? "w" : "b");
    const chainPos = gs?.selected;

    // During chain capture, can only click legal destinations from chain piece
    if (chainPos !== null && chainPos !== undefined) {
      const dest = clientLegalMoves.find(m => m.from === chainPos && m.to === pos);
      if (dest) {
        sendWS({ type: "move", from: chainPos, to: pos });
        setSelected(null);
        setLegalMoves([]);
      }
      return;
    }

    // Select own piece
    if (isOwn) {
      const movesFromHere = clientLegalMoves.filter(m => m.from === pos);
      if (movesFromHere.length > 0) {
        setSelected(pos);
        setLegalMoves(movesFromHere);
      } else {
        setSelected(null);
        setLegalMoves([]);
      }
      return;
    }

    // Click on destination
    if (selected !== null) {
      const dest = legalMoves.find(m => m.from === selected && m.to === pos);
      if (dest) {
        sendWS({ type: "move", from: selected, to: pos });
        setSelected(null);
        setLegalMoves([]);
      } else {
        setSelected(null);
        setLegalMoves([]);
      }
    }
  }

  // ── Board rendering ───────────────────────────────────────────────────────
  const legalDests = useMemo(() => new Set(legalMoves.map(m => m.to)), [legalMoves]);
  const legalSrcs  = useMemo(() => {
    if (selected) return new Set<number>();
    return new Set(clientLegalMoves.map(m => m.from));
  }, [clientLegalMoves, selected]);
  const chainPiece = gs?.selected ?? null;

  // white sees their pieces at bottom: display rows 7→0 (row 7 at top of screen = far, row 0 at bottom = near)
  // Actually: we want row 7 at BOTTOM of screen for white (their pieces are in rows 5-7)
  // So white: display rows from top=[0,1,2,...7] bottom — NO, white needs rows [0..7] with 7 at bottom
  // Simplest: white = normal board (row 0 at top, row 7 at bottom) → white pieces (rows 5-7) appear at bottom ✓
  // black = flipped (row 7 at top, row 0 at bottom) → black pieces (rows 0-2) appear at bottom ✓
  const displayRows = myColor === "black"
    ? [7,6,5,4,3,2,1,0]   // black: flipped, their pieces (rows 0-2) at bottom
    : [0,1,2,3,4,5,6,7];  // white: normal, their pieces (rows 5-7) at bottom
  const displayCols = myColor === "black"
    ? [7,6,5,4,3,2,1,0]
    : [0,1,2,3,4,5,6,7];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-themed-muted" />
    </div>
  );
  if (error && !challenge) return (
    <div className="glass-panel rounded-xl p-8 text-center max-w-md mx-auto mt-12">
      <p className="text-accent-sos mb-4">{error}</p>
      <Button onClick={() => navigate("/jogos")}>Voltar aos Jogos</Button>
    </div>
  );

  return (
    <div className="py-6 max-w-5xl mx-auto">

      {/* Countdown */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-themed-muted text-body-lg mb-4">O jogo começa em</p>
            <div className="text-[120px] font-black font-space-grotesk text-accent-gold leading-none"
              style={{ textShadow: "0 0 60px rgba(200,150,0,0.6)" }}>{countdown}</div>
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
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate("/jogos")}
          className="glass-panel p-2 rounded-xl text-themed-muted hover:text-themed-primary border border-white/10 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-h2 font-space-grotesk text-themed-primary">Damas</h1>
        <span className="text-label-caps text-themed-muted bg-white/5 px-3 py-1 rounded-full border border-white/10 font-mono">
          #{challenge?.invite_code}
        </span>
        <div className="ml-auto">
          <button onClick={() => { setChatOpen(v => !v); setUnreadChat(0); }}
            className="relative glass-panel px-3 py-2 rounded-xl text-themed-muted hover:text-themed-primary border border-white/10">
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

        {/* Board */}
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
                  <p className="text-xs text-themed-muted">
                    Adversário —
                    <span className={cn("ml-1 font-bold", myColor === "white" ? "text-zinc-400" : "text-zinc-200")}>
                      {myColor === "white" ? "⬛ Preto" : "⬜ Branco"}
                    </span>
                  </p>
                </div>
                {!challenge?.is_my_turn && isInProgress && gs && !gs.winner && (
                  <div className="flex items-center gap-1.5 text-accent-gold text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> A jogar...
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-themed-muted" />
                </div>
                <p className="text-themed-muted text-body-sm">A aguardar adversário...</p>
              </div>
            )}
          </div>

          {/* Checkers Board */}
          <div className="glass-panel luminous-edge rounded-2xl p-3 border border-accent-gold/20">
            {/* Captured pieces */}
            <div className="flex justify-between items-center px-2 pb-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: gs?.captured_white ?? 0 }).map((_, i) => (
                  <div key={i} className="w-4 h-4 rounded-full bg-gradient-to-br from-white to-zinc-200 border border-zinc-400" />
                ))}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: gs?.captured_black ?? 0 }).map((_, i) => (
                  <div key={i} className="w-4 h-4 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-950 border border-zinc-500" />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-8 border-2 border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
              {displayRows.flatMap(r =>
                displayCols.map(c => {
                  const pos = r * 8 + c;
                  const isDark = (r + c) % 2 === 1;
                  const piece = gs?.board[String(pos)] ?? null;
                  const isSel = selected === pos;
                  const isLDest = legalDests.has(pos);
                  const isLSrc  = legalSrcs.has(pos);
                  const isChain = chainPiece === pos;
                  return (
                    <Square
                      key={pos}
                      pos={pos}
                      piece={piece}
                      isDark={isDark}
                      isSelected={isSel}
                      isLegalDest={isLDest}
                      isLegalSrc={isLSrc}
                      isChainPiece={isChain}
                      myColor={myColor}
                      onClick={() => isDark ? handleSquareClick(pos) : undefined}
                    />
                  );
                })
              )}
            </div>

            {/* Coordinates */}
            <div className="flex justify-between px-2 pt-1">
              {displayCols.map(c => (
                <div key={c} className="flex-1 text-center text-[9px] text-themed-muted font-mono">
                  {String.fromCharCode(65 + c)}
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          {isFinished && (
            <div className={cn("glass-panel luminous-edge rounded-xl p-5 text-center border",
              challenge?.winner_id === user?.id ? "border-accent-feed/30" : "border-accent-sos/30")}>
              <Crown className={cn("w-10 h-10 mx-auto mb-2",
                challenge?.winner_id === user?.id ? "text-accent-gold" : "text-zinc-600")} />
              <p className="text-h3 font-space-grotesk text-themed-primary mb-1">
                {challenge?.winner_id === user?.id ? "Vitória!" : "Derrota"}
              </p>
              <p className="text-themed-muted text-body-sm capitalize mb-4">{challenge?.finish_reason}</p>
              <Button className="w-full" onClick={() => navigate("/jogos")}>
                <RotateCcw className="w-4 h-4 mr-2" /> Novo Jogo
              </Button>
            </div>
          )}

          {/* Turn indicator */}
          {isInProgress && gs && !gs.winner && (
            <div className={cn("glass-panel rounded-xl px-4 py-3 text-center border",
              challenge?.is_my_turn ? "border-accent-feed/30 bg-accent-feed/5" : "border-white/5")}>
              {gs.selected !== null && gs.selected !== undefined ? (
                <p className="text-accent-gold font-bold text-body-sm">
                  Captura em cadeia! Continua a capturar.
                </p>
              ) : (
                <p className={cn("text-body-sm font-bold",
                  challenge?.is_my_turn ? "text-accent-feed" : "text-themed-muted")}>
                  {challenge?.is_my_turn
                    ? `A tua vez ${gs.must_capture ? "— captura obrigatória!" : ""}`
                    : "Vez do adversário..."}
                </p>
              )}
            </div>
          )}

          {/* My info */}
          <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarImage src={user?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-accent-gold/20 text-accent-gold text-sm">
                {user?.full_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-bold text-themed-primary truncate">
                {user?.full_name} <span className="text-themed-muted font-normal">(Tu)</span>
              </p>
              <p className={cn("text-xs font-bold", myColor === "white" ? "text-zinc-200" : "text-zinc-400")}>
                {myColor === "white" ? "⬜ Branco" : "⬛ Preto"}
              </p>
            </div>
            {isInProgress && (
              <Button size="sm" variant="glass"
                className="border-accent-sos/30 text-accent-sos hover:bg-accent-sos/10"
                onClick={handleResign}>
                <Flag className="w-3.5 h-3.5 mr-1" /> Desistir
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4">

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
                            ? "bg-accent-gold/15 border-accent-gold/40 text-accent-gold"
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
                    <p className="text-body-sm font-semibold text-themed-primary truncate">
                      {challenge.opponent.full_name}
                    </p>
                    <p className="text-xs text-accent-feed">Pronto para jogar</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 glass-panel rounded-xl px-3 py-2.5 mb-4 border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin text-themed-muted" />
                  </div>
                  <p className="text-body-sm text-themed-muted">A aguardar adversário...</p>
                </div>
              )}

              {isCreator && challenge?.opponent && (
                <Button className="w-full bg-accent-gold text-zinc-950 hover:brightness-110" onClick={handleStart}>
                  Iniciar Partida
                </Button>
              )}
            </div>
          )}

          {/* Stats */}
          {(isInProgress || isFinished) && (
            <div className="glass-panel luminous-edge rounded-xl p-5">
              <h3 className="text-body-md font-bold text-themed-primary mb-4">Peças capturadas</h3>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-xs text-themed-muted mb-1">Brancas capturadas</p>
                  <p className="text-2xl font-black text-zinc-200">{gs?.captured_white ?? 0}</p>
                </div>
                <div className="text-themed-muted">vs</div>
                <div className="text-right">
                  <p className="text-xs text-themed-muted mb-1">Pretas capturadas</p>
                  <p className="text-2xl font-black text-zinc-400">{gs?.captured_black ?? 0}</p>
                </div>
              </div>
              <p className="text-xs text-themed-muted text-center">Movimentos: {gs?.move_count ?? 0}</p>
            </div>
          )}

          {/* Chat */}
          {chatOpen && (
            <div className="glass-panel luminous-edge rounded-xl overflow-hidden flex flex-col" style={{ height: 300 }}>
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h4 className="text-body-sm font-bold text-themed-primary">Chat</h4>
                <button onClick={() => setChatOpen(false)} className="text-themed-muted hover:text-themed-primary">
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {chatMsgs.map((m, i) => (
                  <div key={i} className={cn("flex gap-2 items-start", m.sender.id === user?.id && "flex-row-reverse")}>
                    <Avatar className="w-6 h-6 flex-shrink-0">
                      <AvatarImage src={m.sender.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-white/10">{m.sender.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className={cn("px-3 py-1.5 rounded-xl text-xs max-w-[75%]",
                      m.sender.id === user?.id ? "bg-accent-gold/20 text-themed-primary" : "glass-panel text-themed-secondary")}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatMsgs.length === 0 && (
                  <p className="text-themed-muted text-xs text-center mt-8">Sem mensagens ainda.</p>
                )}
                <div ref={chatBottomRef} />
              </div>
              <form onSubmit={sendChat} className="p-3 border-t border-white/5 flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  className="flex-1 glass-panel border border-white/10 rounded-xl px-3 py-2 text-xs text-themed-primary outline-none focus:border-accent-gold/50"
                  placeholder="Escreve uma mensagem..." />
                <button type="submit"
                  className="glass-panel p-2 rounded-xl text-themed-muted hover:text-themed-primary border border-white/10">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

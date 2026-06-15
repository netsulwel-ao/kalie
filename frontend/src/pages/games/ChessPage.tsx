/**
 * Chess — real-time via WebSocket.
 * Backend is the source of truth for all moves.
 * chess.js used only for legal-move hints on the frontend.
 */
import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Chess, Square } from "chess.js";
import {
  ArrowLeft, Copy, Check, RotateCcw, Flag, Loader2,
  Share2, Send, Clock, Crown, MessageCircle, X, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import api, { extractApiError } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Player { id: string; username: string; full_name: string; avatar_url: string | null; }
interface GameState { fen: string; moves: string[]; is_check: boolean; is_checkmate: boolean; is_stalemate: boolean; is_game_over: boolean; }
interface ChallengeData {
  id: string; game_type: string; status: string; invite_code: string;
  time_control: number;
  current_turn: string | null; creator_color: string | null;
  game_state: GameState | null; winner_id: string | null; finish_reason: string | null;
  creator: Player | null; opponent: Player | null;
  is_my_turn: boolean; my_color: "white" | "black" | null;
}
interface ChatMsg { sender: Player; text: string; ts: string; }

// ── Piece map ─────────────────────────────────────────────────────────────────
const PIECE_UNICODE: Record<string, string> = {
  wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",
  bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟",
};

// ── Board square ──────────────────────────────────────────────────────────────
function BoardSquare({ square, piece, isLight, isSelected, isLegalMove, isLastMove, isCheck, onClick }: {
  square: Square; piece: string | null; isLight: boolean;
  isSelected: boolean; isLegalMove: boolean; isLastMove: boolean; isCheck: boolean;
  onClick: () => void;
}) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  const isKingInCheck = isCheck && (piece === "wK" || piece === "bK");

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center cursor-pointer select-none transition-all duration-100",
        isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]",
        isSelected && "brightness-125 ring-2 ring-inset ring-accent-bisno",
        isLastMove && !isSelected && "brightness-110",
        isKingInCheck && "bg-red-500",
      )}
      style={{ aspectRatio: "1" }}
    >
      {isLegalMove && (
        <div className={cn(
          "absolute rounded-full pointer-events-none z-10",
          piece ? "inset-0 ring-4 ring-inset ring-accent-bisno/70" : "w-[34%] h-[34%] bg-black/20 rounded-full",
        )} />
      )}
      {piece && (
        <span className={cn(
          "text-3xl md:text-4xl leading-none z-20 pointer-events-none",
          piece[0] === "w"
            ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
            : "text-zinc-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]",
        )}>
          {PIECE_UNICODE[piece]}
        </span>
      )}
      {file === 0 && (
        <span className={cn("absolute top-0.5 left-0.5 text-[9px] font-bold leading-none select-none", isLight ? "text-[#b58863]" : "text-[#f0d9b5]")}>
          {rank + 1}
        </span>
      )}
      {rank === 0 && (
        <span className={cn("absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none select-none", isLight ? "text-[#b58863]" : "text-[#f0d9b5]")}>
          {String.fromCharCode(97 + file)}
        </span>
      )}
    </div>
  );
}

// ── Chess board ───────────────────────────────────────────────────────────────
function ChessBoard({ fen, myColor, isMyTurn, lastMove, onMove }: {
  fen: string; myColor: "white" | "black" | null;
  isMyTurn: boolean; lastMove: string | null; onMove: (uci: string) => void;
}) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  // chess instance with the REAL fen (for rendering pieces)
  const chess = useMemo(() => {
    try { return new Chess(fen); } catch { return new Chess(); }
  }, [fen]);

  // chess instance with the turn FORCED to the current player's color
  // This is needed because chess.js only returns moves for the side whose turn it is.
  // The backend is the real validator — we only use this for visual hints.
  const chessForMoves = useMemo(() => {
    if (!myColor) return chess;
    try {
      // Parse the FEN and replace the active color field
      const parts = fen.split(" ");
      if (parts.length >= 2) {
        parts[1] = myColor === "white" ? "w" : "b";
        // Also clear en passant and reset half-move clock to avoid illegal state
        const modifiedFen = parts.join(" ");
        const c = new Chess(modifiedFen);
        return c;
      }
    } catch { /* fall through */ }
    return chess;
  }, [fen, myColor, chess]);

  // Reset selection whenever the FEN changes (after a move or turn switch)
  useEffect(() => { setSelected(null); setLegalMoves([]); }, [fen]);

  const files = ["a","b","c","d","e","f","g","h"];
  const ranks = [8,7,6,5,4,3,2,1];
  const displayRanks = myColor === "black" ? [1,2,3,4,5,6,7,8] : ranks;
  const displayFiles = myColor === "black" ? [...files].reverse() : files;
  const lastMoveSquares = lastMove
    ? [lastMove.slice(0,2) as Square, lastMove.slice(2,4) as Square]
    : [];

  function getLegalMovesFor(sq: Square): Square[] {
    // Use the turn-forced chess instance to get legal destinations
    try {
      return chessForMoves
        .moves({ square: sq, verbose: true })
        .map((m) => m.to as Square);
    } catch {
      return [];
    }
  }

  function handleClick(sq: Square) {
    if (!isMyTurn) return;

    const myChessColor = myColor === "white" ? "w" : "b";
    // Use the REAL chess instance to get the piece (correct position)
    const piece = chess.get(sq);

    if (selected) {
      // Clicked a legal destination → send move to backend
      if (legalMoves.includes(sq)) {
        const movingPiece = chess.get(selected);
        let uci = `${selected}${sq}`;
        // Auto-promote to queen
        if (movingPiece?.type === "p") {
          const targetRank = sq[1];
          if (
            (movingPiece.color === "w" && targetRank === "8") ||
            (movingPiece.color === "b" && targetRank === "1")
          ) {
            uci += "q";
          }
        }
        onMove(uci);
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      // Clicked another own piece → switch selection
      if (piece && piece.color === myChessColor) {
        const moves = getLegalMovesFor(sq);
        setSelected(sq);
        setLegalMoves(moves);
        return;
      }

      // Clicked empty or enemy square that isn't a legal move → deselect
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    // Nothing selected — select own piece
    if (piece && piece.color === myChessColor) {
      const moves = getLegalMovesFor(sq);
      setSelected(sq);
      setLegalMoves(moves);
    }
  }

  return (
    <div className="w-full max-w-[500px] mx-auto">
      <div className="grid grid-cols-8 border-2 border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
        {displayRanks.flatMap((rank) =>
          displayFiles.map((file) => {
            const sq = `${file}${rank}` as Square;
            const piece = chess.get(sq);
            const pieceStr = piece ? `${piece.color}${piece.type.toUpperCase()}` : null;
            const fileIdx = files.indexOf(file);
            const rankIdx = rank - 1;
            const isLight = (fileIdx + rankIdx) % 2 !== 0;
            return (
              <BoardSquare
                key={sq} square={sq} piece={pieceStr} isLight={isLight}
                isSelected={selected === sq}
                isLegalMove={legalMoves.includes(sq)}
                isLastMove={lastMoveSquares.includes(sq)}
                isCheck={chess.inCheck()}
                onClick={() => handleClick(sq)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Player clock ──────────────────────────────────────────────────────────────
function PlayerClock({ isActive, initialSeconds }: { isActive: boolean; initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  // Reset when initialSeconds changes (new game or time control change)
  useEffect(() => { setSeconds(initialSeconds); }, [initialSeconds]);

  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const isLow = seconds < 30;
  const isEmpty = seconds === 0;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold transition-all",
      isEmpty
        ? "bg-accent-sos/30 text-accent-sos border border-accent-sos/50 animate-pulse"
        : isActive
          ? isLow
            ? "bg-accent-sos/20 text-accent-sos border border-accent-sos/30"
            : "bg-accent-feed/10 text-accent-feed border border-accent-feed/20"
          : "bg-white/5 text-themed-muted border border-white/5",
    )}>
      <Clock className="w-3.5 h-3.5" />
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ChessPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedTime, setSelectedTime] = useState(600); // seconds, default 10min

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Countdown
  const [countdown, setCountdown] = useState<number | null>(null);

  // Disconnect tracking
  const [disconnected, setDisconnected] = useState<{ name: string; secondsLeft: number } | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Derived state
  const isInProgress = challenge?.status === "in_progress";

  // Block navigation with beforeunload (simpler than useBlocker)
  useEffect(() => {
    if (!isInProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Tens uma partida em curso. Se saíres, perderás por desistência.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isInProgress]);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.get(`/games/challenges/${challengeId}`)
      .then(({ data }) => {
        setChallenge(data);
        if (data.time_control) setSelectedTime(data.time_control);
      })
      .catch((e) => setError(extractApiError(e)))
      .finally(() => setLoading(false));
  }, [challengeId]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
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
        } else if (msg.type === "chat") {
          setChatMessages((prev) => [...prev, msg]);
          // Use ref to avoid stale closure
          if (!chatOpenRef.current) setUnreadChat((n) => n + 1);
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        } else if (msg.type === "countdown") {
          setCountdown(msg.seconds);
        } else if (msg.type === "started") {
          setCountdown(null);
        } else if (msg.type === "player_joined" || msg.type === "player_reconnected") {
          if (msg.challenge) {
            setChallenge(msg.challenge);
          } else {
            api.get(`/games/challenges/${challengeId}`).then(({ data }) => setChallenge(data));
          }
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
                if (prev.secondsLeft <= 1) {
                  clearInterval(disconnectTimerRef.current!);
                  return null;
                }
                return { ...prev, secondsLeft: prev.secondsLeft - 1 };
              });
            }, 1000);
          }
        } else if (msg.type === "error") {
          // Log backend errors for debugging
          console.warn("[Chess WS error]", msg.detail);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      reconnectRef.current = setTimeout(connectWS, 2000);
    };
  // Only challengeId as dependency — chatOpen handled via ref
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

  // ── Actions ───────────────────────────────────────────────────────────────
  function sendWS(msg: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function handleMove(uci: string) {
    sendWS({ type: "move", move: uci });
  }

  function handleStart() {
    sendWS({ type: "start", time_control: selectedTime });
  }

  function handleResign() {
    if (!confirm("Tens a certeza que queres desistir? Perderás a partida.")) return;
    sendWS({ type: "resign" });
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendWS({ type: "chat", text: chatInput.trim() });
    setChatInput("");
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/jogos/xadrez/${challengeId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const url = `${window.location.origin}/jogos/xadrez/${challengeId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Desafio-te para Xadrez no Kalie! Entra aqui: ${url}`)}`);
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const isCreator = !!(user?.id && challenge?.creator?.id && String(user.id) === String(challenge.creator.id));
  const fen = challenge?.game_state?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const moves = challenge?.game_state?.moves ?? [];
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  const isFinished = challenge?.status === "finished";
  const isWaiting = challenge?.status === "waiting";
  // isInProgress defined above (needed for useBlocker)
  const opponent = isCreator ? challenge?.opponent : challenge?.creator;
  const opponentColor = challenge?.my_color === "white" ? "Pretas" : "Brancas";
  const myColorLabel = challenge?.my_color === "white" ? "Brancas" : "Pretas";

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

      {/* ── Countdown overlay ──────────────────────────────────── */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-themed-muted text-body-lg mb-4">O jogo começa em</p>
            <div className="text-[120px] font-black font-space-grotesk text-accent-bisno leading-none"
              style={{ textShadow: "0 0 60px rgba(0,229,255,0.5)" }}>
              {countdown}
            </div>
          </div>
        </div>
      )}

      {/* ── Disconnect warning ─────────────────────────────────── */}
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

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/jogos")} className="text-themed-muted hover:text-themed-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-h2 font-space-grotesk text-themed-primary">Xadrez</h1>
        <span className="text-label-caps text-themed-muted bg-white/5 px-3 py-1 rounded-full border border-white/10 font-mono">
          #{challenge?.invite_code}
        </span>
        <div className="ml-auto flex items-center gap-2">
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

        {/* ── Board column ───────────────────────────────────────── */}
        <div className="lg:col-span-8 flex flex-col gap-3">

          {/* Opponent row */}
          <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
            {opponent ? (
              <>
                <Avatar className="w-9 h-9 flex-shrink-0">
                  <AvatarImage src={opponent.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-white/10 text-sm">{opponent.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-bold text-themed-primary truncate">{opponent.full_name}</p>
                  <p className="text-xs text-themed-muted">{opponentColor}</p>
                </div>
                {isInProgress && (
                  <PlayerClock
                    isActive={!challenge.is_my_turn}
                    initialSeconds={challenge.time_control ?? 600}
                  />
                )}
                {!challenge?.is_my_turn && isInProgress && (
                  <div className="flex items-center gap-1.5 text-accent-bisno text-xs ml-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    A pensar...
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

          {/* Board */}
          <ChessBoard
            fen={fen}
            myColor={challenge?.my_color ?? "white"}
            isMyTurn={!!challenge?.is_my_turn && isInProgress}
            lastMove={lastMove}
            onMove={handleMove}
          />

          {/* My row */}
          <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarImage src={user?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-accent-bisno/20 text-accent-bisno text-sm">{user?.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-bold text-themed-primary truncate">
                {user?.full_name} <span className="text-themed-muted font-normal">(Tu)</span>
              </p>
              <p className="text-xs text-themed-muted">{myColorLabel}</p>
            </div>
            {isInProgress && (
              <PlayerClock
                isActive={!!challenge?.is_my_turn}
                initialSeconds={challenge?.time_control ?? 600}
              />
            )}
            {challenge?.is_my_turn && isInProgress && (
              <span className="text-accent-feed text-xs font-bold ml-1">A tua vez</span>
            )}
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Result */}
          {isFinished && (
            <div className={cn("glass-panel luminous-edge rounded-xl p-5 text-center border",
              challenge?.winner_id === user?.id ? "border-accent-feed/30" : "border-accent-sos/30")}>
              <Crown className={cn("w-10 h-10 mx-auto mb-2", challenge?.winner_id === user?.id ? "text-accent-gold" : "text-zinc-600")} />
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

          {/* Waiting — invite panel */}
          {isWaiting && (
            <div className="glass-panel luminous-edge rounded-xl p-5">
              <h3 className="text-body-md font-bold text-themed-primary mb-1">Sala de Espera</h3>
              <p className="text-body-sm text-themed-muted mb-4">
                Partilha o código ou link para o adversário entrar.
              </p>

              {/* Time control — só o criador vê */}
              {isCreator && (
                <div className="mb-4">
                  <p className="text-label-caps text-themed-muted uppercase mb-2">Tempo por jogador</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "1 min",  secs: 60  },
                      { label: "3 min",  secs: 180 },
                      { label: "5 min",  secs: 300 },
                      { label: "10 min", secs: 600 },
                    ].map(({ label, secs }) => (
                      <button
                        key={secs}
                        onClick={() => setSelectedTime(secs)}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold border transition-all",
                          selectedTime === secs
                            ? "bg-accent-bisno/15 border-accent-bisno/40 text-accent-bisno"
                            : "glass-panel border-white/5 text-themed-muted hover:border-white/15",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite code */}
              <div className="text-center glass-panel rounded-xl py-4 mb-4 border border-white/5">
                <p className="text-label-caps text-themed-muted uppercase mb-1">Código</p>
                <p className="text-3xl font-black font-mono text-themed-primary tracking-[0.2em]">
                  {challenge?.invite_code}
                </p>
              </div>

              {/* Share buttons */}
              <div className="flex gap-2 mb-4">
                <Button variant="glass" className="flex-1" onClick={copyInviteLink}>
                  {copied
                    ? <><Check className="w-4 h-4 mr-2 text-accent-feed" />Copiado!</>
                    : <><Copy className="w-4 h-4 mr-2" />Copiar Link</>}
                </Button>
                <Button variant="glass" onClick={shareWhatsApp} title="Partilhar no WhatsApp">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Opponent status */}
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
                  <div className="w-2 h-2 rounded-full bg-accent-feed animate-pulse flex-shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-themed-muted text-body-sm mb-4">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  A aguardar que o adversário entre...
                </div>
              )}

              {/* Start button — só o criador, só activo com adversário */}
              {isCreator && (
                <Button
                  className={cn(
                    "w-full font-bold transition-all",
                    challenge?.opponent
                      ? "bg-accent-feed text-surface hover:brightness-110 shadow-glow-feed"
                      : "bg-white/5 text-themed-muted cursor-not-allowed border border-white/10",
                  )}
                  disabled={!challenge?.opponent}
                  onClick={handleStart}
                >
                  {challenge?.opponent ? "Iniciar Partida" : "Aguarda o adversário"}
                </Button>
              )}

              {/* Opponent view — waiting for creator */}
              {!isCreator && (
                <div className="text-center text-themed-muted text-body-sm py-2">
                  A aguardar que o criador inicie a partida...
                </div>
              )}
            </div>
          )}

          {/* Move history */}
          <div className="glass-panel luminous-edge rounded-xl p-4 flex-1 min-h-0">
            <h3 className="text-body-sm font-bold text-themed-primary mb-3">Movimentos</h3>
            <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-1">
              {moves.length === 0 ? (
                <p className="text-themed-muted text-xs">Sem movimentos ainda.</p>
              ) : (
                Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
                  <div key={i} className="flex gap-2 text-xs py-0.5 hover:bg-white/3 rounded px-1">
                    <span className="text-themed-muted w-5 flex-shrink-0">{i + 1}.</span>
                    <span className="text-themed-primary font-mono">{moves[i * 2]}</span>
                    {moves[i * 2 + 1] && <span className="text-themed-secondary font-mono">{moves[i * 2 + 1]}</span>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          {isInProgress && (
            <Button variant="glass" onClick={handleResign} className="w-full border-accent-sos/20 text-accent-sos hover:bg-accent-sos/10">
              <Flag className="w-4 h-4 mr-2" />
              Desistir
            </Button>
          )}
        </div>
      </div>

      {/* ── Chat panel ─────────────────────────────────────────── */}
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
              <p className="text-themed-muted text-xs text-center mt-4">Sem mensagens ainda. Diz olá!</p>
            )}
            {chatMessages.map((msg, i) => {
              const isMe = msg.sender.id === user?.id;
              return (
                <div key={i} className={cn("flex gap-2 max-w-[90%]", isMe && "ml-auto flex-row-reverse")}>
                  <Avatar className="w-6 h-6 flex-shrink-0">
                    <AvatarImage src={msg.sender.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-white/10">{msg.sender.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={cn("px-3 py-2 rounded-xl text-xs", isMe ? "bg-accent-bisno/20 text-themed-primary" : "bg-white/5 text-themed-secondary")}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          <form onSubmit={sendChat} className="flex gap-2 p-3 border-t border-white/5">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 input-themed rounded-full px-3 py-2 text-xs"
              placeholder="Escreve uma mensagem..."
              maxLength={200}
            />
            <button type="submit" className="text-accent-bisno hover:brightness-110 transition-all flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}


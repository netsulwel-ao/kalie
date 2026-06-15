/**
 * Tic-Tac-Toe (Jogo da Velha) — multiplayer em tempo real via WebSocket.
 * Mesma arquitectura do ChessPage: backend é fonte de verdade.
 */
import { useState, useEffect, useCallback, useRef } from "react";
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
interface TTTState {
  board: (string | null)[];   // 9 cells: null | "X" | "O"
  current_player: string;     // user id
  winner: string | null;      // user id or "draw"
  game_started: boolean;
  move_count: number;
}
interface ChallengeData {
  id: string; game_type: string; status: string; invite_code: string;
  game_state: TTTState | null;
  winner_id: string | null; finish_reason: string | null;
  creator: Player | null; opponent: Player | null;
  is_my_turn: boolean; my_color: string | null; // "X" or "O"
}
interface ChatMsg { sender: Player; text: string; ts: string; }

const WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6],          // diags
];

function getWinLine(board: (string | null)[]): number[] | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

export default function TicTacToePage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [disconnected, setDisconnected] = useState<{ name: string; secondsLeft: number } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedTime, setSelectedTime] = useState(300);
  const [moving, setMoving] = useState(false);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [wsReady, setWsReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const chatOpenRef = useRef(chatOpen);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  // Load initial challenge data
  useEffect(() => {
    api.get(`/games/challenges/${challengeId}`)
      .then(r => { setChallenge(r.data); setLoading(false); })
      .catch(e => { setError(extractApiError(e)); setLoading(false); });
  }, [challengeId]);

  // Poll for opponent while waiting (fallback for WS race conditions)
  useEffect(() => {
    if (challenge?.status !== "waiting" || challenge?.opponent) return;
    const interval = setInterval(() => {
      api.get(`/games/challenges/${challengeId}`)
        .then(r => {
          if (r.data.opponent) setChallenge(r.data);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [challenge?.status, challenge?.opponent, challengeId]);

  // Update win line when board changes
  useEffect(() => {
    const board = challenge?.game_state?.board;
    if (board) setWinLine(getWinLine(board));
    else setWinLine(null);
  }, [challenge?.game_state?.board]);

  const connectWS = useCallback(() => {
    if (!challengeId) return;
    const token = localStorage.getItem("access_token");
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/game/${challengeId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      setWsReady(true);
      setError("");
    };

    // Heartbeat — send ping every 25s to keep connection alive
    const heartbeatRef = { current: 0 };
    heartbeatRef.current = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* ignore */ }
      }
    }, 25000);

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      const msg = JSON.parse(e.data);

      if (msg.type === "state" || msg.type === "state_update") {
        setChallenge(msg.challenge);
        setCountdown(null);
        setStarting(false); // reset start button
        setMoving(false);   // reset move state
      } else if (msg.type === "player_joined" || msg.type === "player_reconnected") {
        // Opponent joined or reconnected — update challenge state
        if (msg.challenge) setChallenge(msg.challenge);
        if (msg.type === "player_reconnected") {
          setDisconnected(null);
          if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
        }
      } else if (msg.type === "started") {
        // Backend broadcasts "started" then immediately "state" — just clear countdown
        setCountdown(null);
        setStarting(false);
      } else if (msg.type === "countdown") {
        setCountdown(msg.seconds);
      } else if (msg.type === "chat") {
        setChatMsgs(p => [...p, msg]);
        if (!chatOpenRef.current) setUnreadChat(p => p + 1);
      } else if (msg.type === "player_disconnected") {
        setDisconnected({ name: msg.player_name, secondsLeft: 30 });
        if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = setInterval(() => {
          setDisconnected(d => d ? d.secondsLeft <= 1 ? null : { ...d, secondsLeft: d.secondsLeft - 1 } : null);
        }, 1000);
      } else if (msg.type === "error") {
        setError(msg.detail || msg.message || "Erro desconhecido");
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setWsReady(false);
      reconnectRef.current = setTimeout(connectWS, 3000);
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

  // Send via WS — wait up to 3s for connection to be OPEN
  function sendWS(msg: object) {
    const ws = wsRef.current;
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return;
    }
    // WS not yet open — wait and retry (e.g. after page reload)
    if (ws.readyState === WebSocket.CONNECTING) {
      const payload = JSON.stringify(msg);
      const onOpen = () => {
        ws.send(payload);
        ws.removeEventListener("open", onOpen);
      };
      ws.addEventListener("open", onOpen);
      // Safety timeout — remove listener if never opens
      setTimeout(() => ws.removeEventListener("open", onOpen), 5000);
    }
  }

  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    setError("");

    // Wait for WS if not yet open
    if (!wsReady) {
      setError("A ligar ao servidor... tenta novamente em 2 segundos.");
      setStarting(false);
      return;
    }

    // Verify opponent via REST
    try {
      const { data } = await api.get(`/games/challenges/${challengeId}`);
      if (!data.opponent) {
        setError("O adversário ainda não entrou na sala.");
        setStarting(false);
        return;
      }
      setChallenge(data);
    } catch { /* ignore */ }

    wsRef.current!.send(JSON.stringify({ type: "start", time_control: selectedTime }));
    setTimeout(() => setStarting(false), 10000);
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
    navigator.clipboard.writeText(`${window.location.origin}/jogos/tictactoe/${challengeId}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  function shareWhatsApp() {
    const url = `${window.location.origin}/jogos/tictactoe/${challengeId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Desafio-te para Jogo da Velha no Kalie! Entra aqui: ${url}`)}`);
  }

  async function handleCellClick(idx: number) {
    if (!wsReady) {
      setError("A ligar ao servidor... tenta novamente.");
      return;
    }
    setMoving(true);
    setError("");
    wsRef.current!.send(JSON.stringify({ type: "move", position: idx }));
    setTimeout(() => setMoving(false), 1500);
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const gs = challenge?.game_state;
  const board = gs?.board ?? Array(9).fill(null);
  const isCreator = challenge?.creator?.id === user?.id;
  const opponent = isCreator ? challenge?.opponent : challenge?.creator;
  const mySymbol = challenge?.my_color ?? "X";
  const isWaiting = challenge?.status === "waiting";
  const isInProgress = challenge?.status === "in_progress";
  const isFinished = challenge?.status === "finished";
  const isDraw = challenge?.finish_reason === "draw" || gs?.winner === "draw";

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

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-themed-muted text-body-lg mb-4">O jogo começa em</p>
            <div className="text-[120px] font-black font-space-grotesk text-accent-games leading-none"
              style={{ textShadow: "0 0 60px rgba(191,90,242,0.5)" }}>{countdown}</div>
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
        <button onClick={() => navigate("/jogos")} className="glass-panel p-2 rounded-xl text-themed-muted hover:text-themed-primary border border-white/10 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-h2 font-space-grotesk text-themed-primary">Jogo da Velha</h1>
        <span className="text-label-caps text-themed-muted bg-white/5 px-3 py-1 rounded-full border border-white/10 font-mono">
          #{challenge?.invite_code}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setChatOpen(v => !v); setUnreadChat(0); }}
            className="relative glass-panel px-3 py-2 rounded-xl text-themed-muted hover:text-themed-primary transition-all border border-white/10">
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

          {/* Opponent info */}
          <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
            {opponent ? (
              <>
                <Avatar className="w-9 h-9 flex-shrink-0">
                  <AvatarImage src={opponent.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-white/10 text-sm">{opponent.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-bold text-themed-primary truncate">{opponent.full_name}</p>
                  <p className="text-xs text-themed-muted">Adversário — {mySymbol === "X" ? "O" : "X"}</p>
                </div>
                {!challenge?.is_my_turn && isInProgress && (
                  <div className="flex items-center gap-1.5 text-accent-games text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> A jogar...
                  </div>
                )}
              </>
            ) : (
              <p className="text-themed-muted text-body-sm">A aguardar adversário...</p>
            )}
          </div>

          {/* TTT Board */}
          <div className="glass-panel luminous-edge rounded-2xl p-6 flex items-center justify-center"
            style={{ minHeight: 340 }}>
            <div className="w-full max-w-xs aspect-square">
              <div className="grid grid-cols-3 gap-2 w-full h-full">
                {board.map((cell, idx) => {
                  const isWinCell = winLine?.includes(idx);
                  const canClick = challenge?.is_my_turn && !cell && isInProgress && !gs?.winner && wsReady;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleCellClick(idx)}
                      disabled={!canClick || moving}
                      className={cn(
                        "aspect-square rounded-2xl flex items-center justify-center text-5xl font-black font-space-grotesk transition-all duration-200 border-2",
                        isWinCell
                          ? "bg-accent-games/20 border-accent-games/60 shadow-[0_0_20px_rgba(191,90,242,0.4)]"
                          : "glass-panel border-white/10",
                        canClick && !cell && "hover:bg-white/10 hover:border-white/30 cursor-pointer",
                        !canClick && "cursor-default",
                      )}
                    >
                      {cell === "X" && (
                        <span className={cn("transition-all", isWinCell ? "text-accent-games" : "text-accent-sos")}>✕</span>
                      )}
                      {cell === "O" && (
                        <span className={cn("transition-all", isWinCell ? "text-accent-games" : "text-accent-bisno")}>○</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Result banner */}
          {isFinished && (
            <div className={cn("glass-panel luminous-edge rounded-xl p-5 text-center border",
              isDraw ? "border-accent-gold/30" :
              challenge?.winner_id === user?.id ? "border-accent-feed/30" : "border-accent-sos/30")}>
              <Crown className={cn("w-10 h-10 mx-auto mb-2",
                isDraw ? "text-accent-gold" :
                challenge?.winner_id === user?.id ? "text-accent-gold" : "text-zinc-600")} />
              <p className="text-h3 font-space-grotesk text-themed-primary mb-1">
                {isDraw ? "Empate!" :
                  challenge?.winner_id === user?.id ? "Vitória!" : "Derrota"}
              </p>
              <p className="text-themed-muted text-body-sm capitalize mb-4">{challenge?.finish_reason}</p>
              <Button className="w-full" onClick={() => navigate("/jogos")}>
                <RotateCcw className="w-4 h-4 mr-2" /> Novo Jogo
              </Button>
            </div>
          )}

          {/* Turn indicator */}
          {isInProgress && !isFinished && !gs?.winner && (
            <div className={cn("glass-panel rounded-xl px-4 py-3 text-center border",
              challenge?.is_my_turn ? "border-accent-feed/30 bg-accent-feed/5" : "border-white/5")}>
              <p className={cn("text-body-sm font-bold",
                challenge?.is_my_turn ? "text-accent-feed" : "text-themed-muted")}>
                {challenge?.is_my_turn ? `A tua vez — joga ${mySymbol}` : "Vez do adversário..."}
              </p>
            </div>
          )}

          {/* My info + resign */}
          <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarImage src={user?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-accent-games/20 text-accent-games text-sm">{user?.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-bold text-themed-primary truncate">
                {user?.full_name} <span className="text-themed-muted font-normal">(Tu)</span>
              </p>
              <p className="text-xs font-bold text-accent-games">{mySymbol === "X" ? "✕ X" : "○ O"}</p>
            </div>
            {isInProgress && (
              <Button size="sm" variant="glass" className="border-accent-sos/30 text-accent-sos hover:bg-accent-sos/10" onClick={handleResign}>
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
                <Button
                  className="w-full bg-accent-games text-white hover:brightness-110 disabled:opacity-50"
                  onClick={handleStart}
                  disabled={starting || !wsReady}
                >
                  {starting
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />A iniciar...</>
                    : !wsReady
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />A ligar...</>
                    : "Iniciar Partida"}
                </Button>
              )}
            </div>
          )}

          {/* Score panel */}
          {(isInProgress || isFinished) && (
            <div className="glass-panel luminous-edge rounded-xl p-5">
              <h3 className="text-body-md font-bold text-themed-primary mb-4">Pontuação</h3>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-4xl font-black text-accent-sos">✕</p>
                  <p className="text-xs text-themed-muted mt-1">X</p>
                </div>
                <div className="text-themed-muted text-2xl font-bold">vs</div>
                <div className="text-center">
                  <p className="text-4xl font-black text-accent-bisno">○</p>
                  <p className="text-xs text-themed-muted mt-1">O</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-xs text-themed-muted">Movimentos: {gs?.move_count ?? 0}</p>
              </div>
            </div>
          )}

          {/* Chat */}
          {chatOpen && (
            <div className="glass-panel luminous-edge rounded-xl overflow-hidden flex flex-col" style={{ height: 320 }}>
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
                      m.sender.id === user?.id ? "bg-accent-games/20 text-themed-primary" : "glass-panel text-themed-secondary")}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatMsgs.length === 0 && (
                  <p className="text-themed-muted text-xs text-center mt-8">Sem mensagens ainda.</p>
                )}
              </div>
              <form onSubmit={sendChat} className="p-3 border-t border-white/5 flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  className="flex-1 glass-panel border border-white/10 rounded-xl px-3 py-2 text-xs text-themed-primary outline-none focus:border-accent-games/50"
                  placeholder="Escreve uma mensagem..." />
                <button type="submit" className="glass-panel p-2 rounded-xl text-themed-muted hover:text-themed-primary border border-white/10">
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

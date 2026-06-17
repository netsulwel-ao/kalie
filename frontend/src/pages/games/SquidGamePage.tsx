/**
 * Squid Game — Luz Verde / Luz Vermelha
 * Canvas multiplayer. Vista de cima.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

interface Player {
  id: string; name: string;
  x: number; y: number;
  moving: boolean; alive: boolean; finished: boolean;
  blood: { x: number; y: number }[];
}
interface GameState {
  light: "green" | "red";
  game_status: "waiting" | "countdown" | "running" | "finished";
  players: Player[];
  winner: string | null;
  you: string;
  time_left: number;
}
interface ChatMsg { name: string; text: string; }

const COLORS = ["#22c55e","#3b82f6","#f59e0b","#ec4899","#a855f7","#14b8a6","#f97316","#6366f1"];
function pColor(id: string) {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

function drawField(ctx: CanvasRenderingContext2D, w: number, h: number, light: "green"|"red") {
  // Grass
  ctx.fillStyle = "#15542a"; ctx.fillRect(0, 0, w, h);
  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath(); ctx.moveTo((i/10)*w, 0); ctx.lineTo((i/10)*w, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (i/10)*h); ctx.lineTo(w, (i/10)*h); ctx.stroke();
  }
  // Finish zone
  const fy = 0.1 * h;
  ctx.fillStyle = "rgba(239,68,68,0.15)"; ctx.fillRect(0, 0, w, fy);
  ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 4;
  ctx.setLineDash([14, 6]);
  ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(w, fy); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ef4444"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("▲  CHEGADA  ▲", w/2, fy - 5); ctx.textAlign = "left";
  // Start line
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 2;
  ctx.setLineDash([8,4]);
  ctx.beginPath(); ctx.moveTo(0, 0.91*h); ctx.lineTo(w, 0.91*h); ctx.stroke();
  ctx.setLineDash([]);
  // Doll
  const dx = w/2, dy = fy - 22;
  ctx.fillStyle = light === "red" ? "#ff2020" : "#20dd60";
  ctx.beginPath(); ctx.arc(dx, dy, 15, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
  if (light === "red") {
    ctx.fillStyle="#fff";
    ctx.beginPath(); ctx.arc(dx-5,dy-2,3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(dx+5,dy-2,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#111";
    ctx.beginPath(); ctx.arc(dx-5,dy-2,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(dx+5,dy-2,1.5,0,Math.PI*2); ctx.fill();
  }
}

function drawPlayers(ctx: CanvasRenderingContext2D, w: number, h: number, players: Player[], myId: string) {
  // Blood first
  for (const p of players) {
    for (const b of p.blood) {
      const bx = b.x*w, by = b.y*h;
      ctx.fillStyle = "rgba(150,0,0,0.75)";
      ctx.beginPath(); ctx.arc(bx, by, 15, 0, Math.PI*2); ctx.fill();
      for (let s = 0; s < 8; s++) {
        const a = (s/8)*Math.PI*2, d = 10 + Math.sin(s*11)*7;
        ctx.beginPath(); ctx.arc(bx+Math.cos(a)*d, by+Math.sin(a)*d, 3, 0, Math.PI*2); ctx.fill();
      }
    }
  }
  // Players
  for (const p of players) {
    if (!p.alive) continue;
    const px = p.x*w, py = p.y*h;
    const isMe = p.id === myId, r = isMe ? 12 : 9;
    const col = pColor(p.id);
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.ellipse(px, py+r+1, r*0.8, 3, 0, 0, Math.PI*2); ctx.fill();
    // Body
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
    // Moving ring
    if (p.moving) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5;
      ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(px, py, r+5, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Me ring
    if (isMe) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px, py, r+4, 0, Math.PI*2); ctx.stroke();
    }
    // Finish
    if (p.finished) {
      ctx.fillStyle = "#fbbf24"; ctx.font = "11px sans-serif";
      ctx.fillText("✓", px-4, py-r-5);
    }
    // Name
    ctx.fillStyle = isMe ? "#fff" : "rgba(255,255,255,0.7)";
    ctx.font = isMe ? "bold 10px sans-serif" : "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name, px, py+r+13);
    ctx.textAlign = "left";
  }
}

export default function SquidGamePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const myIdRef = useRef("");
  const pressedRef = useRef(false);
  const posRef = useRef({ x: 0.5, y: 0.88 });
  const animRef = useRef(0);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lightRef = useRef<"green"|"red">("green");

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState(code ?? "");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [light, setLight] = useState<"green"|"red">("green");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [killedFlash, setKilledFlash] = useState(false);
  const [winnerName, setWinnerName] = useState("");

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    let rafId = 0;

    function loop() {
      const canvas = canvasRef.current;
      if (!canvas) { rafId = requestAnimationFrame(loop); return; }
      if (canvas.width < 10) { rafId = requestAnimationFrame(loop); return; }

      const ctx = canvas.getContext("2d");
      if (!ctx) { rafId = requestAnimationFrame(loop); return; }

      const w = canvas.width, h = canvas.height;
      const gs = stateRef.current;

      drawField(ctx, w, h, lightRef.current);

      if (gs) {
        // Advance player if pressed
        if (pressedRef.current && gs.game_status === "running") {
          const me = gs.players.find(p => p.id === myIdRef.current);
          if (me && me.alive && !me.finished) {
            posRef.current.y = Math.max(0, posRef.current.y - 0.0018);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "move", x: posRef.current.x, y: posRef.current.y, moving: true,
              }));
            }
          }
        }
        drawPlayers(ctx, w, h, gs.players, myIdRef.current);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("A conectar...", w/2, h/2); ctx.textAlign = "left";
      }

      rafId = requestAnimationFrame(loop);
    }

    // Resize canvas to fill parent
    function resize() {
      const c = canvasRef.current, p = c?.parentElement;
      if (!c || !p) return;
      const w = p.clientWidth, h = p.clientHeight;
      if (w > 0 && h > 0 && (c.width !== w || c.height !== h)) {
        c.width = w; c.height = h;
      }
    }

    // Retry resize until parent has size
    let tries = 0;
    function tryStart() {
      resize();
      const c = canvasRef.current;
      if (!c || c.width < 10) {
        if (tries++ < 20) setTimeout(tryStart, 100); return;
      }
      rafId = requestAnimationFrame(loop);
    }
    tryStart();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!mountedRef.current) return;
    const wsCode = code ?? "NEW";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/squid/${wsCode}`);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "join", name: user?.full_name ?? "Jogador" }));

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "joined") {
          myIdRef.current = msg.player_id;
          setMyId(msg.player_id);
          setIsHost(msg.is_host);
          setRoomCode(msg.room_code);
        } else if (msg.type === "state") {
          stateRef.current = msg;
          lightRef.current = msg.light;
          setGameState({ ...msg });
          setLight(msg.light);
          const me = msg.players.find((p: Player) => p.id === myIdRef.current);
          if (me) posRef.current = { x: me.x, y: me.y };
        } else if (msg.type === "light") {
          lightRef.current = msg.light;
          setLight(msg.light);
          if (stateRef.current) stateRef.current.light = msg.light;
        } else if (msg.type === "move") {
          if (stateRef.current) {
            const p = stateRef.current.players.find(pl => pl.id === msg.player_id);
            if (p) { p.x = msg.x; p.y = msg.y; p.moving = msg.moving; }
          }
        } else if (msg.type === "killed") {
          if (stateRef.current) {
            const p = stateRef.current.players.find(pl => pl.id === msg.player_id);
            if (p) { p.alive = false; p.blood.push({ x: msg.x ?? p.x, y: msg.y ?? p.y }); }
          }
          if (msg.player_id === myIdRef.current) {
            pressedRef.current = false;
            setKilledFlash(true);
            setTimeout(() => setKilledFlash(false), 2000);
          }
        } else if (msg.type === "winner") {
          setWinnerName(msg.name);
          if (stateRef.current) stateRef.current.game_status = "finished";
        } else if (msg.type === "countdown") {
          setCountdown(msg.seconds);
        } else if (msg.type === "started") {
          setCountdown(null);
        } else if (msg.type === "chat") {
          setChat(p => [...p.slice(-50), { name: msg.name, text: msg.text }]);
        } else if (msg.type === "player_joined") {
          setGameState(prev => prev ? { ...prev } : null);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      reconnectRef.current = setTimeout(connectWS, 3000);
    };
  }, [code, user?.full_name]);

  useEffect(() => {
    connectWS();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  // ── Input handlers ────────────────────────────────────────────────────────
  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current; if (!c) return;
    const r = c.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX - r.left : e.clientX - r.left;
    const cy = "touches" in e ? e.touches[0].clientY - r.top  : e.clientY - r.top;
    posRef.current.x = Math.max(0.02, Math.min(0.98, cx / c.width));
  }

  function onPress(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    pressedRef.current = true;
    getPos(e);
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: "move", x: posRef.current.x, y: posRef.current.y, moving: true }));
  }
  function onRelease() {
    pressedRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: "move", x: posRef.current.x, y: posRef.current.y, moving: false }));
  }
  function onMove(e: React.MouseEvent) { if (pressedRef.current) getPos(e); }

  const isWaiting = !gameState || gameState.game_status === "waiting";
  const isRunning = gameState?.game_status === "running";
  const isFinished = gameState?.game_status === "finished";
  const me = gameState?.players.find(p => p.id === myId);

  return (
    <div className="py-3 max-w-7xl mx-auto flex flex-col gap-3" style={{ height: "calc(100vh - 80px)" }}>

      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate("/jogos")}
          className="glass-panel p-2 rounded-xl text-themed-muted hover:text-themed-primary border border-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-h2 font-space-grotesk text-themed-primary">Squid Game</h1>
        <span className={cn("px-3 py-1 rounded-full font-bold text-sm border transition-all",
          light === "green"
            ? "bg-green-500/20 border-green-400/50 text-green-300"
            : "bg-red-500/20 border-red-400/50 text-red-300 animate-pulse")}>
          {light === "green" ? "🟢 LUZ VERDE" : "🔴 LUZ VERMELHA"}
        </span>
        <span className="text-themed-muted bg-white/5 px-3 py-1 rounded-full border border-white/10 font-mono text-sm">
          #{roomCode}
        </span>
        {isRunning && gameState && (
          <span className="ml-auto text-accent-gold font-mono font-bold">⏱ {gameState.time_left}s</span>
        )}
      </div>

      <div className="flex gap-3 flex-1 min-h-0">

        {/* Canvas area */}
        <div className="flex-1 relative rounded-2xl overflow-hidden border-2 border-white/10"
          style={{ minHeight: 350 }}>

          {/* Red light pulse overlay */}
          {light === "red" && isRunning && (
            <div className="absolute inset-0 z-10 pointer-events-none"
              style={{ background: "rgba(239,68,68,0.07)", animation: "pulse 0.6s ease-in-out infinite alternate" }} />
          )}

          {/* Countdown */}
          {countdown !== null && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
              <div className="text-center">
                <p className="text-white/70 text-xl mb-3">O jogo começa em</p>
                <div className="text-[110px] font-black text-accent-games leading-none"
                  style={{ textShadow: "0 0 50px rgba(191,90,242,0.8)" }}>{countdown}</div>
              </div>
            </div>
          )}

          {/* Killed flash */}
          {killedFlash && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-red-950/85">
              <div className="text-center">
                <div className="text-7xl mb-3">💀</div>
                <p className="text-red-300 text-3xl font-black">ELIMINADO!</p>
              </div>
            </div>
          )}

          {/* Winner overlay */}
          {isFinished && winnerName && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75">
              <div className="text-center glass-panel rounded-2xl p-10 border border-accent-gold/30">
                <div className="text-6xl mb-4">🏆</div>
                <p className="text-white text-3xl font-black mb-6">{winnerName} venceu!</p>
                <Button className="bg-accent-games text-white px-8" onClick={() => navigate("/jogos")}>
                  Voltar
                </Button>
              </div>
            </div>
          )}

          {/* Waiting overlay */}
          {isWaiting && !killedFlash && countdown === null && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75">
              <div className="text-center glass-panel rounded-2xl p-8 border border-white/10 min-w-[300px]">
                {!gameState ? (
                  <>
                    <Loader2 className="w-10 h-10 animate-spin text-accent-games mx-auto mb-4" />
                    <p className="text-white text-lg font-bold">A conectar...</p>
                  </>
                ) : (
                  <>
                    <p className="text-white text-2xl font-black mb-3">Sala de Espera</p>
                    <p className="text-themed-muted mb-1 text-sm">Partilha o código:</p>
                    <p className="font-mono font-black text-accent-gold text-4xl tracking-widest mb-4">{roomCode}</p>
                    <p className="text-themed-muted text-sm mb-5">
                      {gameState.players.length} jogador(es) prontos
                    </p>
                    {isHost ? (
                      <Button className="w-full bg-accent-games text-white hover:brightness-110 text-base py-3"
                        onClick={() => wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send(JSON.stringify({ type: "start" }))}>
                        🎮 Iniciar Jogo
                      </Button>
                    ) : (
                      <p className="text-themed-muted">A aguardar o anfitrião...</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Status when dead/finished */}
          {me && !me.alive && isRunning && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-red-950/80 text-red-200 px-6 py-2 rounded-full font-bold text-sm">
              💀 Eliminado — a observar
            </div>
          )}
          {me?.finished && isRunning && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-green-800/80 text-green-200 px-6 py-2 rounded-full font-bold text-sm">
              🏁 Chegaste!
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair touch-none select-none"
            onMouseDown={onPress} onMouseUp={onRelease}
            onMouseLeave={onRelease} onMouseMove={onMove}
            onTouchStart={onPress} onTouchEnd={onRelease} onTouchMove={e => { e.preventDefault(); getPos(e); }}
            onContextMenu={e => e.preventDefault()}
          />
        </div>

        {/* Sidebar */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-3">

          {/* Players */}
          <div className="glass-panel luminous-edge rounded-xl p-3 flex-1 min-h-0 overflow-y-auto">
            <p className="text-label-caps text-themed-muted uppercase text-xs mb-2">
              Jogadores ({gameState?.players.length ?? 0})
            </p>
            {gameState?.players.map(p => (
              <div key={p.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 text-xs transition-colors",
                p.id === myId ? "bg-white/10 border border-white/15" : "hover:bg-white/5")}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: pColor(p.id) }} />
                <span className={cn("flex-1 truncate",
                  !p.alive ? "line-through text-themed-muted" :
                  p.finished ? "text-accent-gold font-bold" : "text-themed-primary")}>
                  {p.name}{p.id === myId ? " (Tu)" : ""}
                </span>
                <span>{p.finished ? "🏁" : !p.alive ? "💀" : p.moving ? "▶" : ""}</span>
              </div>
            ))}
            {!gameState && <p className="text-themed-muted text-xs text-center mt-4">A ligar...</p>}
          </div>

          {/* Instructions */}
          <div className="glass-panel rounded-xl p-3 text-xs text-themed-muted flex-shrink-0">
            <p className="font-bold text-themed-primary mb-1.5 text-sm">Como jogar</p>
            <p className="mb-1">🟢 <strong>Luz Verde</strong> — mantém o botão pressionado para avançar</p>
            <p className="mb-1">🔴 <strong>Luz Vermelha</strong> — solta IMEDIATAMENTE ou morres</p>
            <p>🏁 Chega à linha vermelha primeiro para ganhar</p>
          </div>

          {/* Chat */}
          <div className="glass-panel rounded-xl overflow-hidden flex flex-col flex-shrink-0" style={{ height: 160 }}>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {chat.map((m, i) => (
                <p key={i} className="text-xs">
                  <span className="font-bold text-accent-bisno">{m.name}:</span>
                  <span className="text-themed-secondary ml-1">{m.text}</span>
                </p>
              ))}
              {chat.length === 0 && <p className="text-themed-muted text-xs text-center mt-3">Chat...</p>}
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              if (!chatInput.trim()) return;
              if (wsRef.current?.readyState === WebSocket.OPEN)
                wsRef.current.send(JSON.stringify({ type: "chat", text: chatInput.trim() }));
              setChatInput("");
            }} className="p-2 border-t border-white/5 flex gap-1.5">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                className="flex-1 glass-panel border border-white/10 rounded-lg px-2 py-1.5 text-xs text-themed-primary outline-none"
                placeholder="Mensagem..." />
              <button type="submit" className="glass-panel p-1.5 rounded-lg text-themed-muted hover:text-themed-primary border border-white/10">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

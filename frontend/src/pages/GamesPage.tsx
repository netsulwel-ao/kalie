import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy, Users, Swords, Gamepad2, Shield,
  Plus, Search, Share2, X, Check, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api, { extractApiError } from "@/services/api";

interface UserResult { id: string; username: string; full_name: string; avatar_url: string | null; }

// ── Squid Game button ─────────────────────────────────────────────────────────
function SquidGameButton() {
  const navigate = useNavigate();
  const [showSquid, setShowSquid] = useState(false);
  const [squidCode, setSquidCode] = useState("");
  const [squidLoading, setSquidLoading] = useState(false);
  const [squidError, setSquidError] = useState("");

  async function createSquidRoom() {
    setSquidLoading(true); setSquidError("");
    try {
      const { data } = await api.post("/squid/rooms");
      navigate(`/jogos/squid/${data.code}`);
    } catch (e) {
      setSquidError(extractApiError(e));
    } finally { setSquidLoading(false); }
  }

  async function joinSquidRoom() {
    if (!squidCode.trim()) return;
    setSquidLoading(true); setSquidError("");
    try {
      const { data } = await api.get(`/squid/rooms/${squidCode.trim().toUpperCase()}`);
      if (!data.exists) { setSquidError("Sala não encontrada."); setSquidLoading(false); return; }
      navigate(`/jogos/squid/${squidCode.trim().toUpperCase()}`);
    } catch (e) {
      setSquidError(extractApiError(e));
    } finally { setSquidLoading(false); }
  }

  if (!showSquid) return (
    <Button className="w-full bg-accent-sos text-white hover:brightness-110" onClick={() => setShowSquid(true)}>
      Jogar Agora
    </Button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-sm border border-accent-sos/30">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-h3 font-space-grotesk text-themed-primary">Squid Game</h3>
          <button onClick={() => setShowSquid(false)} className="text-themed-muted hover:text-themed-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <Button className="w-full bg-accent-sos text-white hover:brightness-110"
            onClick={createSquidRoom} loading={squidLoading}>
            <Plus className="w-4 h-4 mr-2" /> Criar Nova Sala
          </Button>
          <div className="flex gap-2">
            <input value={squidCode} onChange={e => setSquidCode(e.target.value.toUpperCase())}
              className="flex-1 input-themed rounded-xl px-4 py-2.5 text-body-sm font-mono uppercase tracking-widest text-center"
              placeholder="SQ-XXXXX" maxLength={8} />
            <Button className="bg-accent-bisno text-surface" onClick={joinSquidRoom} loading={squidLoading}
              disabled={!squidCode.trim()}>
              Entrar
            </Button>
          </div>
          {squidError && <p className="text-accent-sos text-sm">{squidError}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Create challenge modal ────────────────────────────────────────────────────
function CreateChallengeModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [gameType, setGameType] = useState<"chess" | "tictactoe" | "checkers">("chess");
  const [color, setColor] = useState<"white" | "black" | "random">("random");
  const [timeControl, setTimeControl] = useState(600);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // User search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join by code
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [mode, setMode] = useState<"create" | "join">("create");

  // Search users
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data);
      } catch { setSearchResults([]); }
    }, 300);
  }, [searchQuery]);

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/games/challenges", {
        game_type: gameType,
        color: gameType === "chess" ? color : undefined,
        time_control: timeControl,
      });
      setCreatedId(data.id);
      setInviteCode(data.invite_code);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteUser(userId: string) {
    if (!createdId) return;
    try {
      await api.post(`/games/challenges/${createdId}/invite/${userId}`);
      setInvitedUsers((prev) => new Set([...prev, userId]));
    } catch (err) {
      setError(extractApiError(err));
    }
  }

  function goToGame() {
    onClose();
    if (gameType === "chess") navigate(`/jogos/xadrez/${createdId}`);
    else if (gameType === "checkers") navigate(`/jogos/damas/${createdId}`);
    else navigate(`/jogos/tictactoe/${createdId}`);
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    setError("");
    try {
      const { data: found } = await api.get(`/games/challenges/code/${joinCode.trim().toUpperCase()}`);
      await api.post(`/games/challenges/${found.id}/join`);
      onClose();
      if (found.game_type === "chess") navigate(`/jogos/xadrez/${found.id}`);
      else if (found.game_type === "checkers") navigate(`/jogos/damas/${found.id}`);
      else navigate(`/jogos/tictactoe/${found.id}`);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setJoinLoading(false);
    }
  }

  function shareWhatsApp() {
    if (!createdId) return;
    const url = `${window.location.origin}/jogos/xadrez/${createdId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Desafio-te para Xadrez no Kalie! Código: ${inviteCode} — ${url}`)}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 font-space-grotesk text-themed-primary">Novo Desafio</h2>
          <button onClick={onClose} className="text-themed-muted hover:text-themed-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 glass-panel p-1 rounded-full mb-6">
          {(["create", "join"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("flex-1 py-2 rounded-full text-body-sm font-medium transition-all",
                mode === m ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
              {m === "create" ? "Criar Desafio" : "Entrar por Código"}
            </button>
          ))}
        </div>

        {mode === "create" ? (
          <>
            {!createdId ? (
              <>
                {/* Game type */}
                <div className="mb-5">
                  <p className="text-label-caps text-themed-muted uppercase mb-3">Jogo</p>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: "chess",     label: "Xadrez",        icon: Swords   },
                      { id: "tictactoe", label: "Jogo da Velha", icon: Gamepad2 },
                      { id: "checkers",  label: "Dama",          icon: Shield   },
                    ] as const).map(({ id, label, icon: Icon }) => (
                      <button key={id} onClick={() => setGameType(id)}
                        className={cn("flex flex-col items-center gap-2 py-4 rounded-xl border transition-all",
                          gameType === id ? "bg-accent-bisno/10 border-accent-bisno/40 text-accent-bisno" : "glass-panel border-white/10 text-themed-muted hover:border-white/20")}>
                        <Icon className="w-6 h-6" />
                        <span className="text-body-sm font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {gameType === "chess" && (
                  <div className="mb-5">
                    <p className="text-label-caps text-themed-muted uppercase mb-3">Cor das Peças</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([{ id: "white", label: "Brancas" }, { id: "black", label: "Pretas" }, { id: "random", label: "Aleatório" }] as const).map(({ id, label }) => (
                        <button key={id} onClick={() => setColor(id)}
                          className={cn("py-2 rounded-xl text-body-sm font-medium border transition-all",
                            color === id ? "bg-white/10 border-white/20 text-themed-primary" : "glass-panel border-white/5 text-themed-muted hover:border-white/15")}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time control */}
                <div className="mb-5">
                  <p className="text-label-caps text-themed-muted uppercase mb-3">Tempo por jogador</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { label: "1 min",  secs: 60  },
                      { label: "3 min",  secs: 180 },
                      { label: "5 min",  secs: 300 },
                      { label: "10 min", secs: 600 },
                    ]).map(({ label, secs }) => (
                      <button key={secs} onClick={() => setTimeControl(secs)}
                        className={cn("py-2 rounded-xl text-xs font-bold border transition-all",
                          timeControl === secs
                            ? "bg-accent-bisno/15 border-accent-bisno/40 text-accent-bisno"
                            : "glass-panel border-white/5 text-themed-muted hover:border-white/15")}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-accent-sos text-body-sm mb-4">{error}</p>}
                <Button className="w-full bg-accent-bisno text-surface hover:brightness-110" onClick={handleCreate} loading={loading}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Sala
                </Button>
              </>
            ) : (
              <>
                {/* Created — show code + invite users */}
                <div className="text-center glass-panel rounded-xl py-4 mb-5 border border-accent-feed/20">
                  <p className="text-label-caps text-themed-muted uppercase mb-1">Sala criada! Código</p>
                  <p className="text-3xl font-black font-mono text-themed-primary tracking-[0.2em]">{inviteCode}</p>
                </div>

                {/* Search users to invite */}
                <div className="mb-4">
                  <p className="text-label-caps text-themed-muted uppercase mb-2">Convidar Jogador</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted w-4 h-4" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full input-themed rounded-xl pl-10 pr-4 py-2.5 text-body-sm"
                      placeholder="Pesquisar por nome ou @username..."
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 glass-panel rounded-xl overflow-hidden border border-white/10">
                      {searchResults.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={u.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs bg-white/10">{u.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-body-sm font-semibold text-themed-primary truncate">{u.full_name}</p>
                            <p className="text-xs text-themed-muted">@{u.username}</p>
                          </div>
                          <button
                            onClick={() => handleInviteUser(u.id)}
                            disabled={invitedUsers.has(u.id)}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                              invitedUsers.has(u.id)
                                ? "bg-accent-feed/10 text-accent-feed border border-accent-feed/20"
                                : "bg-accent-bisno/10 text-accent-bisno border border-accent-bisno/20 hover:bg-accent-bisno/20")}
                          >
                            {invitedUsers.has(u.id) ? <><Check className="w-3 h-3" />Convidado</> : <><Bell className="w-3 h-3" />Convidar</>}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="glass" className="flex-1" onClick={shareWhatsApp}>
                    <Share2 className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                  <Button className="flex-1 bg-accent-feed text-surface hover:brightness-110" onClick={goToGame}>
                    Entrar na Sala
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-label-caps text-themed-muted uppercase mb-3">Código do Desafio</p>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full input-themed rounded-xl px-4 py-3 text-body-md font-mono tracking-widest uppercase text-center"
                placeholder="ABC12345"
                maxLength={8}
              />
            </div>
            {error && <p className="text-accent-sos text-body-sm mb-4">{error}</p>}
            <Button className="w-full bg-accent-games text-white hover:brightness-110" onClick={handleJoin} loading={joinLoading} disabled={!joinCode.trim()}>
              <Swords className="w-4 h-4 mr-2" />
              Entrar no Desafio
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Games list ────────────────────────────────────────────────────────────────
const games = [
  {
    id: "chess",
    name: "Xadrez",
    description: "Jogo de estratégia clássico. Desafia jogadores de todo Angola.",
    players: "1.204", prize: "2.500 AOA", status: "Ao Vivo", statusColor: "text-accent-feed",
    accent: "border-accent-bisno/30 bg-accent-bisno/5", icon: Swords, iconColor: "text-accent-bisno",
    coverImage: "/imgs/capa-xadrez.png",
    comingSoon: false,
  },
  {
    id: "tictactoe",
    name: "Jogo da Velha",
    description: "O clássico jogo X e O. Rápido, intenso e estratégico. 2 jogadores.",
    players: "892", prize: "500 AOA", status: "Ao Vivo", statusColor: "text-accent-feed",
    accent: "border-accent-games/30 bg-accent-games/5", icon: Gamepad2, iconColor: "text-accent-games",
    coverImage: null,
    comingSoon: false,
  },
  {
    id: "squid",
    name: "Squid Game",
    description: "Luz Verde, Luz Vermelha. Avança enquanto podes. Para quando ela olhar para ti.",
    players: "2.341", prize: "1.500 AOA", status: "Ao Vivo", statusColor: "text-accent-sos",
    accent: "border-accent-sos/30 bg-accent-sos/5", icon: Gamepad2, iconColor: "text-accent-sos",
    coverImage: null,
    comingSoon: false,
    isSquid: true,
    hidden: true,
  },
  {
    id: "dama",
    name: "Dama",
    description: "Jogo de damas angolano. Captura obrigatória, regras locais. 2 jogadores.",
    players: "850", prize: "750 AOA", status: "Ao Vivo", statusColor: "text-accent-gold",
    accent: "border-accent-gold/30 bg-accent-gold/5", icon: Shield, iconColor: "text-accent-gold",
    coverImage: null,
    comingSoon: false,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GamesPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="py-6">
      {showModal && <CreateChallengeModal onClose={() => setShowModal(false)} />}

      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-h1 font-space-grotesk text-themed-primary">Arena de Jogos</h1>
          <p className="text-themed-muted mt-1">Compete, convida amigos e ganha prémios.</p>
        </div>
        <Button className="bg-accent-bisno text-surface hover:brightness-110" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Desafio
        </Button>
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {games.filter(g => !(g as any).hidden).map((game) => {
          const Icon = game.icon;
          return (
            <div key={game.id} className={cn("glass-panel luminous-edge rounded-xl overflow-hidden border transition-all hover:border-white/20 flex flex-col", game.accent)}>
              {/* Cover image */}
              <div className="relative h-40 overflow-hidden flex-shrink-0">
                {game.coverImage ? (
                  <>
                    <img
                      src={game.coverImage}
                      alt={game.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </>
                ) : game.id === "tictactoe" ? (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #1a0a2e 0%, #0d1b3e 100%)" }}>
                    <div className="grid grid-cols-3 gap-1" style={{ width: 90 }}>
                      {["✕","○","✕","○","✕","○","○","✕","○"].map((s, i) => (
                        <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black"
                          style={{ background: "rgba(255,255,255,0.06)", color: s === "✕" ? "#ef4444" : "#3b82f6" }}>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : game.id === "squid" ? (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #0f1a0f 0%, #1a2e1a 100%)" }}>
                    <div className="text-center">
                      <div className="text-5xl mb-2">🦑</div>
                      <div className="flex gap-3 justify-center">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">🟢 Verde</span>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">🔴 Vermelha</span>
                      </div>
                    </div>
                  </div>
                ) : game.id === "dama" ? (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #1a1200 0%, #2d1f00 100%)" }}>
                    {/* Mini checkers board */}
                    <div className="grid grid-cols-4 gap-0.5" style={{ width: 76 }}>
                      {[
                        [1,"bp"],[0,""],[1,"bp"],[0,""],
                        [0,""],[1,""],[0,""],[1,""],
                        [1,""],[0,""],[1,""],[0,""],
                        [0,""],[1,"wp"],[0,""],[1,"wp"],
                      ].map(([dark, piece], i) => (
                        <div key={i} className="w-[18px] h-[18px] flex items-center justify-center"
                          style={{ background: dark ? "#5d4037" : "#d7ccc8" }}>
                          {piece === "wp" && <div className="w-3 h-3 rounded-full bg-gradient-to-br from-white to-zinc-200 border border-zinc-400" />}
                          {piece === "bp" && <div className="w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-950 border border-zinc-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                    <Icon className={cn("w-16 h-16 opacity-20", game.iconColor)} />
                  </div>
                )}
                {/* Status badge */}
                <span className={cn("absolute top-3 right-3 text-label-caps uppercase text-xs font-bold px-2.5 py-1 rounded-full glass-panel border border-white/10", game.statusColor)}>
                  {game.status}
                </span>
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", game.accent.split(" ")[0].replace("border-", "bg-").replace("/30", "/20"))}>
                    <Icon className={cn("w-5 h-5", game.iconColor)} />
                  </div>
                  <h3 className="text-h3 font-space-grotesk text-themed-primary leading-tight">{game.name}</h3>
                </div>
                <p className="text-body-sm text-themed-muted mb-4 flex-1">{game.description}</p>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1.5 text-body-sm text-themed-muted">
                    <Users className="w-4 h-4" /> {game.players} online
                  </div>
                  <div className="flex items-center gap-1.5 text-body-sm text-accent-gold">
                    <Trophy className="w-4 h-4" /> {game.prize}
                  </div>
                </div>
                {game.comingSoon ? (
                  <Button variant="glass" className="w-full opacity-50 cursor-not-allowed" disabled>Em breve</Button>
                ) : (game as any).isSquid ? (
                  <SquidGameButton />
                ) : (
                  <Button className="w-full bg-accent-bisno text-surface hover:brightness-110" onClick={() => setShowModal(true)}>
                    Jogar Agora
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

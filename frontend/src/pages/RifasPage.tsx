import { useEffect, useState, useRef } from "react";
import {
  Ticket, Clock, Users, ShieldCheck, Star,
  Lock, CheckCircle, Plus, X, Loader2, Upload,
  Play, AlertTriangle, Ban, Eye, Video, Timer,
  ChevronLeft, ChevronRight, Coins, Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rafflesApi, formatAOA, type Raffle, type RaffleTicket, type ReserveResult, type RaffleTicketFull, type Participant, type DeliveryCode } from "@/services/modules";
import { extractApiError } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { CountdownText } from "@/components/ui/countdown-text";

function ProgressBar({ pct, color = "bg-accent-games" }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    draft:     { label: "Rascunho",  color: "text-zinc-400 border-zinc-500/30" },
    active:    { label: "Activa",    color: "text-accent-feed border-accent-feed/30" },
    drawing:   { label: "Sorteio",   color: "text-accent-gold border-accent-gold/30" },
    finished:  { label: "Sorteada",  color: "text-accent-games border-accent-games/30" },
    cancelled: { label: "Cancelada", color: "text-accent-sos border-accent-sos/30" },
  };
  const c = config[status] ?? { label: status, color: "text-zinc-400 border-zinc-500/30" };
  return (
    <span className={cn("text-label-caps uppercase text-xs border px-2 py-0.5 rounded-full", c.color)}>
      {c.label}
    </span>
  );
}

export default function RifasPage() {
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<"activas" | "minhas" | "rascunhos" | "historico" | "ganhos">("activas");
  const [rifas, setRifas] = useState<Raffle[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showTicketModal, setShowTicketModal] = useState<Raffle | null>(null);
  const [allTickets, setAllTickets] = useState<RaffleTicketFull[]>([]);
  const [ticketPage, setTicketPage] = useState(0);
  const TICKETS_PER_PAGE = 10;
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [reservation, setReservation] = useState<ReserveResult | null>(null);
  const [reserving, setReserving] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showParticipants, setShowParticipants] = useState<string | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [ticketCountdown, setTicketCountdown] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Delivery code verification (creator enters winner's code)
  const [deliveryCodeInput, setDeliveryCodeInput] = useState("");
  const [deliveryLookupResult, setDeliveryLookupResult] = useState<any>(null);
  const [deliveryLookupLoading, setDeliveryLookupLoading] = useState(false);
  const [deliveryConfirmLoading, setDeliveryConfirmLoading] = useState(false);
  const [deliveryLookupError, setDeliveryLookupError] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", ticket_price: "", max_tickets: "",
    starts_at: "", ends_at: "", video_url: "",
  });
  const [endOnSoldOut, setEndOnSoldOut] = useState(false);

  async function load(silent = false) {
    if (!silent) setInitialLoading(true);
    try {
      let status = "all";
      if (tab === "activas") status = "active";
      else if (tab === "rascunhos") status = "draft";
      else if (tab === "historico") status = "finished";
      setRifas(await rafflesApi.list(status));
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => { load(false); }, [tab]);

  // Real-time polling every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      load(true);
      if (showTicketModal) {
        loadAllTickets(showTicketModal.id, ticketPage);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [tab, showTicketModal?.id, ticketPage]);

  async function buyTicket(id: string) {
    const r = rifas.find(x => x.id === id);
    if (!r) return;
    setShowTicketModal(r);
    setReservation(null);
    setTicketPage(0);
    await loadAllTickets(id, 0);
  }

  async function loadAllTickets(raffleId: string, page: number) {
    setTicketsLoading(true);
    try {
      const offset = page * TICKETS_PER_PAGE;
      const tickets = await rafflesApi.allTickets(raffleId, TICKETS_PER_PAGE, offset);
      setAllTickets(tickets);
      setTicketPage(page);
    } catch { setAllTickets([]); }
    setTicketsLoading(false);
  }

  const totalTicketPages = (() => {
    if (!showTicketModal) return 0;
    return Math.ceil(showTicketModal.max_tickets / TICKETS_PER_PAGE);
  })();

  async function handleReserve(ticketNumber: number) {
    if (!showTicketModal) return;
    setReserving(true); setError("");
    try {
      const res = await rafflesApi.reserve(showTicketModal.id, ticketNumber);
      setReservation(res);
      setTicketCountdown(60);
      await loadAllTickets(showTicketModal.id, ticketPage);
    } catch (e) {
      setError(extractApiError(e));
    }
    setReserving(false);
  }

  async function handleConfirmPurchase() {
    if (!showTicketModal || !reservation) return;
    setPurchasing(true); setError("");
    try {
      await rafflesApi.confirmPurchase(showTicketModal.id, reservation.id);
      setReservation(null);
      setShowTicketModal(null);
      await load(true);
    } catch (e) {
      setError(extractApiError(e));
    }
    setPurchasing(false);
  }



  async function handleRelease() {
    if (!showTicketModal || !reservation) return;
    try {
      await rafflesApi.release(showTicketModal.id, reservation.id);
      setReservation(null);
      setTicketCountdown(0);
      await loadAllTickets(showTicketModal.id, ticketPage);
    } catch { /* ignore */ }
  }

  // Countdown for reservation timeout
  useEffect(() => {
    if (ticketCountdown <= 0) return;
    const t = setInterval(() => {
      setTicketCountdown(prev => {
        if (prev <= 1) {
          setReservation(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [ticketCountdown]);

  async function loadParticipants(raffleId: string) {
    setParticipantsLoading(true);
    try {
      setParticipants(await rafflesApi.participants(raffleId));
      setShowParticipants(raffleId);
    } catch { setParticipants([]); }
    setParticipantsLoading(false);
  }

  async function activateRaffle(id: string) {
    setActivating(id); setError("");
    try {
      await rafflesApi.activate(id);
      await load(false);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setActivating(null);
    }
  }

  async function closeRaffle(id: string) {
    setClosing(id); setError("");
    try {
      await rafflesApi.close(id);
      await load(false);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setClosing(null);
    }
  }

  async function cancelRaffle(id: string) {
    setCancelling(true); setError("");
    try {
      await rafflesApi.cancel(id);
      setShowCancelConfirm(null);
      await load(false);
    } catch (e) {
      setError(extractApiError(e));
    }
    setCancelling(false);
  }

  async function createRaffle() {
    setCreating(true); setError("");
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("ticket_price_centavos", String(Math.round(parseFloat(form.ticket_price) * 100)));
      fd.append("max_tickets", form.max_tickets);
      if (form.starts_at) fd.append("starts_at", new Date(form.starts_at).toISOString());
      if (!endOnSoldOut && form.ends_at) fd.append("ends_at", new Date(form.ends_at).toISOString());
      if (form.video_url) fd.append("video_url", form.video_url);
      if (fileRef.current?.files?.[0]) fd.append("image", fileRef.current.files[0]);
      await rafflesApi.create(fd);
      setShowCreate(false);
      setForm({ title: "", description: "", ticket_price: "", max_tickets: "", starts_at: "", ends_at: "", video_url: "" });
      setEndOnSoldOut(false);
      setImagePreview(null);
      await load(false);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setCreating(false);
    }
  }

  const isCreator = (r: Raffle) => user?.id === r.creator_id;

  const featured = rifas.find(r => r.status === "active");
  const rest = rifas.filter(r => r.status === "active" && r.id !== featured?.id);

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-h1 font-space-grotesk text-themed-primary">Sorteios</h1>
          <p className="text-themed-muted mt-1">Compra bilhetes e concorre a prémios. Sorteio verificável.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-accent-feed" />
            <span className="text-body-sm text-accent-feed font-medium">Provably Fair</span>
          </div>
          <Button className="bg-accent-bisno text-zinc-950 hover:brightness-110" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Criar Sorteio
          </Button>
        </div>
      </div>

      {/* Delivery code verification — creator enters the winner's code */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full">
          <input
            type="text"
            placeholder="Código de entrega..."
            value={deliveryCodeInput}
            onChange={e => setDeliveryCodeInput(e.target.value.toUpperCase())}
            className="bg-transparent border-none outline-none text-themed-primary w-40 text-sm"
          />
          <button
            onClick={async () => {
              const code = deliveryCodeInput.trim();
              if (!code) return;
              setDeliveryLookupLoading(true);
              setDeliveryLookupError("");
              setDeliveryLookupResult(null);
              try {
                const res = await rafflesApi.deliveryLookupByCode(code);
                setDeliveryLookupResult(res);
              } catch (e) {
                setDeliveryLookupError((e as any)?.response?.data?.detail || "Código inválido.");
              }
              setDeliveryLookupLoading(false);
            }}
            disabled={deliveryLookupLoading || !deliveryCodeInput.trim()}
            className="text-accent-games hover:text-accent-gold transition-colors disabled:opacity-30 text-sm font-medium"
          >
            {deliveryLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
          </button>
        </div>
        {deliveryLookupError && (
          <span className="text-accent-sos text-xs">{deliveryLookupError}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-8 overflow-x-auto">
        {(["activas", "minhas", "rascunhos", "historico", "ganhos"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-5 py-2 rounded-full text-body-sm font-medium transition-all whitespace-nowrap",
              tab === t ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
            {t === "activas" ? "Activos" : t === "minhas" ? "Os Meus Bilhetes" : t === "rascunhos" ? "Rascunhos" : t === "historico" ? "Histórico" : "Ganhos"}
          </button>
        ))}
      </div>

      {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}

      {initialLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>
      ) : tab === "activas" ? (
        <>
          {/* Featured active raffle */}
          {featured && (
            <div className="glass-panel rounded-xl p-1 mb-6 border border-accent-games/20">
              <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-accent-games/20 via-surface-container to-accent-gold/10 p-8">
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-accent-games/20 blur-[80px] rounded-full pointer-events-none" />
                {featured.image_url && (
                  <img src={featured.image_url} alt={featured.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-10" />
                )}
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-accent-gold fill-accent-gold" />
                      <span className="text-label-caps text-accent-gold uppercase">Sorteio em Destaque</span>
                    </div>
                    <h2 className="text-h2 font-space-grotesk text-themed-primary mb-2">{featured.title}</h2>
                    <p className="text-body-md text-themed-secondary mb-4 line-clamp-2">{featured.description}</p>
                    <div className="flex items-center gap-6 mb-4">
                      <div>
                        <p className="text-label-caps text-themed-muted uppercase">Bilhetes vendidos</p>
                        <p className="text-themed-primary font-bold">{featured.tickets_sold} / {featured.max_tickets}</p>
                      </div>
                      {(() => {
                        const startTime = featured.starts_at ? new Date(featured.starts_at).getTime() : null;
                        const notStarted = startTime && startTime > Date.now();
                        if (notStarted) {
                          return (
                            <div>
                              <p className="text-label-caps text-themed-muted uppercase">Começa em</p>
                              <p className="text-accent-gold font-bold flex items-center gap-1">
                                <Clock className="w-4 h-4" /> <CountdownText targetDate={featured.starts_at!} />
                              </p>
                            </div>
                          );
                        }
                        return featured.ends_at ? (
                          <div>
                            <p className="text-label-caps text-themed-muted uppercase">Termina em</p>
                            <p className="text-accent-gold font-bold flex items-center gap-1">
                              <Clock className="w-4 h-4" /> <CountdownText targetDate={featured.ends_at} />
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-label-caps text-themed-muted uppercase">Termina</p>
                            <p className="text-accent-gold font-bold flex items-center gap-1">
                              <Clock className="w-4 h-4" /> Após venda total
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                    <ProgressBar pct={featured.pct_sold} />
                    {featured.server_seed_hash && (
                      <p className="text-xs text-themed-muted mt-2 font-mono truncate max-w-md" title={featured.server_seed_hash}>
                        Seed hash: {featured.server_seed_hash.slice(0, 20)}...
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-label-caps text-themed-muted uppercase">Por bilhete</p>
                    <p className="text-h2 font-space-grotesk text-themed-primary">{formatAOA(featured.ticket_price_centavos)}</p>
                    <Button size="sm" variant="glass" className="border-white/10 text-themed-muted hover:text-themed-primary w-full"
                      onClick={() => loadParticipants(featured.id)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Participantes
                    </Button>
                    {isCreator(featured) ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-label-caps text-themed-muted uppercase text-xs">Total arrecadado</p>
                        <p className="text-h3 font-space-grotesk text-accent-gold">{formatAOA(featured.total_raised_centavos)}</p>
                        <Button size="sm" variant="glass" className="border-accent-sos/30 text-accent-sos"
                          onClick={() => setShowCancelConfirm(featured.id)}>
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="bg-accent-bisno text-zinc-950 hover:brightness-110 font-bold px-8"
                        onClick={() => buyTicket(featured.id)}
                        disabled={buying === featured.id}
                      >
                        {buying === featured.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ticket className="w-4 h-4 mr-2" />}
                        Comprar Bilhete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map(rifa => {
              if (rifa.status === "draft") return null;
              return (
                <div key={rifa.id} className="glass-panel luminous-edge rounded-xl overflow-hidden hover:border-white/20 transition-all flex flex-col">
                  {rifa.image_url ? (
                    <img src={rifa.image_url} alt={rifa.title} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-white/3 flex items-center justify-center border-b border-white/5">
                      <Ticket className="w-10 h-10 text-themed-muted" />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-body-md font-bold text-themed-primary mb-1">{rifa.title}</h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {rifa.video_url && <Video className="w-3.5 h-3.5 text-accent-gold" />}
                        <StatusBadge status={rifa.status} />
                      </div>
                    </div>
                    <p className="text-body-sm text-themed-muted line-clamp-2">{rifa.description}</p>
                    <div className="flex justify-between text-body-sm">
                      <span className="text-themed-muted flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {rifa.tickets_sold}/{rifa.max_tickets}
                      </span>
                      {(() => {
                        const startTime = rifa.starts_at ? new Date(rifa.starts_at).getTime() : null;
                        const notStarted = startTime && startTime > Date.now();
                        if (notStarted) {
                          return (
                            <span className="text-accent-gold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> <CountdownText targetDate={rifa.starts_at!} />
                            </span>
                          );
                        }
                        if (rifa.status === "active") {
                          return rifa.ends_at ? (
                            <span className="text-themed-muted flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> <CountdownText targetDate={rifa.ends_at} />
                            </span>
                          ) : (
                            <span className="text-themed-muted flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Venda total
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {rifa.status === "active" && <ProgressBar pct={rifa.pct_sold} />}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
                      <div>
                        <p className="text-label-caps text-themed-muted uppercase text-xs">Por bilhete</p>
                        <p className="text-themed-primary font-bold">{formatAOA(rifa.ticket_price_centavos)}</p>
                      </div>
                      <div className="flex gap-1">
                        {rifa.status === "active" && (
                          <Button size="sm" variant="glass" className="border-white/10 text-themed-muted px-2"
                            onClick={() => loadParticipants(rifa.id)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {rifa.status === "active" && !isCreator(rifa) && (
                          <Button size="sm" variant="glass" className="border-accent-bisno/30 text-accent-bisno hover:bg-accent-bisno/10"
                            onClick={() => buyTicket(rifa.id)} disabled={buying === rifa.id}>
                            {buying === rifa.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5 mr-1" />}
                            Comprar
                          </Button>
                        )}
                        {rifa.status === "active" && isCreator(rifa) && (
                          <>
                            <span className="text-xs text-accent-gold font-medium flex items-center gap-1">
                              <Coins className="w-3 h-3" />{formatAOA(rifa.total_raised_centavos)}
                            </span>
                            <Button size="sm" variant="glass" className="border-accent-sos/30 text-accent-sos"
                              onClick={() => setShowCancelConfirm(rifa.id)}>
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {rifas.filter(r => r.status === "active").length === 0 && (
            <div className="glass-panel rounded-xl p-8 text-center">
              <Ticket className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">Sem sorteios activos. Cria o primeiro!</p>
            </div>
          )}
        </>
      ) : tab === "ganhos" ? (
        <GanhosView />
      ) : tab === "minhas" ? (
        <MyTicketsView />
      ) : tab === "rascunhos" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rifas.filter(r => r.status === "draft").map(rifa => (
              <div key={rifa.id} className="glass-panel luminous-edge rounded-xl p-5 border border-zinc-500/20 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status="draft" />
                    </div>
                    <h4 className="text-body-md font-bold text-themed-primary">{rifa.title}</h4>
                  </div>
                </div>
                <p className="text-body-sm text-themed-muted line-clamp-2">{rifa.description}</p>
                <div className="text-body-sm text-themed-muted flex gap-4">
                  <span>{formatAOA(rifa.ticket_price_centavos)} / bilhete</span>
                  <span>{rifa.max_tickets} bilhetes</span>
                </div>
                {rifa.starts_at && (
                  <div className="text-xs text-themed-muted flex items-center gap-1">
                    <Play className="w-3 h-3" /> Início: {new Date(rifa.starts_at).toLocaleString("pt-AO")}
                  </div>
                )}
                {rifa.ends_at ? (
                  <div className="text-xs text-themed-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Fim: {new Date(rifa.ends_at).toLocaleString("pt-AO")}
                  </div>
                ) : (
                  <div className="text-xs text-themed-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Fim: Após venda total
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-themed-muted">
                  <span>Venda mínima:</span>
                  <input type="number" min={0} max={rifa.max_tickets}
                    value={rifa.min_tickets_for_draw ?? 0}
                    onChange={async e => {
                      const val = parseInt(e.target.value) || 0;
                      try {
                        await rafflesApi.setMinSales(rifa.id, val);
                        await load(true);
                      } catch { /* */ }
                    }}
                    className="w-16 glass-panel border border-white/10 rounded-lg px-2 py-1 text-themed-primary outline-none focus:border-accent-bisno/50" />
                </label>
                <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
                  <Button size="sm" className="bg-accent-bisno text-zinc-950 hover:brightness-110 flex-1"
                    onClick={() => activateRaffle(rifa.id)} disabled={activating === rifa.id}>
                    {activating === rifa.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                    Activar
                  </Button>
                  <Button size="sm" variant="glass" className="border-accent-sos/30 text-accent-sos"
                    onClick={() => setShowCancelConfirm(rifa.id)}>
                    <Ban className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {rifas.filter(r => r.status === "draft").length === 0 && (
            <div className="glass-panel rounded-xl p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">Nenhum rascunho. Cria um novo sorteio!</p>
            </div>
          )}
        </>
      ) : (
        /* Histórico */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rifas.filter(r => r.status === "finished" || r.status === "cancelled").map(rifa => {
            const userWon = user?.id === rifa.winner_id;
            return (
              <div key={rifa.id} className={cn("glass-panel rounded-xl p-5",
                userWon ? "border-accent-gold/50 bg-accent-gold/5" : "opacity-80")}>
                <div className="flex items-center gap-2 mb-2">
                  {rifa.status === "finished" ? (
                    userWon ? <Star className="w-4 h-4 text-accent-gold fill-accent-gold" /> : <CheckCircle className="w-4 h-4 text-accent-feed" />
                  ) : (
                    <Ban className="w-4 h-4 text-accent-sos" />
                  )}
                  <StatusBadge status={rifa.status} />
                  {userWon && (
                    <span className="text-label-caps text-xs bg-accent-gold/20 text-accent-gold border border-accent-gold/30 px-2 py-0.5 rounded-full">
                      Venceste!
                    </span>
                  )}
                </div>
                <h4 className="text-body-md font-bold text-themed-primary mb-1">{rifa.title}</h4>
                {rifa.winning_ticket && (
                  <p className="text-body-sm text-themed-muted">Bilhete vencedor: #{rifa.winning_ticket}</p>
                )}
                {rifa.drawn_at && (
                  <p className="text-xs text-themed-muted mt-1">
                    Sorteado em: {new Date(rifa.drawn_at).toLocaleDateString("pt-AO")}
                    {rifa.is_auto_closed && " (automático)"}
                  </p>
                )}
                {rifa.server_seed && rifa.client_seed && (
                  <details className="mt-2 text-xs text-themed-muted">
                    <summary className="cursor-pointer hover:text-themed-secondary">Verificar公平</summary>
                    <p className="mt-1 font-mono break-all">Server seed: {rifa.server_seed}</p>
                    <p className="font-mono break-all">Client seed: {rifa.client_seed}</p>
                    <p className="font-mono">Nonce: {rifa.nonce}</p>
                    <p className="mt-1">Hash: {rifa.server_seed_hash.slice(0, 16)}...</p>
                  </details>
                )}
              </div>
            );
          })}
          {rifas.filter(r => r.status === "finished" || r.status === "cancelled").length === 0 && (
            <div className="col-span-3 glass-panel rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">Sem histórico ainda.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Delivery Code Confirmation Modal ── */}
      {deliveryLookupResult && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-4 sm:p-6 w-full max-h-[85dvh] overflow-y-auto max-w-lg border border-white/10 my-2 sm:my-4 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Confirmar Entrega</h3>
              <button onClick={() => { setDeliveryLookupResult(null); setDeliveryCodeInput(""); setDeliveryLookupError(""); }} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-themed-muted" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="glass-panel rounded-xl p-4 border border-accent-gold/20">
                <h4 className="text-body-md font-bold text-themed-primary mb-1">{deliveryLookupResult.raffle_title}</h4>
                <p className="text-body-sm text-themed-muted line-clamp-2">{deliveryLookupResult.raffle_description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-panel rounded-xl p-3 border border-white/5">
                  <p className="text-label-caps text-themed-muted uppercase text-xs">Prémio</p>
                  <p className="text-body-md font-bold text-accent-gold">{formatAOA(deliveryLookupResult.prize_amount_centavos)}</p>
                </div>
                <div className="glass-panel rounded-xl p-3 border border-white/5">
                  <p className="text-label-caps text-themed-muted uppercase text-xs">Vencedor</p>
                  <p className="text-body-md font-bold text-themed-primary">{deliveryLookupResult.winner_name || "—"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between glass-panel rounded-xl p-3 border border-white/5">
                <span className="text-label-caps text-themed-muted uppercase text-xs">Estado</span>
                <DeliveryBadge status={deliveryLookupResult.delivery_status} />
              </div>
            </div>

            {deliveryLookupResult.delivery_status === "completed" && (
              <div className="flex items-center gap-2 text-sm text-accent-games mb-4">
                <CheckCircle className="w-4 h-4" />
                Esta entrega já foi concluída.
              </div>
            )}

            {deliveryLookupResult.delivery_status === "disputed" && (
              <div className="text-xs text-accent-sos mb-4">
                Disputa: {deliveryLookupResult.dispute_reason}
              </div>
            )}

            {(deliveryLookupResult.delivery_status === "pending" || deliveryLookupResult.delivery_status === "confirmed_by_winner") && (
              <div className="flex gap-3">
                <Button variant="glass" className="flex-1 border-white/10 text-themed-muted"
                  onClick={() => { setDeliveryLookupResult(null); setDeliveryCodeInput(""); }}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-accent-bisno text-zinc-950 hover:brightness-110"
                  onClick={async () => {
                    setDeliveryConfirmLoading(true);
                    setDeliveryLookupError("");
                    try {
                      await rafflesApi.deliveryConfirmByCode(deliveryCodeInput.trim());
                      setDeliveryLookupResult(null);
                      setDeliveryCodeInput("");
                      await load(true);
                    } catch (e) {
                      setDeliveryLookupError((e as any)?.response?.data?.detail || "Erro ao confirmar.");
                    }
                    setDeliveryConfirmLoading(false);
                  }}
                  disabled={deliveryConfirmLoading}
                >
                  {deliveryConfirmLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Confirmar Entrega
                </Button>
              </div>
            )}

            {deliveryLookupError && <p className="text-accent-sos text-sm mt-3">{deliveryLookupError}</p>}
          </div>
        </div>
      )}

      {/* ── Ticket Grid Modal ── */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-4 sm:p-6 w-full max-h-[85dvh] overflow-y-auto max-w-xl border border-white/10 my-2 sm:my-4 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">{showTicketModal.title}</h3>
              <button onClick={() => { setShowTicketModal(null); setReservation(null); }} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-themed-muted" />
              </button>
            </div>
            <p className="text-body-sm text-themed-muted mb-2">{formatAOA(showTicketModal.ticket_price_centavos)} por bilhete</p>

            {/* Video player */}
            {showTicketModal.video_url && (
              <div className="mb-4 aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  src={showTicketModal.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="w-full h-full"
                  allowFullScreen
                  title="Video do prémio"
                />
              </div>
            )}

            {/* Stats bar */}
            <div className="flex items-center justify-between text-xs text-themed-muted mb-3 gap-2">
              <span><Clock className="w-3 h-3 inline mr-1" />{showTicketModal.ends_at ? <CountdownText targetDate={showTicketModal.ends_at} /> : "Venda total"}</span>
              <span><Users className="w-3 h-3 inline mr-1" />{showTicketModal.tickets_sold}/{showTicketModal.max_tickets}</span>
              {showTicketModal.creator_id === user?.id && (
                <span><Coins className="w-3 h-3 inline mr-1" />{formatAOA(showTicketModal.total_raised_centavos)}</span>
              )}
            </div>

            {reservation ? (
              <div className="glass-panel rounded-xl p-4 border border-accent-games/30 mb-3">
                <p className="text-body-sm text-themed-primary font-bold mb-1 flex items-center gap-2">
                  <Timer className="w-4 h-4 text-accent-gold" />
                  Bilhete #{reservation.ticket_number} reservado
                </p>
                <p className="text-xs text-themed-muted mb-3">Reserva expira em {ticketCountdown}s</p>
                <div className="flex gap-2">
                  <Button className="bg-accent-bisno text-zinc-950 hover:brightness-110 flex-1"
                    onClick={handleConfirmPurchase} disabled={purchasing}>
                    {purchasing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ticket className="w-4 h-4 mr-2" />}
                    Comprar Agora
                  </Button>
                  <Button variant="glass" className="border-accent-sos/30 text-accent-sos"
                    onClick={handleRelease} disabled={purchasing}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {error && <p className="text-accent-sos text-sm mb-3">{error}</p>}

                {ticketsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-themed-muted" /></div>
                ) : (
                  <>
                    {/* Ticket grid — 5 columns */}
                    <div className="grid grid-cols-5 gap-2 mb-3 min-h-[180px]">
                      {allTickets.map(t => {
                        const isSold = t.status === "sold";
                        const isReserved = t.status === "reserved";
                        const isMine = isReserved && reservation?.id === t.id;
                        return (
                          <button key={t.id}
                            onClick={() => !isSold && !isReserved && handleReserve(t.ticket_number)}
                            disabled={isSold || isReserved || reserving}
                            className={cn(
                              "rounded-lg py-2 px-1 text-center font-mono text-sm transition-all border",
                              isSold && "bg-white/5 text-themed-muted/30 border-white/5 cursor-not-allowed line-through",
                              isReserved && !isMine && "bg-accent-gold/10 text-accent-gold/50 border-accent-gold/20 cursor-not-allowed",
                              isMine && "bg-accent-gold/20 text-accent-gold border-accent-gold/40",
                              !isSold && !isReserved && "bg-white/5 text-themed-primary border-white/10 hover:bg-accent-bisno/20 hover:border-accent-bisno/50 cursor-pointer",
                            )}
                            title={isSold ? "Vendido" : isReserved ? "Reservado" : "Disponível"}>
                            {t.ticket_number}
                          </button>
                        );
                      })}
                      {/* Fill empty slots if less than TICKETS_PER_PAGE */}
                      {allTickets.length < TICKETS_PER_PAGE && Array.from({ length: TICKETS_PER_PAGE - allTickets.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="rounded-lg py-2 px-1 text-center text-themed-muted/20 border border-dashed border-white/5" />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalTicketPages > 1 && (
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <button onClick={() => loadAllTickets(showTicketModal.id, ticketPage - 1)}
                          disabled={ticketPage === 0}
                          className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-themed-muted">{ticketPage + 1} / {totalTicketPages}</span>
                        <button onClick={() => loadAllTickets(showTicketModal.id, ticketPage + 1)}
                          disabled={ticketPage >= totalTicketPages - 1}
                          className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Participants Modal ── */}
      {showParticipants && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
          <div className="glass-panel rounded-2xl p-4 sm:p-6 w-full max-h-[85dvh] overflow-y-auto max-w-md border border-white/10 my-2 sm:my-4 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Participantes ({participants.length})</h3>
              <button onClick={() => setShowParticipants(null)} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-themed-muted" />
              </button>
            </div>
            {participantsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-themed-muted" /></div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {participants.map(p => (
                  <div key={p.ticket_number} className="flex items-center justify-between glass-panel rounded-xl px-4 py-2">
                    <span className="text-themed-primary font-mono">#{p.ticket_number}</span>
                    <span className="text-themed-muted text-sm">{p.name}</span>
                  </div>
                ))}
                {participants.length === 0 && <p className="text-themed-muted text-sm text-center py-4">Nenhum participante.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ── */}
      {showCancelConfirm && (() => {
        const r = rifas.find(x => x.id === showCancelConfirm);
        if (!r) return null;
        const isDraft = r.status === "draft";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="glass-panel rounded-2xl p-6 w-full max-h-[85dvh] overflow-y-auto max-w-md border border-white/10">
              <h3 className="text-h3 font-space-grotesk text-themed-primary mb-2">
                {isDraft ? "Cancelar Rascunho?" : "Cancelar Sorteio?"}
              </h3>
              {isDraft ? (
                <p className="text-themed-muted text-sm mb-4">Tens a certeza? O rascunho será cancelado.</p>
              ) : (
                <p className="text-themed-muted text-sm mb-4">
                  O sorteio tem {r.tickets_sold} bilhete(s) vendido(s). Serão reembolsados automaticamente.
                </p>
              )}
              {error && <p className="text-accent-sos text-sm mb-3">{error}</p>}
              <div className="flex gap-3">
                <Button variant="glass" className="flex-1 border-white/10"
                  onClick={() => setShowCancelConfirm(null)}>
                  Voltar
                </Button>
                <Button className="bg-accent-sos text-white hover:brightness-110 flex-1"
                  onClick={() => cancelRaffle(r.id)} disabled={cancelling}>
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Create Raffle Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-4 sm:p-6 w-full max-h-[85dvh] overflow-y-auto max-w-xl border border-white/10 my-2 sm:my-4 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Criar Sorteio</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-themed-muted" />
              </button>
            </div>

            <p className="text-body-sm text-themed-muted mb-4">
              O sorteio será criado em <strong>rascunho</strong>. Depois de configurado, podes activá-lo para começar a vender bilhetes.
            </p>

            {/* Image upload */}
            <div className="mb-4">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-2 block">Imagem do prémio</label>
              <div
                className="w-full h-24 sm:h-32 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-bisno/50 transition-colors overflow-hidden"
                onClick={() => fileRef.current?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-themed-muted mb-1" />
                    <span className="text-xs text-themed-muted">Clica para fazer upload</span>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setImagePreview(URL.createObjectURL(f));
                }} />
            </div>

            {/* Title & Video row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Título</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                  placeholder="Ex: iPhone 15 Pro Max" />
              </div>
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">URL do vídeo (opcional)</label>
                <input type="url" value={form.video_url}
                  onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                  placeholder="https://youtube.com/..." />
              </div>
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Descrição</label>
              <textarea value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50 resize-none h-20"
                placeholder="Descreve o prémio..." />
            </div>

            {/* Price, Tickets, Starts at, Ends at row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Início (opcional)</label>
                <input type="datetime-local" value={form.starts_at}
                  onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50" />
                <p className="text-xs text-themed-muted mt-1">Deixe vazio para activar manualmente.</p>
              </div>
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Encerramento</label>
                <input type="datetime-local" value={form.ends_at}
                  onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
                  disabled={endOnSoldOut}
                  className={cn("w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50", endOnSoldOut && "opacity-40 cursor-not-allowed")} />
                <label className="flex items-center gap-2 mt-2 text-xs text-themed-muted cursor-pointer">
                  <input type="checkbox" checked={endOnSoldOut} onChange={e => setEndOnSoldOut(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-accent-bisno focus:ring-accent-bisno" />
                  Terminar após venda de todos os bilhetes
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Preço (AOA)</label>
                <input type="number" value={form.ticket_price}
                  onChange={e => setForm(f => ({ ...f, ticket_price: e.target.value }))}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                  placeholder="500" />
              </div>
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Nº bilhetes</label>
                <input type="number" value={form.max_tickets}
                  onChange={e => setForm(f => ({ ...f, max_tickets: e.target.value }))}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                  placeholder="1000" />
              </div>
            </div>

            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}

            <Button className="w-full bg-accent-bisno text-zinc-950 hover:brightness-110" onClick={createRaffle} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar como Rascunho
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Delivery Status helpers ── */

function DeliveryBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending:             { label: "A aguardar confirmação", color: "text-accent-gold border-accent-gold/30" },
    confirmed_by_winner: { label: "Vencedor confirmou",      color: "text-accent-feed border-accent-feed/30" },
    confirmed_by_creator:{ label: "Criador confirmou",       color: "text-accent-feed border-accent-feed/30" },
    completed:           { label: "Concluído",               color: "text-accent-games border-accent-games/30" },
    expired:             { label: "Expirado",                color: "text-accent-sos border-accent-sos/30" },
    disputed:            { label: "Em disputa",              color: "text-accent-sos border-accent-sos/30" },
  };
  const c = config[status] ?? { label: status, color: "text-themed-muted border-white/10" };
  return (
    <span className={cn("text-label-caps uppercase text-xs border px-2 py-0.5 rounded-full", c.color)}>
      {c.label}
    </span>
  );
}

/* ── Ganhos (Winnings) Sub-component ── */

function GanhosView() {
  const user = useAuthStore(s => s.user);
  const [wins, setWins] = useState<{ raffle: Raffle; delivery: DeliveryCode | null }[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadWins() {
    setLoading(true);
    try {
      const all = await rafflesApi.list("finished");
      const result: typeof wins = [];
      for (const r of all) {
        if (r.winner_id === user?.id) {
          let dc: DeliveryCode | null = null;
          try { dc = await rafflesApi.deliveryStatus(r.id); } catch { /* no delivery code yet */ }
          result.push({ raffle: r, delivery: dc });
        }
      }
      result.sort((a, b) => new Date(b.raffle.drawn_at ?? b.raffle.created_at).getTime() - new Date(a.raffle.drawn_at ?? a.raffle.created_at).getTime());
      setWins(result);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadWins(); }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>;

  if (wins.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center">
        <Gift className="w-12 h-12 text-themed-muted mx-auto mb-4" />
        <h3 className="text-h3 font-space-grotesk text-themed-primary mb-2">Ganhos</h3>
        <p className="text-themed-muted">Ainda não ganhaste nenhum sorteio. Compra bilhetes e tenta a sorte!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {wins.map(({ raffle: r, delivery }) => {
        const isCompleted = delivery?.status === "completed";

        return (
          <div key={r.id} className={cn("glass-panel rounded-xl overflow-hidden",
            isCompleted ? "border border-accent-games/30 bg-accent-games/5" : "border border-accent-gold/30 bg-accent-gold/5")}>
            <div className="flex gap-4 p-4">
              {r.image_url && (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-900/50">
                  <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold shrink-0" />
                  <span className="text-label-caps text-accent-gold uppercase text-xs font-bold">Ganho</span>
                  {delivery && <DeliveryBadge status={delivery.status} />}
                </div>
                <h4 className="text-body-md font-bold text-themed-primary truncate">{r.title}</h4>
                <p className="text-xs text-themed-muted">
                  Bilhete #{r.winning_ticket} — {r.drawn_at ? new Date(r.drawn_at).toLocaleDateString("pt-AO") : ""}
                </p>
              </div>
            </div>
            {delivery ? (
              <div className="border-t border-white/5 px-4 py-3 flex items-center justify-between gap-3">
                <code className="text-xl font-mono font-bold text-accent-gold tracking-[0.2em] select-all">{delivery.code}</code>
                <span className="text-xs text-themed-muted shrink-0">Código de entrega</span>
              </div>
            ) : (
              <div className="border-t border-white/5 px-4 py-3">
                <p className="text-xs text-themed-muted">Código de entrega ainda não gerado.</p>
              </div>
            )}
            {isCompleted && (
              <div className="border-t border-white/5 px-4 py-2 flex items-center gap-2 text-xs text-accent-games bg-accent-games/5">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                Entrega concluída
              </div>
            )}
            {delivery?.status === "disputed" && delivery.dispute_reason && (
              <div className="border-t border-white/5 px-4 py-2 text-xs text-accent-sos">
                Disputa: {delivery.dispute_reason}
                {delivery.dispute_resolution && <> — {delivery.dispute_resolution}</>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── My Tickets Sub-component ── */
function MyTicketsView() {
  const user = useAuthStore(s => s.user);
  const [tickets, setTickets] = useState<{ raffle: Raffle; ticket: RaffleTicket }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const all = await rafflesApi.list("all");
        const my: typeof tickets = [];
        for (const r of all) {
          try {
            const ts = await rafflesApi.myTickets(r.id);
            for (const t of ts) my.push({ raffle: r, ticket: t });
          } catch { /* no tickets in this raffle */ }
        }
        my.sort((a, b) => new Date(b.ticket.purchased_at).getTime() - new Date(a.ticket.purchased_at).getTime());
        setTickets(my);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>;

  if (tickets.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center">
        <Lock className="w-12 h-12 text-themed-muted mx-auto mb-4" />
        <h3 className="text-h3 font-space-grotesk text-themed-primary mb-2">Os teus bilhetes</h3>
        <p className="text-themed-muted">Ainda não compraste nenhum bilhete.</p>
      </div>
    );
  }

  const isWinner = (raffle: Raffle) =>
    raffle.status === "finished" && user?.id === raffle.winner_id;

  return (
    <div className="space-y-3">
      {tickets.map(({ raffle, ticket }) => {
        const won = isWinner(raffle) && ticket.ticket_number === raffle.winning_ticket;
        return (
          <div key={ticket.id} className={cn("glass-panel rounded-xl p-4 flex items-center justify-between transition-all",
            won && "border-accent-gold/50 bg-accent-gold/5")}>
            <div className="flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center",
                won ? "bg-accent-gold/20" : "bg-accent-games/10")}>
                {won ? <Star className="w-5 h-5 text-accent-gold fill-accent-gold" /> : <Ticket className="w-5 h-5 text-accent-games" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-body-md font-bold text-themed-primary">{raffle.title}</p>
                  {won && (
                    <span className="text-label-caps text-xs bg-accent-gold/20 text-accent-gold border border-accent-gold/30 px-2 py-0.5 rounded-full">
                      Vencedor!
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-themed-muted">
                  Bilhete #{ticket.ticket_number} — {new Date(ticket.purchased_at).toLocaleDateString("pt-AO")}
                </p>
              </div>
            </div>
            <StatusBadge status={raffle.status} />
          </div>
        );
      })}
    </div>
  );
}

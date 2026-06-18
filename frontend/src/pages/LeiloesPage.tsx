import { useEffect, useState, useRef } from "react";
import {
  Gavel, Clock, Users, ShieldCheck, ChevronUp,
  Lock, CheckCircle, AlertCircle, Eye, Plus, X, Loader2, Upload,
  Award, UserCheck, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { auctionsApi, formatAOA, type Auction, type BidHistoryItem, type ParticipantInfo, type AuctionMyWin, type AuctionDeliveryStatus } from "@/services/modules";
import { extractApiError } from "@/services/api";

// ── Countdown component (real-time) ────────────────────────────────────────────
function CountdownText({ endAt, extendedAt }: { endAt: string; extendedAt: string | null }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    function tick() {
      const diff = new Date(extendedAt || endAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Terminado"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setRemaining(`${d}d ${h}h ${m}m ${s}s`);
      else if (h > 0) setRemaining(`${h}h ${m}m ${s}s`);
      else setRemaining(`${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt, extendedAt]);
  return <>{remaining}</>;
}

// ── Auction Card component ─────────────────────────────────────────────────────
function AuctionCard({ a, user, bidAmounts, setBidAmounts, bidding, placeBid, openDetail, finalize }: {
  a: Auction; user: any; bidAmounts: Record<string, number>;
  setBidAmounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  bidding: string | null;
  placeBid: (id: string) => Promise<void>;
  openDetail: (a: Auction) => Promise<void>;
  finalize: (a: Auction) => Promise<void>;
}) {
    const isCreator = !!(user?.id && String(a.creator_id) === String(user.id));
    const isFinished = a.status === "finished";
    const now = Date.now();
    const endTime = new Date(a.ends_at_extended || a.ends_at).getTime();
    const isExpired = !isFinished && endTime < now;
    const isUrgent = !isFinished && !isExpired && endTime - now < 3600000;
    const minBid = a.min_next_bid / 100;
    const pos = a.user_position;
    const showBidArea = !isFinished && !isExpired && !isCreator;

    if (isFinished) {
      return (
        <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
          <div className="flex gap-4 p-4">
            {a.image_url && (
              <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-900/50">
                <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Gavel className="w-3.5 h-3.5 text-accent-feed shrink-0" />
                <span className="text-label-caps text-accent-feed uppercase text-xs font-bold">Finalizado</span>
                <span className="text-xs text-themed-muted ml-auto">{a.total_bids} lance{(a.total_bids ?? 0) !== 1 ? "s" : ""}</span>
              </div>
              <h4 className="text-body-md font-bold text-themed-primary truncate">{a.title}</h4>
              <p className="text-body-sm text-themed-muted">{formatAOA(a.current_bid_centavos)}</p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button variant="glass" size="sm" className="border-white/10" onClick={() => openDetail(a)}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
              {isCreator && a.delivery_status === "pending" && a.has_delivery_code && (
                <Button variant="glass" size="sm" className="text-accent-feed border-accent-feed/30"
                  onClick={() => openDetail(a)}>
                  <Award className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("glass-panel luminous-edge rounded-xl overflow-hidden transition-all hover:border-white/20",
        isUrgent && "border-accent-sos/30")}>
        {a.image_url && (
          <div className="w-full aspect-[16/9] bg-zinc-900/50 flex items-center justify-center overflow-hidden">
            <img src={a.image_url} alt={a.title} className="w-full h-full object-contain" />
          </div>
        )}
        <div className={cn("px-5 py-3 flex items-center justify-between border-b border-white/5",
          isExpired ? "bg-zinc-800/30" : isUrgent ? "bg-accent-sos/10" : "bg-white/2")}>
          <div className="flex items-center gap-2">
            <Gavel className={cn("w-4 h-4", isExpired ? "text-zinc-500" : isUrgent ? "text-accent-sos" : "text-themed-muted")} />
            <span className={cn("text-label-caps uppercase font-bold text-xs",
              isExpired ? "text-zinc-500" : isUrgent ? "text-accent-sos" : "text-themed-muted")}>
              {isExpired ? "Expirado" : isUrgent ? "A terminar" : "Activo"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-themed-muted text-body-sm">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {a.total_bids}</span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-h3 font-space-grotesk text-themed-primary">{a.title}</h3>
            {pos && (
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full ml-2",
                pos === "leading" ? "bg-accent-feed/20 text-accent-feed" :
                pos === "outbidded" ? "bg-accent-sos/20 text-accent-sos" : "bg-white/5 text-themed-muted")}>
                {pos === "leading" ? "Líder" : pos === "outbidded" ? "Ultrapassado" : "---"}
              </span>
            )}
          </div>
          <p className="text-body-sm text-themed-muted mb-4 line-clamp-2">{a.description}</p>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-label-caps text-themed-muted uppercase mb-1">Lance actual</p>
              <p className="text-h2 font-space-grotesk text-themed-primary">{formatAOA(a.current_bid_centavos)}</p>
            </div>
            <div className="text-right">
              <p className="text-label-caps text-themed-muted uppercase mb-1">{isExpired ? "Expirado" : "Termina em"}</p>
              <p className={cn("font-bold flex items-center gap-1", isExpired ? "text-zinc-500" : isUrgent ? "text-accent-sos" : "text-accent-gold")}>
                <Clock className="w-4 h-4" /> {isExpired ? "---" : <CountdownText endAt={a.ends_at} extendedAt={a.ends_at_extended} />}
              </p>
            </div>
          </div>

          {showBidArea && (
            <>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center glass-panel rounded-xl px-4 border border-white/10 focus-within:border-accent-bisno/50 transition-colors">
                  <span className="text-themed-muted text-body-sm mr-2">AOA</span>
                  <input type="number"
                    value={bidAmounts[a.id] ?? minBid}
                    onChange={e => setBidAmounts(p => ({ ...p, [a.id]: Number(e.target.value) }))}
                    className="flex-1 bg-transparent outline-none text-themed-primary text-body-md py-3"
                    min={minBid} step={a.min_increment_centavos / 100} />
                </div>
                <Button className="bg-accent-bisno text-zinc-950 hover:brightness-110 px-5"
                  onClick={() => placeBid(a.id)} disabled={bidding === a.id}>
                  {bidding === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronUp className="w-4 h-4 mr-1" />} Licitar
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                {[10, 50, 100, 500].map(inc => {
                  const incCentavos = inc * 100;
                  if (incCentavos < a.min_increment_centavos) return null;
                  const val = (a.min_next_bid / 100) + inc;
                  return (
                    <button key={inc}
                      onClick={() => setBidAmounts(p => ({ ...p, [a.id]: val }))}
                      className="flex-1 text-xs font-medium glass-panel border border-white/10 rounded-lg py-1.5 text-accent-bisno hover:bg-accent-bisno/10 hover:border-accent-bisno/30 transition-colors">
                      +{inc}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-themed-muted flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Inc. mín: {formatAOA(a.min_increment_centavos)}
                </p>
                <p className="text-xs text-accent-feed font-medium">Mín: {formatAOA(a.min_next_bid)}</p>
              </div>
            </>
          )}
          {isCreator && !isFinished && !isExpired && (
            <p className="text-xs text-themed-muted text-center mt-2">És o criador — não podes licitar no teu próprio leilão.</p>
          )}
          {isCreator && isExpired && (
            <Button className="w-full bg-accent-gold text-zinc-950 hover:brightness-110 mt-2"
              size="sm" onClick={() => finalize(a)}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Finalizar Leilão
            </Button>
          )}

          <div className="flex gap-2 mt-3">
            <Button variant="glass" size="sm" className="flex-1" onClick={() => openDetail(a)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> Detalhes
            </Button>
          </div>
        </div>
      </div>
    );
  }

// -- Ganhos View component (fetches delivery codes per auction, like rifas) --
function GanhosView({ wins, loading }: { wins: AuctionMyWin[]; loading: boolean }) {
  const [deliveries, setDeliveries] = useState<Record<string, AuctionDeliveryStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    wins.forEach(w => {
      auctionsApi.deliveryStatus(w.id).then(d => {
        setDeliveries(prev => ({ ...prev, [w.id]: d }));
        setErrors(prev => { const n = { ...prev }; delete n[w.id]; return n; });
      }).catch(e => {
        setErrors(prev => ({ ...prev, [w.id]: (e as any)?.response?.data?.detail || "Erro ao carregar código." }));
      });
    });
  }, [wins]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>;
  }
  if (wins.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center">
        <Award className="w-12 h-12 text-themed-muted mx-auto mb-4" />
        <h3 className="text-h3 font-space-grotesk text-themed-primary mb-2">Nenhum ganho ainda</h3>
        <p className="text-themed-muted">Quando ganhares um leilão, o código de entrega aparecerá aqui.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {wins.map(w => {
        const d = deliveries[w.id];
        return (
          <div key={w.id} className="glass-panel rounded-xl overflow-hidden">
            <div className="flex gap-4 p-4">
              {w.image_url && (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-900/50">
                  <img src={w.image_url} alt={w.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-3.5 h-3.5 text-accent-feed shrink-0" />
                  <span className="text-label-caps text-accent-feed uppercase text-xs font-bold">Ganho</span>
                  <span className={cn("text-label-caps uppercase text-xs font-bold ml-auto",
                    w.delivery_status === "completed" ? "text-accent-feed" : "text-accent-gold")}>
                    {w.delivery_status === "pending" ? "Entrega pendente" : "Concluído"}
                  </span>
                </div>
                <h4 className="text-body-md font-bold text-themed-primary truncate">{w.title}</h4>
                <p className="text-body-sm text-themed-muted">{formatAOA(w.current_bid_centavos)}</p>
              </div>
            </div>
            <div className="border-t border-white/5 px-4 py-3 flex items-center justify-between gap-3">
              {d ? (
                <>
                  <code className="text-xl font-mono font-bold text-accent-gold tracking-[0.2em] select-all">{d.delivery_code || "---"}</code>
                  <span className="text-xs text-themed-muted shrink-0">Código de entrega</span>
                </>
              ) : errors[w.id] ? (
                <span className="text-xs text-accent-sos">{errors[w.id]}</span>
              ) : (
                <span className="text-xs text-themed-muted">A carregar código...</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeiloesPage() {
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<"activos" | "meus" | "historico" | "ganhos">("activos");
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [myBids, setMyBids] = useState<Auction[]>([]);
  const [myBidsLoading, setMyBidsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [bidding, setBidding] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "", description: "", starting_bid: "", reserve_price: "", min_increment: "100",
    starts_at_date: "", starts_at_time: "",
    ends_at_date: "", ends_at_time: "",
  });
  // Detail modal
  const [detail, setDetail] = useState<Auction | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "bids" | "participants">("info");
  const [bidHistory, setBidHistory] = useState<BidHistoryItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [detailBusy, setDetailBusy] = useState(false);
  // Delivery code input (matches RifasPage flow)
  const [deliveryCode, setDeliveryCode] = useState("");
  const [deliveryLookupResult, setDeliveryLookupResult] = useState<any>(null);
  const [deliveryLookupLoading, setDeliveryLookupLoading] = useState(false);
  const [deliveryLookupError, setDeliveryLookupError] = useState("");
  const [deliveryConfirmLoading, setDeliveryConfirmLoading] = useState(false);
  // Ganhos
  const [myWins, setMyWins] = useState<AuctionMyWin[]>([]);
  const [winsLoading, setWinsLoading] = useState(false);

  async function load(status = "active", isBackground = false) {
    if (!isBackground) setLoading(true);
    try {
      const data = await auctionsApi.list(status);
      setAuctions(data);
      // Only set bid amounts for new auctions (don't overwrite user input)
      setBidAmounts(prev => {
        const next = { ...prev };
        data.forEach(a => {
          const key = a.id;
          if (!(key in prev)) next[key] = a.min_next_bid / 100;
        });
        return next;
      });
    } catch (e) {
      if (!isBackground) setError(extractApiError(e));
    } finally {
      if (!isBackground) setLoading(false);
      setInitialLoading(false);
    }
  }

  async function loadWins() {
    setWinsLoading(true);
    try { setMyWins(await auctionsApi.myWins()); } catch { /* ignore */ }
    setWinsLoading(false);
  }

  async function loadMyBids() {
    setMyBidsLoading(true);
    try { setMyBids(await auctionsApi.myBids()); } catch { /* ignore */ }
    setMyBidsLoading(false);
  }

  useEffect(() => {
    if (tab === "activos") load("active", false);
    else if (tab === "ganhos") loadWins();
    else if (tab === "meus") loadMyBids();
    else load("finished", false);
  }, [tab]);

  // Background refresh for real-time bid visibility (no spinner)
  useEffect(() => {
    if (tab !== "activos") return;
    const id = setInterval(() => { load("active", true); }, 15000);
    return () => clearInterval(id);
  }, [tab]);

  // Background refresh for Ganhos (picks up newly finalized auctions)
  useEffect(() => {
    if (tab !== "ganhos") return;
    const id = setInterval(() => { loadWins(); }, 15000);
    return () => clearInterval(id);
  }, [tab]);

  async function placeBid(id: string) {
    const centavos = Math.round((bidAmounts[id] ?? 0) * 100);
    setBidding(id); setError("");
    try {
      await auctionsApi.bid(id, centavos);
      await load("active");
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setBidding(null);
    }
  }

  async function createAuction() {
    setCreating(true); setError("");
    try {
      const startsAt = new Date(`${form.starts_at_date}T${form.starts_at_time || "00:00"}`);
      const endsAt = new Date(`${form.ends_at_date}T${form.ends_at_time || "23:59"}`);
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("starts_at", startsAt.toISOString());
      fd.append("ends_at", endsAt.toISOString());
      fd.append("starting_bid_centavos", String(Math.round(parseFloat(form.starting_bid) * 100)));
      fd.append("reserve_price_centavos", String(Math.round(parseFloat(form.reserve_price) * 100)));
      fd.append("min_increment_centavos", String(Math.round(parseFloat(form.min_increment) * 100)));
      if (fileRef.current?.files?.[0]) fd.append("image", fileRef.current.files[0]);
      await auctionsApi.create(fd);
      setShowCreate(false);
      setForm({ title: "", description: "", starting_bid: "", reserve_price: "", min_increment: "100", starts_at_date: "", starts_at_time: "", ends_at_date: "", ends_at_time: "" });
      setImagePreview(null);
      await load("active");
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setCreating(false);
    }
  }

  async function openDetail(a: Auction) {
    setDetail(a);
    setDetailTab("info");
    setDetailBusy(true);
    try {
      const [full, hist, parts] = await Promise.all([
        auctionsApi.get(a.id),
        auctionsApi.history(a.id),
        auctionsApi.participants(a.id).catch(() => [] as ParticipantInfo[]),
      ]);
      setDetail(full);
      setBidHistory(hist);
      setParticipants(parts);
    } catch { /* ignore */ }
    setDetailBusy(false);
  }

  async function finalize(a: Auction) {
    setError("");
    try {
      await auctionsApi.finalize(a.id);
      await load("active");
      if (detail?.id === a.id) setDetail(null);
    } catch (e) {
      setError(extractApiError(e));
    }
  }

  async function lookupDeliveryCode() {
    const code = deliveryCode.trim();
    if (!code) return;
    setDeliveryLookupLoading(true);
    setDeliveryLookupError("");
    setDeliveryLookupResult(null);
    try {
      const res = await auctionsApi.deliveryLookupByCode(code);
      setDeliveryLookupResult(res);
    } catch (e) {
      setDeliveryLookupError((e as any)?.response?.data?.detail || "Código inválido.");
    }
    setDeliveryLookupLoading(false);
  }

  async function confirmDelivery() {
    if (!deliveryCode.trim()) return;
    setDeliveryConfirmLoading(true);
    setDeliveryLookupError("");
    try {
      await auctionsApi.deliveryConfirmByCode(deliveryCode.trim());
      setDeliveryLookupResult(null);
      setDeliveryCode("");
      await load("active");
    } catch (e) {
      setDeliveryLookupError((e as any)?.response?.data?.detail || "Erro ao confirmar.");
    }
    setDeliveryConfirmLoading(false);
  }

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-h1 font-space-grotesk text-themed-primary">Leilões</h1>
          <p className="text-themed-muted mt-1">Licita, ganha, recebe. Processo transparente com escrow.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="glass" size="sm" onClick={() => load(tab === "activos" ? "active" : "finished", true)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-accent-feed" />
            <span className="text-body-sm text-accent-feed font-medium">Provably Fair</span>
          </div>
          <Button className="bg-accent-bisno text-zinc-950 hover:brightness-110" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Criar
          </Button>
        </div>
      </div>

      {/* Delivery code verification — creator enters the winner's code (matches RifasPage exactly) */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full">
          <input
            type="text"
            placeholder="Código de entrega..."
            value={deliveryCode}
            onChange={e => setDeliveryCode(e.target.value.toUpperCase())}
            className="bg-transparent border-none outline-none text-themed-primary w-40 text-sm"
          />
          <button
            onClick={lookupDeliveryCode}
            disabled={deliveryLookupLoading || !deliveryCode.trim()}
            className="text-accent-bisno hover:text-accent-gold transition-colors disabled:opacity-30 text-sm font-medium"
          >
            {deliveryLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
          </button>
        </div>
        {deliveryLookupError && <span className="text-accent-sos text-xs">{deliveryLookupError}</span>}
      </div>

      {/* Tabs — same order as rifas */}
      <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-8">
        {(["activos", "meus", "historico", "ganhos"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-5 py-2 rounded-full text-body-sm font-medium transition-all",
              tab === t ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
            {t === "activos" ? "Activos" : t === "meus" ? "Minhas Licitações" : t === "historico" ? "Histórico" : "Ganhos"}
          </button>
        ))}
      </div>

      {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}

      {(initialLoading && loading) ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>
      ) : tab === "ganhos" ? (
        <GanhosView wins={myWins} loading={winsLoading} />
      ) : tab === "activos" || tab === "historico" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {auctions.map(a => (
            <AuctionCard key={a.id} a={a} user={user}
              bidAmounts={bidAmounts} setBidAmounts={setBidAmounts}
              bidding={bidding} placeBid={placeBid} openDetail={openDetail} finalize={finalize} />
          ))}
          {auctions.length === 0 && (
            <div className="col-span-2 glass-panel rounded-xl p-8 text-center">
              <Gavel className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">{tab === "activos" ? "Sem leilões activos." : "Sem histórico."}</p>
            </div>
          )}
        </div>
      ) : tab === "meus" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {myBidsLoading ? (
            <div className="col-span-2 flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>
          ) : myBids.length === 0 ? (
            <div className="col-span-2 glass-panel rounded-xl p-8 text-center">
              <Lock className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <h3 className="text-h3 font-space-grotesk text-themed-primary mb-2">Sem licitações activas</h3>
              <p className="text-themed-muted mb-6">As tuas licitações activas aparecerão aqui.</p>
              <Button onClick={() => setTab("activos")}>Ver Leilões</Button>
            </div>
          ) : myBids.map(a => (
            <AuctionCard key={a.id} a={a} user={user}
              bidAmounts={bidAmounts} setBidAmounts={setBidAmounts}
              bidding={bidding} placeBid={placeBid} openDetail={openDetail} finalize={finalize} />
          ))}
        </div>
      ) : null}

      {/* ── Detail Modal ─────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
          onClick={() => setDetail(null)}>
          <div className="glass-panel luminous-edge rounded-2xl p-4 sm:p-6 w-full max-w-lg border border-white/10 my-2 sm:my-4 mx-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">{detail.title}</h3>
              <button onClick={() => setDetail(null)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            {detail.image_url && (
              <div className="w-full aspect-[16/9] bg-zinc-900/50 flex items-center justify-center overflow-hidden rounded-xl mb-4">
                <img src={detail.image_url} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            <p className="text-body-sm text-themed-muted mb-4">{detail.description}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-label-caps text-themed-muted uppercase text-xs">Lance actual</p>
                <p className="text-h3 font-space-grotesk text-themed-primary">{formatAOA(detail.current_bid_centavos)}</p>
              </div>
              <div>
                <p className="text-label-caps text-themed-muted uppercase text-xs">Mínimo próximo</p>
                <p className="text-h3 font-space-grotesk text-accent-bisno">{formatAOA(detail.min_next_bid)}</p>
              </div>
              <div>
                <p className="text-label-caps text-themed-muted uppercase text-xs">Participantes</p>
                <p className="text-body-md font-bold text-themed-primary">{detail.total_participants}</p>
              </div>
              <div>
                <p className="text-label-caps text-themed-muted uppercase text-xs">Total de lances</p>
                <p className="text-body-md font-bold text-themed-primary">{detail.total_bids}</p>
              </div>
            </div>

            {/* Detail tabs */}
            <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-4">
              {(["info", "bids", "participants"] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                    detailTab === t ? "bg-white/10 text-themed-primary" : "text-themed-muted")}>
                  {t === "info" ? "Info" : t === "bids" ? "Lances" : "Participantes"}
                </button>
              ))}
            </div>

            {detailTab === "info" && (
              <div className="space-y-2 text-body-sm">
                <div className="flex justify-between"><span className="text-themed-muted">Estado</span>
                  <span className={detail.status === "active" ? "text-accent-feed" : "text-themed-muted"}>{detail.status === "active" ? "Activo" : "Finalizado"}</span></div>
                <div className="flex justify-between"><span className="text-themed-muted">Incremento mín</span><span>{formatAOA(detail.min_increment_centavos)}</span></div>
                <div className="flex justify-between"><span className="text-themed-muted">Cofre (escrow)</span><span>{formatAOA(detail.pool_held_centavos)}</span></div>
                <div className="flex justify-between"><span className="text-themed-muted">Termina</span><span>{new Date(detail.ends_at).toLocaleString("pt-AO")}</span></div>
                {detail.ends_at_extended && (
                  <div className="flex justify-between"><span className="text-themed-muted">Prolongado até</span><span className="text-accent-sos">{new Date(detail.ends_at_extended).toLocaleString("pt-AO")}</span></div>
                )}
                <div className="flex justify-between"><span className="text-themed-muted">Extensões</span><span>{detail.extensions_count}/{detail.max_extensions}</span></div>
                <div className="flex justify-between"><span className="text-themed-muted">Janela anti-sniping</span><span>{detail.anti_sniping_window_seconds}s</span></div>
                {detail.winner_id && (
                  <div className="flex justify-between"><span className="text-themed-muted">Vencedor</span><span className="text-accent-feed">ID: {detail.winner_id.slice(0, 8)}...</span></div>
                )}
                <div className="flex justify-between"><span className="text-themed-muted">Entrega</span>
                  <span className={detail.delivery_status === "completed" ? "text-accent-feed" : detail.delivery_status === "pending" ? "text-accent-gold" : "text-themed-muted"}>
                    {detail.delivery_status === "pending" ? "Pendente" : detail.delivery_status === "confirmed" ? "Confirmado" : "Concluído"}
                  </span>
                </div>
                {detail.has_delivery_code && (
                  <div className="flex justify-between items-center">
                    <span className="text-themed-muted">Código entrega</span>
                    {detail.delivery_code ? (
                      <code className="text-sm font-mono font-bold text-accent-gold tracking-wider select-all bg-accent-gold/5 px-2 py-0.5 rounded">
                        {detail.delivery_code}
                      </code>
                    ) : (
                      <span className="text-xs text-accent-gold bg-accent-gold/5 px-2 py-0.5 rounded">✓ Fornecido ao vencedor</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {detailTab === "bids" && (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {detailBusy ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-themed-muted" /> : (
                  bidHistory.length === 0 ? <p className="text-themed-muted text-sm text-center py-4">Nenhum lance ainda.</p> : (
                    bidHistory.map((b, i) => (
                      <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                        b.is_winning ? "bg-accent-feed/10" : "bg-white/3")}>
                        <div className="flex items-center gap-2">
                          <span className={b.is_winning ? "text-accent-feed" : "text-themed-muted"}>{b.bidder_label}</span>
                          {b.is_winning && <Award className="w-3 h-3 text-accent-feed" />}
                          {b.is_active && !b.is_winning && <span className="text-xs text-accent-sos">(ultrapassado)</span>}
                        </div>
                        <span className="font-medium">{formatAOA(b.amount_centavos)}</span>
                      </div>
                    ))
                  )
                )}
              </div>
            )}

            {detailTab === "participants" && (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {detailBusy ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-themed-muted" /> : (
                  participants.length === 0 ? <p className="text-themed-muted text-sm text-center py-4">Nenhum participante.</p> : (
                    participants.map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3 text-sm">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-themed-muted" />
                          <span>{p.label}</span>
                          <span className="text-xs text-themed-muted">({p.name})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-themed-muted">{p.bid_count}x</span>
                          <span className="font-medium">{formatAOA(p.total_locked_centavos)}</span>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {detail.status === "active" && user?.id && String(detail.creator_id) !== String(user.id) && (
                <Button className="flex-1 bg-accent-bisno text-zinc-950 hover:brightness-110"
                  onClick={() => setDetail(null)}>
                  <ChevronUp className="w-4 h-4 mr-1" /> Licitar
                </Button>
              )}
              {detail.status === "active" && user?.id && String(detail.creator_id) === String(user.id) && (
              <Button variant="glass" className="flex-1" onClick={() => { finalize(detail); }}>
                <CheckCircle className="w-4 h-4 mr-1" /> Finalizar
              </Button>
              )}
              {user?.id && String(detail.creator_id) === String(user.id) && detail.status === "finished" && detail.delivery_status === "pending" && detail.has_delivery_code && (
                <div className="w-full flex gap-2">
                  <input type="text" placeholder="Código do vencedor..."
                    className="flex-1 glass-panel border border-white/10 rounded-xl px-4 py-2 text-sm text-themed-primary outline-none"
                    onChange={e => setDeliveryCode(e.target.value.toUpperCase())} />
                  <Button size="sm" className="bg-accent-feed text-white"
                    disabled={deliveryConfirmLoading}
                    onClick={async () => {
                      if (deliveryCode.trim()) {
                        await confirmDelivery();
                        if (!deliveryLookupError) setDetail(null);
                      }
                    }}>
                    {deliveryConfirmLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />} Confirmar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delivery Code Confirmation Modal (matches RifasPage) ── */}
      {deliveryLookupResult && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-4 sm:p-6 w-full max-w-lg border border-white/10 my-2 sm:my-4 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Confirmar Entrega</h3>
              <button onClick={() => { setDeliveryLookupResult(null); setDeliveryCode(""); setDeliveryLookupError(""); }} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-themed-muted" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="glass-panel rounded-xl p-4 border border-accent-gold/20">
                <h4 className="text-body-md font-bold text-themed-primary mb-1">{deliveryLookupResult.title}</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-panel rounded-xl p-3 border border-white/5">
                  <p className="text-label-caps text-themed-muted uppercase text-xs">Prémio (Escrow)</p>
                  <p className="text-body-md font-bold text-accent-gold">{formatAOA(deliveryLookupResult.pool_held_centavos)}</p>
                </div>
                <div className="glass-panel rounded-xl p-3 border border-white/5">
                  <p className="text-label-caps text-themed-muted uppercase text-xs">Vencedor</p>
                  <p className="text-body-md font-bold text-themed-primary">{deliveryLookupResult.winner_name || "—"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between glass-panel rounded-xl p-3 border border-white/5">
                <span className="text-label-caps text-themed-muted uppercase text-xs">Estado</span>
                <span className={cn("text-label-caps uppercase text-xs font-bold",
                  deliveryLookupResult.delivery_status === "completed" ? "text-accent-feed" : "text-accent-gold")}>
                  {deliveryLookupResult.delivery_status === "pending" ? "Pendente" : "Concluído"}
                </span>
              </div>
            </div>

            {(deliveryLookupResult.delivery_status === "pending") && (
              <div className="flex gap-3">
                <Button variant="glass" className="flex-1 border-white/10 text-themed-muted"
                  onClick={() => { setDeliveryLookupResult(null); setDeliveryCode(""); }}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-accent-bisno text-zinc-950 hover:brightness-110"
                  onClick={confirmDelivery}
                  disabled={deliveryConfirmLoading}
                >
                  {deliveryConfirmLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Confirmar Entrega
                </Button>
              </div>
            )}

            {deliveryLookupResult.delivery_status === "completed" && (
              <div className="flex items-center gap-2 text-sm text-accent-feed mb-4">
                <CheckCircle className="w-4 h-4" />
                Esta entrega já foi concluída.
              </div>
            )}

            {deliveryLookupError && <p className="text-accent-sos text-sm mt-3">{deliveryLookupError}</p>}
          </div>
        </div>
      )}

      {/* ── Modal criar leilão ────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-4 sm:p-6 w-full max-w-3xl border border-white/10 my-2 sm:my-4 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Criar Leilão</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/5 rounded-lg transition-colors"><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-2 block">Imagem</label>
              <div className="w-full h-24 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-bisno/50 transition-colors overflow-hidden"
                onClick={() => fileRef.current?.click()}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <><Upload className="w-5 h-5 text-themed-muted mb-1" /><span className="text-xs text-themed-muted">Clica para fazer upload</span></>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setImagePreview(URL.createObjectURL(f)); }} />
            </div>
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Título</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                placeholder="Ex: MacBook Pro M3" />
            </div>
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Descrição</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-lg px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50 resize-none h-16"
                placeholder="Descreve o item..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Valor do produto (AOA)</label>
                <input type="number" value={form.reserve_price} onChange={e => setForm(f => ({ ...f, reserve_price: e.target.value }))}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                  placeholder="300000" />
              </div>
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Caução (AOA)</label>
                <input type="number" value={form.starting_bid} onChange={e => setForm(f => ({ ...f, starting_bid: e.target.value }))}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                  placeholder="5000" />
              </div>
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Incremento mín (AOA)</label>
                <input type="number" value={form.min_increment} onChange={e => setForm(f => ({ ...f, min_increment: e.target.value }))}
                  className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                  placeholder="10000" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-2 block">Início</label>
                <div className="flex gap-2">
                  <input type="date" value={form.starts_at_date}
                    onChange={e => setForm(f => ({ ...f, starts_at_date: e.target.value }))}
                    className="flex-1 glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50 text-sm" />
                  <input type="time" value={form.starts_at_time}
                    onChange={e => setForm(f => ({ ...f, starts_at_time: e.target.value }))}
                    className="glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-2 block">Fim</label>
                <div className="flex gap-2">
                  <input type="date" value={form.ends_at_date}
                    onChange={e => setForm(f => ({ ...f, ends_at_date: e.target.value }))}
                    className="flex-1 glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50 text-sm" />
                  <input type="time" value={form.ends_at_time}
                    onChange={e => setForm(f => ({ ...f, ends_at_time: e.target.value }))}
                    className="glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50 text-sm" />
                </div>
              </div>
            </div>
            {error && <p className="text-accent-sos text-sm mb-3">{error}</p>}
            <Button className="w-full bg-accent-bisno text-zinc-950 hover:brightness-110" onClick={createAuction} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar Leilão
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

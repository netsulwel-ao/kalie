import { useEffect, useState, useRef } from "react";
import {
  Gavel, Clock, Users, ShieldCheck, ChevronUp,
  Lock, CheckCircle, AlertCircle, Plus, X, Loader2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { auctionsApi, formatAOA, timeLeft, type Auction } from "@/services/modules";
import { extractApiError } from "@/services/api";

export default function LeiloesPage() {
  const [tab, setTab] = useState<"activos" | "meus" | "historico">("activos");
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [bidding, setBidding] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "", description: "", starting_bid: "", min_increment: "100", ends_at: "",
  });

  async function load(status = "active") {
    setLoading(true);
    try {
      const data = await auctionsApi.list(status);
      setAuctions(data);
      // Init bid amounts
      const init: Record<string, number> = {};
      data.forEach(a => { init[a.id] = (a.current_bid_centavos + a.min_increment_centavos) / 100; });
      setBidAmounts(init);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "activos") load("active");
    else load("finished");
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
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("starting_bid_centavos", String(Math.round(parseFloat(form.starting_bid) * 100)));
      fd.append("min_increment_centavos", String(Math.round(parseFloat(form.min_increment) * 100)));
      fd.append("ends_at", new Date(form.ends_at).toISOString());
      if (fileRef.current?.files?.[0]) fd.append("image", fileRef.current.files[0]);
      await auctionsApi.create(fd);
      setShowCreate(false);
      setForm({ title: "", description: "", starting_bid: "", min_increment: "100", ends_at: "" });
      setImagePreview(null);
      await load("active");
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-h1 font-space-grotesk text-themed-primary">Leilões</h1>
          <p className="text-themed-muted mt-1">Faz a tua licitação e ganha. Processo transparente.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-accent-feed" />
            <span className="text-body-sm text-accent-feed font-medium">Provably Fair</span>
          </div>
          <Button className="bg-accent-bisno text-zinc-950 hover:brightness-110" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Criar Leilão
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-8">
        {(["activos", "meus", "historico"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-5 py-2 rounded-full text-body-sm font-medium transition-all",
              tab === t ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
            {t === "activos" ? "Activos" : t === "meus" ? "As Minhas Licitações" : "Histórico"}
          </button>
        ))}
      </div>

      {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>
      ) : tab === "activos" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {auctions.map(a => {
            const tl = timeLeft(a.ends_at);
            const isUrgent = new Date(a.ends_at).getTime() - Date.now() < 3600000;
            const minBid = (a.current_bid_centavos + a.min_increment_centavos) / 100;
            return (
              <div key={a.id} className={cn("glass-panel luminous-edge rounded-xl overflow-hidden transition-all hover:border-white/20",
                isUrgent && "border-accent-sos/30")}>
                {a.image_url && (
                  <img src={a.image_url} alt={a.title} className="w-full h-40 object-cover" />
                )}
                <div className={cn("px-5 py-3 flex items-center justify-between border-b border-white/5",
                  isUrgent ? "bg-accent-sos/10" : "bg-white/2")}>
                  <div className="flex items-center gap-2">
                    <Gavel className={cn("w-4 h-4", isUrgent ? "text-accent-sos" : "text-themed-muted")} />
                    <span className={cn("text-label-caps uppercase font-bold text-xs",
                      isUrgent ? "text-accent-sos" : "text-themed-muted")}>
                      {isUrgent ? "A terminar em breve" : "Leilão activo"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-themed-muted text-body-sm">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {a.total_bids}</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-h3 font-space-grotesk text-themed-primary mb-1">{a.title}</h3>
                  <p className="text-body-sm text-themed-muted mb-4 line-clamp-2">{a.description}</p>
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-label-caps text-themed-muted uppercase mb-1">Lance actual</p>
                      <p className="text-h2 font-space-grotesk text-themed-primary">{formatAOA(a.current_bid_centavos)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-label-caps text-themed-muted uppercase mb-1">Termina em</p>
                      <p className={cn("font-bold flex items-center gap-1", isUrgent ? "text-accent-sos" : "text-accent-gold")}>
                        <Clock className="w-4 h-4" /> {tl}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center glass-panel rounded-xl px-4 border border-white/10 focus-within:border-accent-bisno/50 transition-colors">
                      <span className="text-themed-muted text-body-sm mr-2">AOA</span>
                      <input
                        type="number"
                        value={bidAmounts[a.id] ?? minBid}
                        onChange={e => setBidAmounts(p => ({ ...p, [a.id]: Number(e.target.value) }))}
                        className="flex-1 bg-transparent outline-none text-themed-primary text-body-md py-3"
                        min={minBid} step={a.min_increment_centavos / 100}
                      />
                    </div>
                    <Button className="bg-accent-bisno text-zinc-950 hover:brightness-110 px-5"
                      onClick={() => placeBid(a.id)} disabled={bidding === a.id}>
                      {bidding === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronUp className="w-4 h-4 mr-1" />}
                      Licitar
                    </Button>
                  </div>
                  <p className="text-xs text-themed-muted mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Incremento mínimo: {formatAOA(a.min_increment_centavos)}
                  </p>
                </div>
              </div>
            );
          })}
          {auctions.length === 0 && (
            <div className="col-span-2 glass-panel rounded-xl p-8 text-center">
              <Gavel className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">Sem leilões activos. Cria o primeiro!</p>
            </div>
          )}
        </div>
      ) : tab === "meus" ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <Lock className="w-12 h-12 text-themed-muted mx-auto mb-4" />
          <h3 className="text-h3 font-space-grotesk text-themed-primary mb-2">Sem licitações activas</h3>
          <p className="text-themed-muted mb-6">As tuas licitações activas aparecerão aqui.</p>
          <Button onClick={() => setTab("activos")}>Ver Leilões</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {auctions.map(a => (
            <div key={a.id} className="glass-panel rounded-xl p-5 opacity-70">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-accent-feed" />
                <span className="text-label-caps text-accent-feed uppercase text-xs">Finalizado</span>
              </div>
              <h4 className="text-body-md font-bold text-themed-primary mb-1">{a.title}</h4>
              <p className="text-body-sm text-themed-muted">Lance final: {formatAOA(a.current_bid_centavos)}</p>
            </div>
          ))}
          {auctions.length === 0 && (
            <div className="col-span-2 glass-panel rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">Sem histórico ainda.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal criar leilão ────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-lg border border-white/10 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Criar Leilão</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>

            <div className="mb-4">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-2 block">Imagem</label>
              <div className="w-full h-32 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-bisno/50 transition-colors overflow-hidden"
                onClick={() => fileRef.current?.click()}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <><Upload className="w-6 h-6 text-themed-muted mb-2" /><span className="text-xs text-themed-muted">Clica para fazer upload</span></>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setImagePreview(URL.createObjectURL(f)); }} />
            </div>

            {[
              { key: "title", label: "Título", placeholder: "Ex: MacBook Pro M3" },
              { key: "description", label: "Descrição", placeholder: "Descreve o item..." },
              { key: "starting_bid", label: "Lance inicial (AOA)", placeholder: "10000", type: "number" },
              { key: "min_increment", label: "Incremento mínimo (AOA)", placeholder: "100", type: "number" },
              { key: "ends_at", label: "Data de encerramento", placeholder: "", type: "datetime-local" },
            ].map(({ key, label, placeholder, type = "text" }) => (
              <div key={key} className="mb-4">
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">{label}</label>
                {key === "description" ? (
                  <textarea value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50 resize-none h-20"
                    placeholder={placeholder} />
                ) : (
                  <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                    placeholder={placeholder} />
                )}
              </div>
            ))}

            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}
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

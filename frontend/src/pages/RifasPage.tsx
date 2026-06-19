import { useEffect, useState, useRef } from "react";
import {
  Ticket, Clock, Users, ShieldCheck, Star,
  Lock, CheckCircle, Plus, X, Loader2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rafflesApi, formatAOA, timeLeft, type Raffle } from "@/services/modules";
import { extractApiError } from "@/services/api";

function ProgressBar({ pct, color = "bg-accent-games" }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function RifasPage() {
  const [tab, setTab] = useState<"activas" | "minhas" | "historico">("activas");
  const [rifas, setRifas] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Create form
  const [form, setForm] = useState({
    title: "", description: "", ticket_price: "", max_tickets: "", ends_at: "",
  });

  async function load(status = "active") {
    setLoading(true);
    try {
      const data = await rafflesApi.list(status);
      setRifas(data);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "activas") load("active");
    else if (tab === "historico") load("finished");
    else load("all");
  }, [tab]);

  async function buyTicket(id: string) {
    setBuying(id); setError("");
    try {
      await rafflesApi.buyTicket(id);
      await load("active");
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setBuying(null);
    }
  }

  async function createRaffle() {
    setCreating(true); setError("");
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("ticket_price_centavos", String(Math.round(parseFloat(form.ticket_price) * 100)));
      fd.append("max_tickets", form.max_tickets);
      fd.append("ends_at", new Date(form.ends_at).toISOString());
      if (fileRef.current?.files?.[0]) fd.append("image", fileRef.current.files[0]);
      await rafflesApi.create(fd);
      setShowCreate(false);
      setForm({ title: "", description: "", ticket_price: "", max_tickets: "", ends_at: "" });
      setImagePreview(null);
      await load("active");
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setCreating(false);
    }
  }

  const featured = rifas[0];
  const rest = rifas.slice(1);

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-h1 font-space-grotesk text-themed-primary">Rifas</h1>
          <p className="text-themed-muted mt-1">Compra bilhetes e concorre a prémios. Sorteio verificável.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-accent-feed" />
            <span className="text-body-sm text-accent-feed font-medium">Provably Fair</span>
          </div>
          <Button className="bg-accent-games text-white hover:brightness-110" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Criar Rifa
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-8">
        {(["activas", "minhas", "historico"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-5 py-2 rounded-full text-body-sm font-medium transition-all",
              tab === t ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
            {t === "activas" ? "Activas" : t === "minhas" ? "Os Meus Bilhetes" : "Histórico"}
          </button>
        ))}
      </div>

      {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>
      ) : tab === "activas" ? (
        <>
          {/* Featured */}
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
                      <span className="text-label-caps text-accent-gold uppercase">Rifa em Destaque</span>
                    </div>
                    <h2 className="text-h2 font-space-grotesk text-themed-primary mb-2">{featured.title}</h2>
                    <p className="text-body-md text-themed-secondary mb-4 line-clamp-2">{featured.description}</p>
                    <div className="flex items-center gap-6 mb-4">
                      <div>
                        <p className="text-label-caps text-themed-muted uppercase">Bilhetes vendidos</p>
                        <p className="text-themed-primary font-bold">{featured.tickets_sold} / {featured.max_tickets}</p>
                      </div>
                      <div>
                        <p className="text-label-caps text-themed-muted uppercase">Termina em</p>
                        <p className="text-accent-gold font-bold flex items-center gap-1">
                          <Clock className="w-4 h-4" /> {timeLeft(featured.ends_at)}
                        </p>
                      </div>
                    </div>
                    <ProgressBar pct={featured.pct_sold} />
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-label-caps text-themed-muted uppercase">Por bilhete</p>
                    <p className="text-h2 font-space-grotesk text-themed-primary">{formatAOA(featured.ticket_price_centavos)}</p>
                    <Button
                      className="bg-gradient-to-r from-accent-games to-accent-gold text-zinc-950 font-bold px-8 hover:brightness-110"
                      onClick={() => buyTicket(featured.id)}
                      disabled={buying === featured.id}
                    >
                      {buying === featured.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ticket className="w-4 h-4 mr-2" />}
                      Comprar Bilhete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map(rifa => (
              <div key={rifa.id} className="glass-panel luminous-edge rounded-xl overflow-hidden hover:border-white/20 transition-all flex flex-col">
                {rifa.image_url ? (
                  <img src={rifa.image_url} alt={rifa.title} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-white/3 flex items-center justify-center border-b border-white/5">
                    <Ticket className="w-10 h-10 text-themed-muted" />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div>
                    <h4 className="text-body-md font-bold text-themed-primary mb-1">{rifa.title}</h4>
                    <p className="text-body-sm text-themed-muted line-clamp-2">{rifa.description}</p>
                  </div>
                  <div className="flex justify-between text-body-sm">
                    <span className="text-themed-muted flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {rifa.tickets_sold}/{rifa.max_tickets}
                    </span>
                    <span className="text-themed-muted flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {timeLeft(rifa.ends_at)}
                    </span>
                  </div>
                  <ProgressBar pct={rifa.pct_sold} />
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
                    <div>
                      <p className="text-label-caps text-themed-muted uppercase text-xs">Por bilhete</p>
                      <p className="text-themed-primary font-bold">{formatAOA(rifa.ticket_price_centavos)}</p>
                    </div>
                    <Button size="sm" variant="glass" className="border-accent-games/30 text-accent-games hover:bg-accent-games/10"
                      onClick={() => buyTicket(rifa.id)} disabled={buying === rifa.id}>
                      {buying === rifa.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5 mr-1" />}
                      Comprar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {rifas.length === 0 && (
            <div className="glass-panel rounded-xl p-8 text-center">
              <Ticket className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">Sem rifas activas. Cria a primeira!</p>
            </div>
          )}
        </>
      ) : tab === "minhas" ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <Lock className="w-12 h-12 text-themed-muted mx-auto mb-4" />
          <h3 className="text-h3 font-space-grotesk text-themed-primary mb-2">Os teus bilhetes</h3>
          <p className="text-themed-muted mb-6">Compra bilhetes nas rifas activas para os ver aqui.</p>
          <Button onClick={() => setTab("activas")}>Ver Rifas Activas</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rifas.map(rifa => (
            <div key={rifa.id} className="glass-panel rounded-xl p-5 opacity-70">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-accent-feed" />
                <span className="text-label-caps text-accent-feed uppercase text-xs">Sorteada</span>
              </div>
              <h4 className="text-body-md font-bold text-themed-primary mb-1">{rifa.title}</h4>
              {rifa.winning_ticket && (
                <p className="text-body-sm text-themed-muted">Bilhete vencedor: #{rifa.winning_ticket}</p>
              )}
            </div>
          ))}
          {rifas.length === 0 && (
            <div className="col-span-3 glass-panel rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">Sem histórico ainda.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal criar rifa ─────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-lg border border-white/10 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Criar Rifa</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>

            {/* Image upload */}
            <div className="mb-4">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-2 block">Imagem do prémio</label>
              <div
                className="w-full h-32 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-games/50 transition-colors overflow-hidden"
                onClick={() => fileRef.current?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-themed-muted mb-2" />
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

            {[
              { key: "title", label: "Título", placeholder: "Ex: iPhone 15 Pro Max" },
              { key: "description", label: "Descrição", placeholder: "Descreve o prémio..." },
              { key: "ticket_price", label: "Preço por bilhete (AOA)", placeholder: "500", type: "number" },
              { key: "max_tickets", label: "Nº máximo de bilhetes", placeholder: "1000", type: "number" },
              { key: "ends_at", label: "Data de encerramento", placeholder: "", type: "datetime-local" },
            ].map(({ key, label, placeholder, type = "text" }) => (
              <div key={key} className="mb-4">
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">{label}</label>
                {key === "description" ? (
                  <textarea
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-games/50 resize-none h-20"
                    placeholder={placeholder}
                  />
                ) : (
                  <input
                    type={type} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-games/50"
                    placeholder={placeholder}
                  />
                )}
              </div>
            ))}

            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}

            <Button className="w-full bg-accent-games text-white hover:brightness-110" onClick={createRaffle} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar Rifa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import {
  Search, MapPin, Navigation, Plus, Minus,
  Users, Zap, AlertTriangle, Calendar, User,
  Filter, ChevronRight, X, Upload, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { eventsApi, timeAgo, type MapEvent } from "@/services/modules";
import { extractApiError } from "@/services/api";

type PinType = "sos" | "bisno" | "evento" | "jogador" | "torneio" | "outro";
type FilterChip = "Todos" | "Eventos" | "Bisnos" | "SOS" | "Utilizadores";

const pinConfig: Record<string, { color: string; bg: string; border: string; icon: React.ElementType; pulse: string }> = {
  sos:     { color: "text-accent-sos",   bg: "bg-accent-sos",   border: "border-accent-sos/50",   icon: AlertTriangle, pulse: "bg-accent-sos"   },
  bisno:   { color: "text-accent-bisno", bg: "bg-accent-bisno", border: "border-accent-bisno/50", icon: Zap,           pulse: "bg-accent-bisno" },
  evento:  { color: "text-accent-games", bg: "bg-accent-games", border: "border-accent-games/50", icon: Calendar,      pulse: "bg-accent-games" },
  torneio: { color: "text-accent-games", bg: "bg-accent-games", border: "border-accent-games/50", icon: Calendar,      pulse: "bg-accent-games" },
  jogador: { color: "text-accent-feed",  bg: "bg-accent-feed",  border: "border-accent-feed/50",  icon: User,          pulse: "bg-accent-feed"  },
  outro:   { color: "text-zinc-400",     bg: "bg-zinc-600",     border: "border-zinc-500/50",     icon: MapPin,        pulse: "bg-zinc-500"     },
};

const filterChips: FilterChip[] = ["Todos", "Eventos", "Bisnos", "SOS", "Utilizadores"];
const filterCategoryMap: Partial<Record<FilterChip, string>> = {
  Eventos: "evento", Bisnos: "bisno", SOS: "sos", Utilizadores: "jogador",
};

// Pseudo-random position from event id (deterministic for stable rendering)
function pseudoPos(id: string, seed: number): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return `${15 + ((h ^ seed) & 0xff) % 70}%`;
}

export default function MapaPage() {
  const [activeFilter, setActiveFilter] = useState<FilterChip>("Todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(12);
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "evento",
    location_name: "", starts_at: "", ends_at: "",
  });

  async function load() {
    try {
      const cat = filterCategoryMap[activeFilter];
      const data = await eventsApi.list(cat ? { category: cat } : undefined);
      setEvents(data);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeFilter]);

  async function createEvent() {
    setCreating(true); setError("");
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("category", form.category);
      if (form.location_name) fd.append("location_name", form.location_name);
      if (form.starts_at) fd.append("starts_at", new Date(form.starts_at).toISOString());
      if (form.ends_at) fd.append("ends_at", new Date(form.ends_at).toISOString());
      if (fileRef.current?.files?.[0]) fd.append("image", fileRef.current.files[0]);
      await eventsApi.create(fd);
      setShowCreate(false);
      setForm({ title: "", description: "", category: "evento", location_name: "", starts_at: "", ends_at: "" });
      setImagePreview(null);
      await load();
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setCreating(false);
    }
  }

  const filtered = events.filter(e =>
    search === "" ||
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.location_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selected = events.find(e => e.id === selectedId);

  return (
    <div className="py-6 flex flex-col gap-4" style={{ height: "calc(100vh - 80px - 48px)" }}>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        {[
          { icon: Users,    label: `${events.filter(e => e.category === "jogador").length} jogadores`, color: "text-accent-feed",  bg: "bg-accent-feed/10"  },
          { icon: Calendar, label: `${events.filter(e => e.category === "evento").length} eventos`,    color: "text-accent-games", bg: "bg-accent-games/10" },
          { icon: Zap,      label: `${events.filter(e => e.category === "bisno").length} bisnos`,      color: "text-accent-bisno", bg: "bg-accent-bisno/10" },
        ].map(({ icon: Icon, label, color, bg }) => (
          <div key={label} className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border border-white/5">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", bg)}>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <span className={cn("text-body-sm font-semibold", color)}>{label}</span>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex gap-0 overflow-hidden rounded-xl flex-1 min-h-0">

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 glass-panel border-r border-white/10 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted w-4 h-4" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none text-themed-primary placeholder:text-themed-muted"
                placeholder="Pesquisar..." />
            </div>
          </div>

          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-themed-muted" />
              <span className="text-body-sm font-semibold text-themed-primary">Filtrar</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filterChips.map(chip => (
                <button key={chip} onClick={() => setActiveFilter(chip)}
                  className={cn("px-3 py-1 rounded-full text-xs font-medium transition-all",
                    activeFilter === chip ? "bg-white/15 text-themed-primary border border-white/20" : "bg-white/5 text-themed-muted hover:text-themed-secondary border border-white/5")}>
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-label-caps text-themed-muted uppercase tracking-widest text-xs">Eventos</p>
              <button onClick={() => setShowCreate(true)}
                className="w-6 h-6 rounded-full bg-accent-games/20 text-accent-games flex items-center justify-center hover:bg-accent-games/30 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-themed-muted" /></div>
            ) : filtered.map(ev => {
              const cfg = pinConfig[ev.category] ?? pinConfig.outro;
              const Icon = cfg.icon;
              return (
                <button key={ev.id} onClick={() => setSelectedId(selectedId === ev.id ? null : ev.id)}
                  className={cn("w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                    selectedId === ev.id ? "bg-white/10 border border-white/15" : "hover:bg-white/5")}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border", cfg.border, cfg.bg + "/20")}>
                    <Icon className={cn("w-4 h-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-themed-primary truncate">{ev.title}</p>
                    <p className="text-xs text-themed-muted">{ev.location_name ?? timeAgo(ev.created_at)}</p>
                  </div>
                  {ev.distance_km && (
                    <span className="text-xs text-themed-muted flex-shrink-0">{ev.distance_km} km</span>
                  )}
                </button>
              );
            })}
            {!loading && filtered.length === 0 && (
              <p className="text-themed-muted text-xs text-center py-8">Sem eventos. Cria o primeiro!</p>
            )}
          </div>
        </div>

        {/* Map canvas */}
        <div className="flex-1 relative overflow-hidden" style={{ background: "#0a0a0a" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
          <div className="absolute inset-0 pointer-events-none opacity-20"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
            <line x1="0" y1="40%" x2="100%" y2="38%" stroke="#444" strokeWidth="2" />
            <line x1="0" y1="65%" x2="100%" y2="62%" stroke="#444" strokeWidth="1.5" />
            <line x1="30%" y1="0" x2="32%" y2="100%" stroke="#444" strokeWidth="2" />
            <line x1="60%" y1="0" x2="58%" y2="100%" stroke="#444" strokeWidth="1.5" />
          </svg>

          {/* Event pins */}
          {filtered.map((ev, i) => {
            const cfg = pinConfig[ev.category] ?? pinConfig.outro;
            const Icon = cfg.icon;
            const top = pseudoPos(ev.id, 7);
            const left = pseudoPos(ev.id, 13);
            const isSelected = selectedId === ev.id;
            return (
              <button key={ev.id} onClick={() => setSelectedId(isSelected ? null : ev.id)}
                className="absolute flex flex-col items-center gap-1 group"
                style={{ top, left, transform: "translate(-50%, -100%)" }}>
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full glass-panel border whitespace-nowrap transition-all",
                  cfg.color, cfg.border, isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                  {ev.title}
                </span>
                <div className="relative">
                  <span className={cn("absolute inset-0 rounded-full animate-ping opacity-40", cfg.pulse)}
                    style={{ animationDuration: "2s" }} />
                  <div className={cn("relative w-9 h-9 rounded-full flex items-center justify-center border-2 shadow-lg transition-transform",
                    cfg.bg, cfg.border, isSelected ? "scale-125" : "group-hover:scale-110")}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
              </button>
            );
          })}

          {/* My location */}
          <div className="absolute" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-accent-bisno animate-ping opacity-30" />
              <div className="relative w-4 h-4 rounded-full bg-accent-bisno border-2 border-white shadow-lg" />
            </div>
          </div>

          {/* Selected event detail */}
          {selected && (
            <div className="absolute bottom-16 left-4 right-20 glass-panel rounded-xl p-4 border border-white/10">
              <div className="flex items-start gap-3">
                {selected.image_url && (
                  <img src={selected.image_url} alt={selected.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-bold text-themed-primary truncate">{selected.title}</p>
                  <p className="text-xs text-themed-muted line-clamp-2">{selected.description}</p>
                  {selected.location_name && (
                    <p className="text-xs text-themed-muted flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {selected.location_name}
                    </p>
                  )}
                </div>
                <button onClick={() => setSelectedId(null)} className="text-themed-muted hover:text-themed-primary flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Button size="sm" className="w-full mt-3 bg-accent-games/20 text-accent-games border border-accent-games/30 hover:bg-accent-games/30"
                onClick={() => eventsApi.attend(selected.id).then(load)}>
                Confirmar Presença ({selected.attendees_count})
              </Button>
            </div>
          )}

          {/* Bottom bar */}
          <div className="absolute bottom-4 left-4 right-20 glass-panel rounded-full px-4 py-2.5 flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-feed opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-feed" />
            </span>
            <Users className="w-4 h-4 text-themed-muted" />
            <span className="text-body-sm text-themed-secondary">
              <span className="text-accent-feed font-bold">{events.length}</span> eventos no mapa
            </span>
            <ChevronRight className="w-4 h-4 text-themed-muted ml-auto" />
          </div>

          {/* Zoom */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1">
            <button onClick={() => setZoom(z => Math.min(z + 1, 20))}
              className="w-10 h-10 glass-panel rounded-lg flex items-center justify-center text-themed-secondary hover:text-themed-primary hover:bg-white/10 transition-all border border-white/10">
              <Plus className="w-4 h-4" />
            </button>
            <div className="text-center text-xs text-themed-muted py-0.5">{zoom}</div>
            <button onClick={() => setZoom(z => Math.max(z - 1, 1))}
              className="w-10 h-10 glass-panel rounded-lg flex items-center justify-center text-themed-secondary hover:text-themed-primary hover:bg-white/10 transition-all border border-white/10">
              <Minus className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute top-4 right-4">
            <button className="glass-panel px-4 py-2 rounded-full text-body-sm text-themed-secondary hover:text-themed-primary transition-all border border-white/10 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-accent-bisno" /> Centrar
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal criar evento ────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-lg border border-white/10 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Criar Evento</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>

            <div className="mb-4">
              <div className="w-full h-28 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-games/50 transition-colors overflow-hidden"
                onClick={() => fileRef.current?.click()}>
                {imagePreview ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" /> :
                  <><Upload className="w-5 h-5 text-themed-muted mb-1" /><span className="text-xs text-themed-muted">Imagem (opcional)</span></>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setImagePreview(URL.createObjectURL(f)); }} />
            </div>

            {[
              { key: "title", label: "Título", placeholder: "Nome do evento" },
              { key: "description", label: "Descrição", placeholder: "Descreve o evento..." },
              { key: "location_name", label: "Localização", placeholder: "Ex: Talatona, Luanda" },
              { key: "starts_at", label: "Início", type: "datetime-local" },
              { key: "ends_at", label: "Fim", type: "datetime-local" },
            ].map(({ key, label, placeholder = "", type = "text" }) => (
              <div key={key} className="mb-3">
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">{label}</label>
                {key === "description" ? (
                  <textarea value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-games/50 resize-none h-16"
                    placeholder={placeholder} />
                ) : (
                  <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-games/50"
                    placeholder={placeholder} />
                )}
              </div>
            ))}

            <div className="mb-4">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-games/50 bg-transparent">
                {["evento", "bisno", "torneio", "outro"].map(c => (
                  <option key={c} value={c} className="bg-zinc-900">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}
            <Button className="w-full bg-accent-games text-white hover:brightness-110" onClick={createEvent} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar Evento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle, Clock, Car, Flame, ShieldAlert,
  Heart, Baby, HelpCircle, UserCheck, MapPin, Search, Package,
  PawPrint, Users, Plus, Share2, ChevronRight, UserX, X,
  Upload, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  sosApi, timeAgo,
  type SOSAlert, type MissingPerson, type LostFound, type Campaign,
} from "@/services/modules";
import { extractApiError } from "@/services/api";

type SOSTab = "alertas" | "desaparecidos" | "achados" | "campanhas";

const emergencyCategories = [
  { icon: Car,         label: "Acidente",          value: "acidente",          color: "text-accent-sos",   bg: "bg-accent-sos/10"   },
  { icon: Flame,       label: "Incêndio",          value: "incendio",          color: "text-accent-gold",  bg: "bg-accent-gold/10"  },
  { icon: ShieldAlert, label: "Assalto",           value: "assalto",           color: "text-accent-sos",   bg: "bg-accent-sos/10"   },
  { icon: Heart,       label: "Emergência Médica", value: "emergencia_medica", color: "text-red-400",      bg: "bg-red-400/10"      },
  { icon: Baby,        label: "Criança Perdida",   value: "crianca_perdida",   color: "text-accent-bisno", bg: "bg-accent-bisno/10" },
  { icon: HelpCircle,  label: "Outro",             value: "outro",             color: "text-zinc-400",     bg: "bg-white/5"         },
];

const contacts = [
  { label: "Polícia",   number: "113", icon: ShieldAlert, color: "text-accent-bisno" },
  { label: "Bombeiros", number: "115", icon: Flame,       color: "text-accent-gold"  },
  { label: "SAMU",      number: "112", icon: Heart,       color: "text-red-400"      },
];

const tabs: { id: SOSTab; label: string; icon: React.ElementType; }[] = [
  { id: "alertas",       label: "Alertas",           icon: AlertTriangle },
  { id: "desaparecidos", label: "Desaparecidos",      icon: UserX         },
  { id: "achados",       label: "Achados e Perdidos", icon: Package       },
  { id: "campanhas",     label: "Campanhas",          icon: Heart         },
];

export default function SOSPage() {
  const [sosActive,   setSosActive]   = useState(false);
  const [activeTab,   setActiveTab]   = useState<SOSTab>("alertas");
  const [searchQuery, setSearchQuery] = useState("");
  const [error,       setError]       = useState("");

  // Data
  const [alerts,    setAlerts]    = useState<SOSAlert[]>([]);
  const [missing,   setMissing]   = useState<MissingPerson[]>([]);
  const [lostFound, setLostFound] = useState<LostFound[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading,   setLoading]   = useState(false);

  // Modals
  const [showAlertModal,   setShowAlertModal]   = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [showLostModal,    setShowLostModal]    = useState(false);
  const [submitting,       setSubmitting]       = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Alert form
  const [alertForm, setAlertForm] = useState({ category: "acidente", description: "", location_name: "" });

  // Missing form
  const [missingForm, setMissingForm] = useState({
    name: "", age: "", person_type: "pessoa", description: "",
    last_seen_location: "", is_urgent: false,
  });

  // Lost/found form
  const [lostForm, setLostForm] = useState({
    item_type: "perdido", title: "", description: "", location: "", contact_info: "",
  });

  async function loadTab(tab: SOSTab) {
    setLoading(true); setError("");
    try {
      if (tab === "alertas")       setAlerts(await sosApi.alerts.list());
      if (tab === "desaparecidos") setMissing(await sosApi.missing.list());
      if (tab === "achados")       setLostFound(await sosApi.lostFound.list());
      if (tab === "campanhas")     setCampaigns(await sosApi.campaigns.list());
    } catch (e) { setError(extractApiError(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTab(activeTab); }, [activeTab]);

  async function sendAlert(category: string) {
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("category", category);
      if (alertForm.description) fd.append("description", alertForm.description);
      if (alertForm.location_name) fd.append("location_name", alertForm.location_name);
      await sosApi.alerts.create(fd);
      setSosActive(true);
      setShowAlertModal(false);
      await loadTab("alertas");
    } catch (e) { setError(extractApiError(e)); }
    finally { setSubmitting(false); }
  }

  async function reportMissing() {
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("name", missingForm.name);
      fd.append("description", missingForm.description);
      fd.append("person_type", missingForm.person_type);
      if (missingForm.age) fd.append("age", missingForm.age);
      if (missingForm.last_seen_location) fd.append("last_seen_location", missingForm.last_seen_location);
      fd.append("is_urgent", String(missingForm.is_urgent));
      if (photoRef.current?.files?.[0]) fd.append("photo", photoRef.current.files[0]);
      await sosApi.missing.create(fd);
      setShowMissingModal(false);
      setPhotoPreview(null);
      await loadTab("desaparecidos");
    } catch (e) { setError(extractApiError(e)); }
    finally { setSubmitting(false); }
  }

  async function reportLostFound() {
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("item_type", lostForm.item_type);
      fd.append("title", lostForm.title);
      fd.append("description", lostForm.description);
      if (lostForm.location) fd.append("location", lostForm.location);
      if (lostForm.contact_info) fd.append("contact_info", lostForm.contact_info);
      if (photoRef.current?.files?.[0]) fd.append("photo", photoRef.current.files[0]);
      await sosApi.lostFound.create(fd);
      setShowLostModal(false);
      setPhotoPreview(null);
      await loadTab("achados");
    } catch (e) { setError(extractApiError(e)); }
    finally { setSubmitting(false); }
  }

  const filteredMissing = missing.filter(p =>
    searchQuery === "" ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.last_seen_location ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-h1 font-space-grotesk text-themed-primary flex items-center gap-3">
            <AlertTriangle className="w-9 h-9 text-accent-sos" />
            Painel SOS
          </h1>
          <p className="text-themed-muted mt-1">Comunidade e Ajuda em Tempo Real</p>
        </div>
        {alerts.filter(a => a.status === "active").length > 0 && (
          <span className="flex items-center gap-2 text-body-sm text-accent-sos bg-accent-sos/10 px-3 py-1.5 rounded-full border border-accent-sos/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-sos opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-sos" />
            </span>
            {alerts.filter(a => a.status === "active").length} alertas activos
          </span>
        )}
      </div>

      {/* SOS Button */}
      <div className="glass-panel luminous-edge rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6">
        <button
          onClick={() => setShowAlertModal(true)}
          className={cn(
            "relative w-28 h-28 rounded-full font-space-grotesk font-black text-2xl text-white flex-shrink-0",
            "transition-all duration-300 active:scale-95 select-none border-4",
            sosActive
              ? "bg-gradient-to-br from-red-700 to-accent-sos border-red-400"
              : "bg-gradient-to-br from-red-600 to-accent-sos border-accent-sos/60 hover:brightness-110",
          )}
        >
          {sosActive && <span className="absolute inset-0 rounded-full bg-accent-sos animate-ping opacity-20" />}
          <span className="relative">SOS</span>
        </button>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-h3 font-space-grotesk text-themed-primary mb-1">
            {sosActive ? "Alerta enviado!" : "Emergência?"}
          </h3>
          <p className="text-themed-secondary text-body-sm mb-4">
            {sosActive
              ? "A tua localização foi partilhada. Ajuda a caminho."
              : "Pressiona o botão para enviar um alerta de emergência."}
          </p>
          {sosActive ? (
            <button onClick={() => setSosActive(false)} className="text-xs text-themed-muted hover:text-accent-sos underline">
              Cancelar alerta
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {emergencyCategories.slice(0, 4).map(({ icon: Icon, label, value, color, bg }) => (
                <button key={value} onClick={() => sendAlert(value)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:brightness-110", color, bg, "border-current/20")}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {contacts.map(({ label, number, icon: Icon, color }) => (
            <a key={label} href={`tel:${number}`}
              className="flex items-center gap-2 glass-panel px-3 py-2 rounded-lg hover:bg-white/5 transition-all">
              <Icon className={cn("w-4 h-4", color)} />
              <span className="text-themed-primary font-bold text-sm">{number}</span>
              <span className="text-themed-muted text-xs">{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-6 flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-full text-body-sm font-medium transition-all",
              activeTab === id ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}
      {loading && <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-themed-muted" /></div>}

      {/* Alertas */}
      {!loading && activeTab === "alertas" && (
        <div className="flex flex-col gap-4">
          <div className="glass-panel luminous-edge rounded-xl overflow-hidden">
            {alerts.length === 0 && (
              <p className="text-themed-muted text-center py-8">Sem alertas activos.</p>
            )}
            {alerts.map((alert, i) => (
              <div key={alert.id} className={cn(
                "flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/3",
                i < alerts.length - 1 && "border-b border-white/5",
              )}>
                <AlertTriangle className={cn("w-5 h-5 flex-shrink-0",
                  alert.status === "active" ? "text-accent-sos" : "text-zinc-600")} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-semibold text-themed-primary capitalize">{alert.category.replace("_", " ")}</p>
                  {alert.description && <p className="text-xs text-themed-muted mt-0.5">{alert.description}</p>}
                  {alert.location_name && (
                    <p className="text-xs text-themed-muted flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {alert.location_name}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                    alert.status === "active" ? "text-accent-sos bg-accent-sos/10" : "text-accent-feed bg-accent-feed/10")}>
                    {alert.status === "active" ? "Activo" : "Resolvido"}
                  </span>
                  <span className="text-xs text-themed-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {timeAgo(alert.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Volunteer */}
          <div className="glass-panel luminous-edge rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4 border border-accent-feed/10">
            <div className="w-12 h-12 rounded-full bg-accent-feed/10 flex items-center justify-center flex-shrink-0 border border-accent-feed/20">
              <UserCheck className="w-6 h-6 text-accent-feed" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-body-md font-bold text-themed-primary">Torna-te Voluntário</h3>
              <p className="text-body-sm text-themed-muted mt-0.5">Ajuda a comunidade respondendo a alertas perto de ti.</p>
            </div>
            <Button className="flex-shrink-0 bg-accent-feed text-surface hover:brightness-110">
              Voluntariar-me
            </Button>
          </div>
        </div>
      )}

      {/* Desaparecidos */}
      {!loading && activeTab === "desaparecidos" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted w-4 h-4" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-body-sm text-themed-primary outline-none"
                placeholder="Pesquisar por nome ou localização..." />
            </div>
            <Button className="bg-accent-sos text-white hover:brightness-110 flex-shrink-0"
              onClick={() => { setShowMissingModal(true); setPhotoPreview(null); }}>
              <Plus className="w-4 h-4 mr-2" /> Reportar Desaparecido
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredMissing.map(person => (
              <div key={person.id} className={cn(
                "glass-panel luminous-edge rounded-xl overflow-hidden transition-all hover:border-white/20",
                person.is_urgent && person.status === "active" && "border-accent-sos/30",
                person.status !== "active" && "opacity-60",
              )}>
                <div className={cn("px-4 py-2.5 flex items-center justify-between border-b border-white/5",
                  person.is_urgent && person.status === "active" ? "bg-accent-sos/10" : "bg-white/2")}>
                  <div className="flex items-center gap-2">
                    {person.person_type === "animal"
                      ? <PawPrint className="w-4 h-4 text-accent-feed" />
                      : <UserX className="w-4 h-4 text-accent-sos" />}
                    <span className={cn("text-label-caps uppercase font-bold text-xs",
                      person.status !== "active" ? "text-accent-feed" : "text-accent-sos")}>
                      {person.status !== "active" ? "Encontrado" : person.is_urgent ? "Urgente" : "Desaparecido"}
                    </span>
                  </div>
                  <button className="text-themed-muted hover:text-themed-primary">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {person.photo_url ? (
                      <img src={person.photo_url} alt={person.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                        {person.person_type === "animal"
                          ? <PawPrint className="w-6 h-6 text-accent-feed" />
                          : <Users className="w-6 h-6 text-zinc-500" />}
                      </div>
                    )}
                    <div>
                      <h4 className="text-body-md font-bold text-themed-primary">{person.name}</h4>
                      {person.age && <p className="text-xs text-themed-muted">{person.age} anos</p>}
                    </div>
                  </div>
                  <p className="text-body-sm text-themed-secondary mb-3 line-clamp-2">{person.description}</p>
                  {person.last_seen_location && (
                    <p className="text-xs text-themed-muted flex items-center gap-1 mb-3">
                      <MapPin className="w-3 h-3" /> {person.last_seen_location}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="glass" className="flex-1 text-xs">Ver Detalhes</Button>
                    {person.status === "active" && (
                      <Button size="sm" className="flex-1 text-xs bg-accent-sos/10 text-accent-sos border border-accent-sos/20 hover:bg-accent-sos/20"
                        onClick={() => sosApi.missing.markFound(person.id).then(() => loadTab("desaparecidos"))}>
                        Encontrado
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredMissing.length === 0 && (
              <div className="col-span-2 glass-panel rounded-xl p-8 text-center">
                <UserX className="w-12 h-12 text-themed-muted mx-auto mb-4" />
                <p className="text-themed-muted">Sem registos de desaparecidos.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Achados e Perdidos */}
      {!loading && activeTab === "achados" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted w-4 h-4" />
              <input className="w-full glass-panel border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-body-sm text-themed-primary outline-none"
                placeholder="Pesquisar achados e perdidos..." />
            </div>
            <Button className="bg-accent-bisno text-surface hover:brightness-110 flex-shrink-0"
              onClick={() => { setShowLostModal(true); setPhotoPreview(null); }}>
              <Plus className="w-4 h-4 mr-2" /> Publicar
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {lostFound.map(item => (
              <div key={item.id} className={cn(
                "glass-panel luminous-edge rounded-xl p-4 flex items-start gap-4 transition-all hover:border-white/20",
                item.item_type === "achado" ? "border-l-2 border-l-accent-feed" : "border-l-2 border-l-accent-gold",
              )}>
                {item.photo_url ? (
                  <img src={item.photo_url} alt={item.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    item.item_type === "achado" ? "bg-accent-feed/10" : "bg-accent-gold/10")}>
                    <Package className={cn("w-5 h-5", item.item_type === "achado" ? "text-accent-feed" : "text-accent-gold")} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-label-caps uppercase text-xs font-bold",
                      item.item_type === "achado" ? "text-accent-feed" : "text-accent-gold")}>
                      {item.item_type === "achado" ? "Achado" : "Perdido"}
                    </span>
                    <span className="text-xs text-themed-muted">{timeAgo(item.created_at)}</span>
                  </div>
                  <h4 className="text-body-sm font-bold text-themed-primary mb-1">{item.title}</h4>
                  <p className="text-xs text-themed-secondary mb-2">{item.description}</p>
                  {item.location && (
                    <p className="text-xs text-themed-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {item.location}
                    </p>
                  )}
                </div>
                {item.contact_info && (
                  <Button size="sm" variant="glass" className="flex-shrink-0 text-xs">
                    Contactar <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
            ))}
            {lostFound.length === 0 && (
              <div className="glass-panel rounded-xl p-8 text-center">
                <Package className="w-12 h-12 text-themed-muted mx-auto mb-4" />
                <p className="text-themed-muted">Sem publicações ainda.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Campanhas */}
      {!loading && activeTab === "campanhas" && (
        <div className="flex flex-col gap-4">
          {campaigns.map(c => (
            <div key={c.id} className="glass-panel luminous-edge rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-accent-feed/10 flex items-center justify-center border border-accent-feed/20">
                    <Heart className="w-6 h-6 text-accent-feed" />
                  </div>
                )}
                <div>
                  <span className="text-label-caps text-accent-feed uppercase text-xs">Campanha Activa</span>
                  <h3 className="text-body-md font-bold text-themed-primary">{c.title}</h3>
                </div>
              </div>
              <p className="text-body-sm text-themed-secondary mb-4">{c.description}</p>
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-themed-secondary">Meta: {(c.goal_centavos / 100).toLocaleString("pt-AO")} AOA</span>
                  <span className="text-accent-feed font-bold">{c.pct}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent-feed to-emerald-400 rounded-full" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                </div>
              </div>
              <Button className="w-full bg-accent-feed text-surface hover:brightness-110">
                <Heart className="w-4 h-4 mr-2" /> Doar Agora
              </Button>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="glass-panel rounded-xl p-8 text-center">
              <Heart className="w-12 h-12 text-themed-muted mx-auto mb-4" />
              <p className="text-themed-muted">Sem campanhas activas.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Alerta ─────────────────────────────────────── */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Enviar Alerta</h3>
              <button onClick={() => setShowAlertModal(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {emergencyCategories.map(({ icon: Icon, label, value, color, bg }) => (
                <button key={value} onClick={() => setAlertForm(f => ({ ...f, category: value }))}
                  className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                    alertForm.category === value ? "border-white/30 bg-white/10" : "border-white/5 hover:border-white/15", color, bg)}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Localização</label>
              <input value={alertForm.location_name} onChange={e => setAlertForm(f => ({ ...f, location_name: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-sos/50"
                placeholder="Ex: Av. 4 de Fevereiro, Luanda" />
            </div>
            <div className="mb-5">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Descrição (opcional)</label>
              <textarea value={alertForm.description} onChange={e => setAlertForm(f => ({ ...f, description: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-sos/50 resize-none h-20"
                placeholder="Descreve a situação..." />
            </div>
            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}
            <Button className="w-full bg-accent-sos text-white hover:brightness-110"
              onClick={() => sendAlert(alertForm.category)} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Enviar Alerta
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal Desaparecido ────────────────────────────────── */}
      {showMissingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-md border border-white/10 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Reportar Desaparecido</h3>
              <button onClick={() => setShowMissingModal(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            <div className="mb-4">
              <div className="w-full h-28 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-sos/50 transition-colors overflow-hidden"
                onClick={() => photoRef.current?.click()}>
                {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> :
                  <><Upload className="w-5 h-5 text-themed-muted mb-1" /><span className="text-xs text-themed-muted">Foto (opcional)</span></>}
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setPhotoPreview(URL.createObjectURL(f)); }} />
            </div>
            {[
              { key: "name", label: "Nome", placeholder: "Nome completo" },
              { key: "age", label: "Idade", placeholder: "Ex: 25", type: "number" },
              { key: "description", label: "Descrição", placeholder: "Aparência, roupa, etc." },
              { key: "last_seen_location", label: "Último local visto", placeholder: "Ex: Mercado do Kinaxixi" },
            ].map(({ key, label, placeholder, type = "text" }) => (
              <div key={key} className="mb-3">
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">{label}</label>
                {key === "description" ? (
                  <textarea value={(missingForm as any)[key]} onChange={e => setMissingForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-sos/50 resize-none h-16"
                    placeholder={placeholder} />
                ) : (
                  <input type={type} value={(missingForm as any)[key]} onChange={e => setMissingForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-sos/50"
                    placeholder={placeholder} />
                )}
              </div>
            ))}
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Tipo</label>
              <select value={missingForm.person_type} onChange={e => setMissingForm(f => ({ ...f, person_type: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none bg-transparent">
                <option value="pessoa" className="bg-zinc-900">Pessoa</option>
                <option value="animal" className="bg-zinc-900">Animal</option>
              </select>
            </div>
            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <input type="checkbox" checked={missingForm.is_urgent}
                onChange={e => setMissingForm(f => ({ ...f, is_urgent: e.target.checked }))}
                className="w-4 h-4 accent-accent-sos" />
              <span className="text-body-sm text-themed-secondary">Marcar como urgente</span>
            </label>
            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}
            <Button className="w-full bg-accent-sos text-white hover:brightness-110" onClick={reportMissing} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Reportar
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal Achado/Perdido ──────────────────────────────── */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-md border border-white/10 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Publicar Achado/Perdido</h3>
              <button onClick={() => setShowLostModal(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            <div className="mb-4">
              <div className="w-full h-24 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-bisno/50 transition-colors overflow-hidden"
                onClick={() => photoRef.current?.click()}>
                {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> :
                  <><Upload className="w-5 h-5 text-themed-muted mb-1" /><span className="text-xs text-themed-muted">Foto (opcional)</span></>}
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setPhotoPreview(URL.createObjectURL(f)); }} />
            </div>
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Tipo</label>
              <div className="flex gap-2">
                {["perdido", "achado"].map(t => (
                  <button key={t} onClick={() => setLostForm(f => ({ ...f, item_type: t }))}
                    className={cn("flex-1 py-2 rounded-xl text-sm font-bold border transition-all",
                      lostForm.item_type === t ? "bg-white/10 border-white/30 text-themed-primary" : "border-white/5 text-themed-muted hover:border-white/15")}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {[
              { key: "title", label: "Título", placeholder: "Ex: Carteira preta encontrada" },
              { key: "description", label: "Descrição", placeholder: "Descreve o item..." },
              { key: "location", label: "Localização", placeholder: "Onde foi achado/perdido" },
              { key: "contact_info", label: "Contacto", placeholder: "+244 9XX XXX XXX" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="mb-3">
                <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">{label}</label>
                {key === "description" ? (
                  <textarea value={(lostForm as any)[key]} onChange={e => setLostForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50 resize-none h-16"
                    placeholder={placeholder} />
                ) : (
                  <input value={(lostForm as any)[key]} onChange={e => setLostForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-bisno/50"
                    placeholder={placeholder} />
                )}
              </div>
            ))}
            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}
            <Button className="w-full bg-accent-bisno text-surface hover:brightness-110" onClick={reportLostFound} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Publicar
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

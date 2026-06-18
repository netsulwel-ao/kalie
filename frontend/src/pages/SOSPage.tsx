import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Clock, Car, Flame, ShieldAlert,
  Heart, Baby, HelpCircle, UserCheck, MapPin, Search, Package,
  PawPrint, Users, Plus, Share2, ChevronRight, UserX, X,
  Upload, Loader2, Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  sosApi, timeAgo,
  type SOSAlert, type MissingPerson, type LostFound, type Campaign,
} from "@/services/modules";
import { extractApiError } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

type SOSTab = "alertas" | "desaparecidos" | "achados" | "campanhas";

const emergencyCategories = [
  { icon: Car,         label: "Acidente",          value: "acidente",          color: "text-accent-sos",   bg: "bg-accent-sos/10"   },
  { icon: Flame,       label: "Incêndio",          value: "incendio",          color: "text-accent-gold",  bg: "bg-accent-gold/10"  },
  { icon: ShieldAlert, label: "Assalto",           value: "assalto",           color: "text-accent-sos",   bg: "bg-accent-sos/10"   },
  { icon: Heart,       label: "Emergência Médica", value: "emergencia_medica", color: "text-red-400",      bg: "bg-red-400/10"      },
  { icon: Baby,        label: "Criança Perdida",   value: "crianca_perdida",   color: "text-accent-bisno", bg: "bg-accent-bisno/10" },
  { icon: HelpCircle,  label: "Outro",             value: "outro",             color: "text-zinc-400",     bg: "bg-white/5"         },
];

const categoryContact: Record<string, { label: string; number: string }> = {
  acidente:          { label: "CISP", number: "111" },
  incendio:          { label: "CISP", number: "111" },
  assalto:           { label: "CISP", number: "111" },
  emergencia_medica: { label: "CISP", number: "111" },
  crianca_perdida:   { label: "CISP", number: "111" },
  outro:             { label: "CISP", number: "111" },
};

const contacts = [
  { label: "CISP", number: "111", icon: ShieldAlert, color: "text-accent-sos" },
];

const tabs: { id: SOSTab; label: string; icon: React.ElementType; }[] = [
  { id: "alertas",       label: "Alertas",           icon: AlertTriangle },
  { id: "desaparecidos", label: "Desaparecidos",      icon: UserX         },
  { id: "achados",       label: "Achados e Perdidos", icon: Package       },
  { id: "campanhas",     label: "Campanhas",          icon: Heart         },
];

export default function SOSPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPerson,   setSelectedPerson]   = useState<MissingPerson | null>(null);
  const [missingFilter,    setMissingFilter]    = useState<string>("active");
  const [lostSearchQuery,  setLostSearchQuery]  = useState("");
  const [lostFilter,       setLostFilter]       = useState<string>("all");
  const [showLostDetails,  setShowLostDetails]  = useState(false);
  const [selectedLostItem,   setSelectedLostItem]   = useState<LostFound | null>(null);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");
  const [showCampaignDetails, setShowCampaignDetails] = useState(false);
  const [selectedCampaign,   setSelectedCampaign]    = useState<Campaign | null>(null);
  const [alertsFilter, setAlertsFilter] = useState<string>("active");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const [campaignTab,        setCampaignTab]         = useState<"all" | "mine">("all");
  const [showCampaignModal,  setShowCampaignModal]   = useState(false);
  const [campaignForm,       setCampaignForm]        = useState({
    title: "", description: "", goal_centavos: "", ends_at: "",
  });
  const [submitting,         setSubmitting]          = useState(false);

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
      if (tab === "alertas") {
        const userId = alertsFilter === "mine" ? user?.id : undefined;
        const status = alertsFilter === "mine" ? "all" : alertsFilter;
        setAlerts(await sosApi.alerts.list(status, userId));
      }
      if (tab === "desaparecidos") setMissing(await sosApi.missing.list(missingFilter));
      if (tab === "achados")       setLostFound(await sosApi.lostFound.list());
      if (tab === "campanhas")     setCampaigns(await sosApi.campaigns.list(campaignTab === "mine" ? user?.id : undefined));
    } catch (e) { setError(extractApiError(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTab(activeTab); }, [activeTab, missingFilter, campaignTab, alertsFilter]);

  function startCountdown(category: string) {
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current);
          setCountdown(null);
          executeSendAlert(category);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function executeSendAlert(category: string) {
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("category", category);
      if (alertForm.description) fd.append("description", alertForm.description);
      if (alertForm.location_name) fd.append("location_name", alertForm.location_name);
      if (coords) {
        fd.append("latitude", String(coords.lat));
        fd.append("longitude", String(coords.lng));
      }
      await sosApi.alerts.create(fd);
      setSosActive(true);
      setShowAlertModal(false);
      await loadTab("alertas");
    } catch (e) { setError(extractApiError(e)); }
    finally { setSubmitting(false); }
  }

  function getLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // silent fail
      );
    }
  }

  function shareAlert(alert: SOSAlert) {
    const text = `🚨 Alerta SOS - ${alert.category.replace("_", " ")}${alert.location_name ? ` em ${alert.location_name}` : ""}${alert.description ? `: ${alert.description}` : ""}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
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

  async function createCampaign() {
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("title", campaignForm.title);
      fd.append("description", campaignForm.description);
      fd.append("goal_centavos", String(Number(campaignForm.goal_centavos) * 100));
      if (campaignForm.ends_at) fd.append("ends_at", new Date(campaignForm.ends_at).toISOString());
      if (photoRef.current?.files?.[0]) fd.append("image", photoRef.current.files[0]);
      await sosApi.campaigns.create(fd);
      setShowCampaignModal(false);
      setPhotoPreview(null);
      setCampaignForm({ title: "", description: "", goal_centavos: "", ends_at: "" });
      setCampaignTab("mine");
      await loadTab("campanhas");
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
          onClick={() => { setShowAlertModal(true); getLocation(); }}
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
              {emergencyCategories.map(({ icon: Icon, label, value, color, bg }) => {
                const contact = categoryContact[value];
                return (
                  <div key={value} className="flex items-center gap-1">
                    <button onClick={() => startCountdown(value)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:brightness-110", color, bg, "border-current/20")}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                    {contact && (
                      <a href={`tel:${contact.number}`}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs text-themed-muted hover:text-themed-primary border border-transparent hover:border-white/10 transition-all"
                        title={`${contact.label}: ${contact.number}`}>
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })}
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
          <div className="flex gap-1 glass-panel p-1 rounded-full w-fit">
            {[
              { id: "active", label: "Activos" },
              { id: "resolved", label: "Resolvidos" },
              { id: "mine", label: "Meus Alertas" },
              { id: "all", label: "Todos" },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setAlertsFilter(id)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  alertsFilter === id ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
                {label}
              </button>
            ))}
          </div>
          <div className="glass-panel luminous-edge rounded-xl overflow-hidden">
            {alerts.length === 0 && (
              <p className="text-themed-muted text-center py-8">Sem alertas.</p>
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
                  <button onClick={() => shareAlert(alert)}
                    className="text-themed-muted hover:text-accent-feed transition-colors mb-1">
                    <Share2 className="w-4 h-4" />
                  </button>
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
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
            <div className="flex gap-1 glass-panel p-1 rounded-full w-fit">
              {[
                { id: "active", label: "Activos" },
                { id: "found", label: "Encontrados" },
                { id: "all", label: "Todos" },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setMissingFilter(id)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    missingFilter === id ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
                  {label}
                </button>
              ))}
            </div>
            <Button className="bg-accent-sos text-white hover:brightness-110 flex-shrink-0"
              onClick={() => { setShowMissingModal(true); setPhotoPreview(null); }}>
              <Plus className="w-4 h-4 mr-2" /> Reportar
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
                    <Button size="sm" variant="glass" className="flex-1 text-xs"
                      onClick={() => { setSelectedPerson(person); setShowDetailsModal(true); }}>Ver Detalhes</Button>
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
              <input value={lostSearchQuery} onChange={e => setLostSearchQuery(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-body-sm text-themed-primary outline-none"
                placeholder="Pesquisar achados e perdidos..." />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
            <div className="flex gap-1 glass-panel p-1 rounded-full w-fit">
              {[
                { id: "all",     label: "Todos" },
                { id: "perdido", label: "Perdidos" },
                { id: "achado",  label: "Achados" },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setLostFilter(id)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    lostFilter === id ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
                  {label}
                </button>
              ))}
            </div>
            <Button className="bg-accent-bisno text-surface hover:brightness-110 flex-shrink-0"
              onClick={() => { setShowLostModal(true); setPhotoPreview(null); }}>
              <Plus className="w-4 h-4 mr-2" /> Publicar
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {lostFound
              .filter(item =>
                (lostFilter === "all" || item.item_type === lostFilter) &&
                (lostSearchQuery === "" ||
                  item.title.toLowerCase().includes(lostSearchQuery.toLowerCase()) ||
                  (item.description ?? "").toLowerCase().includes(lostSearchQuery.toLowerCase()) ||
                  (item.location ?? "").toLowerCase().includes(lostSearchQuery.toLowerCase()))
              )
              .map(item => (
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
                  <p className="text-xs text-themed-secondary mb-2 line-clamp-2">{item.description}</p>
                  {item.location && (
                    <p className="text-xs text-themed-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {item.location}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="glass" className="flex-shrink-0 text-xs"
                  onClick={() => { setSelectedLostItem(item); setShowLostDetails(true); }}>
                  {item.contact_info ? "Contactar" : "Detalhes"} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
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
          <div className="flex flex-col sm:flex-row gap-3 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted w-4 h-4" />
              <input value={campaignSearchQuery} onChange={e => setCampaignSearchQuery(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-body-sm text-themed-primary outline-none"
                placeholder="Pesquisar campanhas..." />
            </div>
          </div>
          <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-2">
            <button onClick={() => setCampaignTab("all")}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                campaignTab === "all" ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
              Todas
            </button>
            <button onClick={() => setCampaignTab("mine")}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                campaignTab === "mine" ? "bg-white/10 text-themed-primary border border-white/15" : "text-themed-muted hover:text-themed-secondary")}>
              Minhas Campanhas
            </button>
            <button onClick={() => { setShowCampaignModal(true); setPhotoPreview(null); }}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-accent-feed hover:bg-accent-feed/10 transition-all border border-transparent hover:border-accent-feed/20">
              + Criar
            </button>
          </div>
          {campaigns
            .filter(c =>
              campaignSearchQuery === "" ||
              c.title.toLowerCase().includes(campaignSearchQuery.toLowerCase()) ||
              c.description.toLowerCase().includes(campaignSearchQuery.toLowerCase())
            )
            .map(c => (
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
              <p className="text-body-sm text-themed-secondary mb-4 line-clamp-2">{c.description}</p>
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-themed-secondary">Meta: {(c.goal_centavos / 100).toLocaleString("pt-AO")} AOA</span>
                  <span className="text-accent-feed font-bold">{c.pct}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent-feed to-emerald-400 rounded-full" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-accent-feed text-surface hover:brightness-110"
                  onClick={() => { setSelectedCampaign(c); setShowCampaignDetails(true); }}>
                  <Heart className="w-4 h-4 mr-2" /> Doar Agora
                </Button>
                <Button variant="glass" size="sm" className="text-xs"
                  onClick={() => { setSelectedCampaign(c); setShowCampaignDetails(true); }}>
                  Detalhes <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
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

      {/* ── Modal Detalhes Campanha ──────────────────────────── */}
      {showCampaignDetails && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Campanha</h3>
              <button onClick={() => setShowCampaignDetails(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            <div className="flex flex-col items-center mb-5">
              {selectedCampaign.image_url ? (
                <img src={selectedCampaign.image_url} alt={selectedCampaign.title} className="w-32 h-32 rounded-2xl object-cover mb-4" />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-accent-feed/10 flex items-center justify-center mb-4 border border-accent-feed/20">
                  <Heart className="w-12 h-12 text-accent-feed" />
                </div>
              )}
              <h2 className="text-h2 font-space-grotesk text-themed-primary text-center">{selectedCampaign.title}</h2>
              <span className="text-label-caps text-accent-feed uppercase text-xs mt-2">Campanha Activa</span>
            </div>
            <p className="text-body-sm text-themed-secondary mb-5">{selectedCampaign.description}</p>
            <div className="mb-5">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-themed-secondary">
                  {(selectedCampaign.current_centavos / 100).toLocaleString("pt-AO")} AOA
                  <span className="text-themed-muted"> / {(selectedCampaign.goal_centavos / 100).toLocaleString("pt-AO")} AOA</span>
                </span>
                <span className="text-accent-feed font-bold">{selectedCampaign.pct}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent-feed to-emerald-400 rounded-full" style={{ width: `${Math.min(selectedCampaign.pct, 100)}%` }} />
              </div>
            </div>
            {selectedCampaign.ends_at && (
              <p className="text-xs text-themed-muted mb-4">Termina {timeAgo(selectedCampaign.ends_at)}</p>
            )}
            <Button className="w-full bg-accent-feed text-surface hover:brightness-110">
              <Heart className="w-4 h-4 mr-2" /> Doar Agora
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal Alerta ─────────────────────────────────────── */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Enviar Alerta</h3>
              <button onClick={() => { setShowAlertModal(false); setCountdown(null); clearInterval(countdownRef.current); }}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            {coords && (
              <p className="text-xs text-accent-feed mb-3 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Localização detectada automaticamente
              </p>
            )}
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
            {countdown !== null ? (
              <div className="text-center">
                <p className="text-5xl font-black text-accent-sos mb-2 animate-pulse">{countdown}</p>
                <p className="text-xs text-themed-muted mb-4">A enviar alerta...</p>
                <button onClick={() => { clearInterval(countdownRef.current); setCountdown(null); }}
                  className="text-xs text-themed-muted hover:text-accent-sos underline">Cancelar</button>
              </div>
            ) : (
              <Button className="w-full bg-accent-sos text-white hover:brightness-110"
                onClick={() => startCountdown(alertForm.category)} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                Enviar Alerta
              </Button>
            )}
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

      {/* ── Modal Detalhes Desaparecido ──────────────────────────── */}
      {showDetailsModal && selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Detalhes</h3>
              <button onClick={() => setShowDetailsModal(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            <div className="flex flex-col items-center mb-5">
              {selectedPerson.photo_url ? (
                <img src={selectedPerson.photo_url} alt={selectedPerson.name} className="w-32 h-32 rounded-2xl object-cover mb-4" />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                  {selectedPerson.person_type === "animal"
                    ? <PawPrint className="w-12 h-12 text-accent-feed" />
                    : <UserX className="w-12 h-12 text-accent-sos" />}
                </div>
              )}
              <h2 className="text-h2 font-space-grotesk text-themed-primary text-center">{selectedPerson.name}</h2>
              {selectedPerson.age && <p className="text-themed-muted">{selectedPerson.age} anos</p>}
              <span className={cn("text-label-caps uppercase font-bold text-xs mt-2 px-3 py-1 rounded-full",
                selectedPerson.status === "active"
                  ? selectedPerson.is_urgent ? "bg-accent-sos/10 text-accent-sos" : "bg-accent-gold/10 text-accent-gold"
                  : "bg-accent-feed/10 text-accent-feed")}>
                {selectedPerson.status === "active" ? (selectedPerson.is_urgent ? "Urgente" : "Desaparecido") : "Encontrado"}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-label-caps text-themed-muted uppercase text-xs">Tipo</span>
                <p className="text-body-sm text-themed-primary">{selectedPerson.person_type === "animal" ? "Animal" : "Pessoa"}</p>
              </div>
              <div>
                <span className="text-label-caps text-themed-muted uppercase text-xs">Descrição</span>
                <p className="text-body-sm text-themed-secondary">{selectedPerson.description}</p>
              </div>
              {selectedPerson.last_seen_location && (
                <div>
                  <span className="text-label-caps text-themed-muted uppercase text-xs">Último local visto</span>
                  <p className="text-body-sm text-themed-primary flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-accent-sos" /> {selectedPerson.last_seen_location}
                  </p>
                </div>
              )}
              <div>
                <span className="text-label-caps text-themed-muted uppercase text-xs">Reportado</span>
                <p className="text-body-sm text-themed-muted">{timeAgo(selectedPerson.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Detalhes Achado/Perdido ──────────────────────────── */}
      {showLostDetails && selectedLostItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Detalhes</h3>
              <button onClick={() => setShowLostDetails(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            <div className="flex flex-col items-center mb-5">
              {selectedLostItem.photo_url ? (
                <img src={selectedLostItem.photo_url} alt={selectedLostItem.title} className="w-32 h-32 rounded-2xl object-cover mb-4" />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                  <Package className={cn("w-12 h-12", selectedLostItem.item_type === "achado" ? "text-accent-feed" : "text-accent-gold")} />
                </div>
              )}
              <h2 className="text-h2 font-space-grotesk text-themed-primary text-center">{selectedLostItem.title}</h2>
              <span className={cn("text-label-caps uppercase font-bold text-xs mt-2 px-3 py-1 rounded-full",
                selectedLostItem.item_type === "achado" ? "bg-accent-feed/10 text-accent-feed" : "bg-accent-gold/10 text-accent-gold")}>
                {selectedLostItem.item_type === "achado" ? "Achado" : "Perdido"}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-label-caps text-themed-muted uppercase text-xs">Descrição</span>
                <p className="text-body-sm text-themed-secondary">{selectedLostItem.description}</p>
              </div>
              {selectedLostItem.location && (
                <div>
                  <span className="text-label-caps text-themed-muted uppercase text-xs">Localização</span>
                  <p className="text-body-sm text-themed-primary flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-accent-bisno" /> {selectedLostItem.location}
                  </p>
                </div>
              )}
              {selectedLostItem.contact_info && (
                <div>
                  <span className="text-label-caps text-themed-muted uppercase text-xs">Contacto</span>
                  <p className="text-body-sm text-themed-primary">{selectedLostItem.contact_info}</p>
                  <a href={`tel:${selectedLostItem.contact_info.replace(/\s+/g, "")}`}
                    className="mt-2 inline-flex items-center gap-2 bg-accent-feed/10 text-accent-feed border border-accent-feed/20 rounded-xl px-4 py-2 text-sm font-bold hover:brightness-110 transition-all">
                    Ligar agora
                  </a>
                </div>
              )}
              <div>
                <span className="text-label-caps text-themed-muted uppercase text-xs">Publicado</span>
                <p className="text-body-sm text-themed-muted">{timeAgo(selectedLostItem.created_at)}</p>
              </div>
            </div>
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

      {/* ── Modal Criar Campanha ──────────────────────────────── */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-md border border-white/10 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-h3 font-space-grotesk text-themed-primary">Criar Campanha</h3>
              <button onClick={() => setShowCampaignModal(false)}><X className="w-5 h-5 text-themed-muted" /></button>
            </div>
            <div className="mb-4">
              <div className="w-full h-24 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-feed/50 transition-colors overflow-hidden"
                onClick={() => photoRef.current?.click()}>
                {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> :
                  <><Upload className="w-5 h-5 text-themed-muted mb-1" /><span className="text-xs text-themed-muted">Imagem (opcional)</span></>}
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setPhotoPreview(URL.createObjectURL(f)); }} />
            </div>
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Título</label>
              <input value={campaignForm.title} onChange={e => setCampaignForm(f => ({ ...f, title: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-feed/50"
                placeholder="Ex: Ajuda para a família Silva" />
            </div>
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Descrição</label>
              <textarea value={campaignForm.description} onChange={e => setCampaignForm(f => ({ ...f, description: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-feed/50 resize-none h-24"
                placeholder="Descreve o objectivo da campanha..." />
            </div>
            <div className="mb-3">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Meta (AOA)</label>
              <input type="number" value={campaignForm.goal_centavos} onChange={e => setCampaignForm(f => ({ ...f, goal_centavos: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-feed/50"
                placeholder="Ex: 500000" />
            </div>
            <div className="mb-5">
              <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Termina em (opcional)</label>
              <input type="date" value={campaignForm.ends_at} onChange={e => setCampaignForm(f => ({ ...f, ends_at: e.target.value }))}
                className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-themed-primary outline-none focus:border-accent-feed/50" />
            </div>
            {error && <p className="text-accent-sos text-sm mb-4">{error}</p>}
            <Button className="w-full bg-accent-feed text-surface hover:brightness-110" onClick={createCampaign} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Heart className="w-4 h-4 mr-2" />}
              Criar Campanha
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

import { useState } from "react";
import {
  Zap, MapPin, Clock, Briefcase, ChevronRight,
  Plus, Filter, Star, AlertCircle, Truck, Home,
  Monitor, Package, FileText, Send, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "disponiveis" | "meus" | "publicar";
type Category = "Todos" | "Tecnologia" | "Entregas" | "Transporte" | "Serviços";

interface Job {
  id: number;
  title: string;
  description: string;
  category: Exclude<Category, "Todos">;
  budget: number;
  location: string;
  distance: string;
  deadline: string;
  urgent: boolean;
  rating: number;
}

// ── Sample data ───────────────────────────────────────────────────────────────
const jobs: Job[] = [
  {
    id: 1,
    title: "Reparação de Computador",
    description: "Portátil não liga. Preciso de diagnóstico e reparação urgente.",
    category: "Tecnologia",
    budget: 3500,
    location: "Luanda, Talatona",
    distance: "1.2 km",
    deadline: "Hoje",
    urgent: true,
    rating: 4.8,
  },
  {
    id: 2,
    title: "Entrega de Documentos",
    description: "Entrega de envelope com documentos do Miramar para o Talatona.",
    category: "Entregas",
    budget: 1200,
    location: "Luanda, Miramar",
    distance: "3.5 km",
    deadline: "Amanhã",
    urgent: false,
    rating: 4.5,
  },
  {
    id: 3,
    title: "Desenvolvimento de Website",
    description: "Website institucional para empresa. Design moderno e responsivo.",
    category: "Tecnologia",
    budget: 25000,
    location: "Remoto",
    distance: "Remoto",
    deadline: "2 semanas",
    urgent: false,
    rating: 4.9,
  },
  {
    id: 4,
    title: "Transporte para Aeroporto",
    description: "Transporte para o Aeroporto Internacional de Luanda às 06h00.",
    category: "Transporte",
    budget: 4500,
    location: "Luanda, Maianga",
    distance: "2.1 km",
    deadline: "Amanhã 06h00",
    urgent: true,
    rating: 4.7,
  },
  {
    id: 5,
    title: "Limpeza de Apartamento",
    description: "Apartamento T3 precisa de limpeza geral. Materiais fornecidos.",
    category: "Serviços",
    budget: 5000,
    location: "Luanda, Alvalade",
    distance: "4.8 km",
    deadline: "Esta semana",
    urgent: false,
    rating: 4.6,
  },
  {
    id: 6,
    title: "Instalação de Câmeras",
    description: "Sistema de videovigilância com 4 câmeras para moradia.",
    category: "Serviços",
    budget: 8000,
    location: "Luanda, Viana",
    distance: "8.3 km",
    deadline: "Esta semana",
    urgent: false,
    rating: 4.4,
  },
];

// ── Category config ───────────────────────────────────────────────────────────
const categoryConfig: Record<Exclude<Category, "Todos">, { color: string; bg: string; icon: React.ElementType }> = {
  Tecnologia: { color: "text-accent-bisno",  bg: "bg-accent-bisno/10",  icon: Monitor  },
  Entregas:   { color: "text-accent-feed",   bg: "bg-accent-feed/10",   icon: Package  },
  Transporte: { color: "text-accent-gold",   bg: "bg-accent-gold/10",   icon: Truck    },
  Serviços:   { color: "text-accent-games",  bg: "bg-accent-games/10",  icon: Home     },
};

const categories: Category[] = ["Todos", "Tecnologia", "Entregas", "Transporte", "Serviços"];

// ── Job card ──────────────────────────────────────────────────────────────────
function JobCard({ job }: { job: Job }) {
  const cfg = categoryConfig[job.category];
  const CatIcon = cfg.icon;

  return (
    <div className={cn(
      "glass-panel luminous-edge rounded-lg p-5 flex flex-col gap-4 transition-all hover:border-white/20",
      job.urgent && "border-accent-sos/40",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-body-md font-bold text-white">{job.title}</h3>
            {job.urgent && (
              <span className="flex items-center gap-1 text-xs font-bold text-accent-sos bg-accent-sos/10 px-2 py-0.5 rounded-full border border-accent-sos/30">
                <AlertCircle className="w-3 h-3" />
                Urgente
              </span>
            )}
          </div>
          <p className="text-body-sm text-zinc-400 line-clamp-2">{job.description}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-bold text-body-md">{job.budget.toLocaleString("pt-AO")}</p>
          <p className="text-zinc-500 text-xs">AOA</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-body-sm text-zinc-500">
        <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", cfg.color, cfg.bg)}>
          <CatIcon className="w-3 h-3" />
          {job.category}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {job.location}
        </span>
        {job.distance !== "Remoto" && (
          <span className="text-zinc-600">{job.distance}</span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {job.deadline}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold" />
          <span className="text-zinc-300">{job.rating}</span>
        </span>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <span className="text-zinc-600 text-xs">Prazo: {job.deadline}</span>
        <Button size="sm" className="bg-accent-bisno/10 text-accent-bisno border border-accent-bisno/20 hover:bg-accent-bisno/20">
          Candidatar
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Publish form ──────────────────────────────────────────────────────────────
function PublishForm() {
  const [form, setForm] = useState({
    titulo: "", categoria: "", descricao: "", orcamento: "", prazo: "", localizacao: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-body-sm text-on-surface placeholder:text-zinc-600 focus:ring-1 focus:ring-accent-bisno/40 focus:border-accent-bisno/40 outline-none transition-all";

  return (
    <div className="glass-panel luminous-edge rounded-xl p-6">
      <h2 className="text-h3 font-space-grotesk text-white mb-6 flex items-center gap-2">
        <Send className="w-5 h-5 text-accent-bisno" />
        Publicar Bisno
      </h2>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-label-caps text-zinc-500 uppercase tracking-widest block mb-1.5">Título</label>
          <input name="titulo" value={form.titulo} onChange={handleChange} className={inputCls} placeholder="Ex: Reparação de computador" />
        </div>
        <div>
          <label className="text-label-caps text-zinc-500 uppercase tracking-widest block mb-1.5">Categoria</label>
          <select name="categoria" value={form.categoria} onChange={handleChange} className={inputCls}>
            <option value="">Seleccionar categoria</option>
            {(["Tecnologia", "Entregas", "Transporte", "Serviços"] as const).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label-caps text-zinc-500 uppercase tracking-widest block mb-1.5">Descrição</label>
          <textarea
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            rows={3}
            className={cn(inputCls, "resize-none")}
            placeholder="Descreve o trabalho em detalhe..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-label-caps text-zinc-500 uppercase tracking-widest block mb-1.5">Orçamento (AOA)</label>
            <input name="orcamento" value={form.orcamento} onChange={handleChange} type="number" className={inputCls} placeholder="Ex: 5000" />
          </div>
          <div>
            <label className="text-label-caps text-zinc-500 uppercase tracking-widest block mb-1.5">Prazo</label>
            <input name="prazo" value={form.prazo} onChange={handleChange} type="date" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="text-label-caps text-zinc-500 uppercase tracking-widest block mb-1.5">Localização</label>
          <input name="localizacao" value={form.localizacao} onChange={handleChange} className={inputCls} placeholder="Ex: Luanda, Talatona" />
        </div>
        <Button className="bg-accent-bisno text-surface hover:brightness-110 font-semibold mt-2">
          <Send className="w-4 h-4 mr-2" />
          Publicar Bisno
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BisnoPage() {
  const [activeTab,     setActiveTab]     = useState<Tab>("disponiveis");
  const [activeCategory, setActiveCategory] = useState<Category>("Todos");

  const filtered = activeCategory === "Todos"
    ? jobs
    : jobs.filter((j) => j.category === activeCategory);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "disponiveis", label: "Disponíveis",    icon: Briefcase },
    { id: "meus",        label: "Os Meus Bisnos", icon: FileText  },
    { id: "publicar",    label: "Publicar",        icon: Plus      },
  ];

  return (
    <div className="py-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-accent-bisno/10 flex items-center justify-center border border-accent-bisno/20">
              <Zap className="w-5 h-5 text-accent-bisno" />
            </div>
            <h1 className="text-h1 font-space-grotesk text-white">Bisno Rápido</h1>
          </div>
          <p className="text-on-surface-variant mt-1">
            Encontra trabalho rápido ou publica uma tarefa. Pagamento seguro em AOA.
          </p>
        </div>
        {/* Stats */}
        <div className="flex gap-4 text-center">
          {[
            { label: "Activos", value: "247", color: "text-accent-bisno" },
            { label: "Hoje",    value: "38",  color: "text-accent-feed"  },
          ].map((s) => (
            <div key={s.label} className="glass-panel rounded-lg px-4 py-2">
              <p className={cn("text-h3 font-space-grotesk font-bold", s.color)}>{s.value}</p>
              <p className="text-zinc-500 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-8">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-full text-body-sm font-medium transition-all",
              activeTab === id
                ? "bg-white/10 text-white border border-white/15"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Disponíveis ──────────────────────────────────────────── */}
      {activeTab === "disponiveis" && (
        <>
          {/* Filter chips */}
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex gap-1 glass-panel p-1 rounded-full flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-body-sm font-medium transition-all",
                    activeCategory === cat
                      ? "bg-white/10 text-white border border-white/15"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full text-body-sm text-zinc-400 hover:text-white transition-colors border border-white/5">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
          ) : (
            <div className="glass-panel rounded-lg p-12 text-center">
              <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-h3 font-space-grotesk text-white mb-2">Sem bisnos nesta categoria</h3>
              <p className="text-on-surface-variant">Tenta outra categoria ou publica o teu próprio bisno.</p>
            </div>
          )}
        </>
      )}

      {/* ── Os Meus Bisnos ───────────────────────────────────────── */}
      {activeTab === "meus" && (
        <div className="glass-panel rounded-xl p-12 text-center">
          <Inbox className="w-14 h-14 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-h3 font-space-grotesk text-white mb-2">Sem bisnos activos</h3>
          <p className="text-on-surface-variant mb-6">
            Os bisnos em que te candidatares ou publicares aparecerão aqui.
          </p>
          <Button onClick={() => setActiveTab("publicar")} className="bg-accent-bisno text-surface hover:brightness-110">
            <Plus className="w-4 h-4 mr-2" />
            Publicar Bisno
          </Button>
        </div>
      )}

      {/* ── Publicar ─────────────────────────────────────────────── */}
      {activeTab === "publicar" && <PublishForm />}
    </div>
  );
}

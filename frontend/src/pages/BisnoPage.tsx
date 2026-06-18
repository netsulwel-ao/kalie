import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import {
  Zap, MapPin, Briefcase, Plus,
  Truck, Monitor, Package, Home, Send, Inbox,
  Navigation, Loader2, X, Image, ChevronRight,
  Phone, MessageCircle, PhoneCall, Wrench,
  Tag, ChevronLeft, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { bisnoApi, formatAOA, timeAgo, type BisnoItem } from "@/services/modules";
import { extractApiError } from "@/services/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "disponiveis" | "meus" | "publicar";
type FormStep = "type" | "common" | "specific";

const categoryLabels = [
  "Todas", "Tecnologia", "Entregas", "Transporte",
  "Serviços", "Moda", "Casa", "Educação", "Saúde", "Outro",
] as const;

const catMap: Record<string, string> = {
  Todas: "todas", Tecnologia: "tecnologia", Entregas: "entregas", Transporte: "transporte",
  "Serviços": "servicos", Moda: "moda", Casa: "casa",
  "Educação": "educacao", Saúde: "saude", Outro: "outro",
};

const catRev: Record<string, string> = {
  tecnologia: "Tecnologia", entregas: "Entregas", transporte: "Transporte",
  servicos: "Serviços", moda: "Moda", casa: "Casa",
  educacao: "Educação", saude: "Saúde", outro: "Outro",
};

const categoryIcons: Record<string, React.ElementType> = {
  tecnologia: Monitor, entregas: Package, transporte: Truck,
  servicos: Home, moda: Tag, casa: Home, educacao: Monitor,
  saude: Home, outro: Tag,
};

const catColors: Record<string, string> = {
  tecnologia: "text-accent-bisno", entregas: "text-accent-feed",
  transporte: "text-accent-gold", servicos: "text-accent-games",
  moda: "text-pink-400", casa: "text-orange-400",
  educacao: "text-blue-400", saude: "text-green-400", outro: "text-zinc-400",
};

const catBgs: Record<string, string> = {
  tecnologia: "bg-accent-bisno/10", entregas: "bg-accent-feed/10",
  transporte: "bg-accent-gold/10", servicos: "bg-accent-games/10",
  moda: "bg-pink-400/10", casa: "bg-orange-400/10",
  educacao: "bg-blue-400/10", saude: "bg-green-400/10", outro: "bg-white/5",
};

const bisnoSchema = z.object({
  // step 1
  type: z.enum(["product", "service"], { required_error: "Selecciona o tipo" }),
  // common
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  category: z.string().min(1, "Selecciona uma categoria"),
  contact_method: z.enum(["chat", "whatsapp", "call"]).default("chat"),
  contact_value: z.string().optional().default(""),
  location_name: z.string().optional().default(""),
  // product
  price_centavos: z.string().optional().default(""),
  negotiable: z.boolean().default(false),
  condition: z.enum(["new", "used"]).optional(),
  // service
  price_type: z.enum(["hourly", "fixed", "negotiable"]).optional(),
  service_modality: z.enum(["home", "in_person"]).optional(),
});

type BisnoForm = z.infer<typeof bisnoSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(centavos: number | null, priceType?: string | null): string {
  if (!centavos && priceType !== "negotiable") return "—";
  if (priceType === "negotiable") return "A Negociar";
  if (priceType === "hourly") return `${formatAOA(centavos!)}/h`;
  if (priceType === "fixed" || !priceType) return formatAOA(centavos!);
  return formatAOA(centavos!);
}

function contactIcon(method: string) {
  switch (method) {
    case "whatsapp": return Phone;
    case "call": return PhoneCall;
    default: return MessageCircle;
  }
}

function contactLabel(method: string) {
  switch (method) {
    case "whatsapp": return "WhatsApp";
    case "call": return "Chamar";
    default: return "Chat";
  }
}

// ── Detail Modal ───────────────────────────────────────────────────────────────

function DetailSidePanel({ item, onClose, onEdit, onDelete, onStatus }: {
  item: BisnoItem; onClose: () => void;
  onEdit?: () => void; onDelete?: () => void; onStatus?: (status: string) => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const images = item.images ?? [];
  const ContactIcon = contactIcon(item.contact_method);
  const CatIcon = categoryIcons[item.category] ?? Tag;
  const isProduct = item.type === "product";
  const { user } = useAuthStore();
  const isCreator = user?.id === item.creator_id;
  const navigate = useNavigate();

  useEffect(() => {
    setIsOpen(true);
    return () => setIsOpen(false);
  }, []);

  return (
    <>
      {/* Side panel */}
      <div className={cn("fixed right-0 top-24 z-50 bottom-0 w-full max-w-lg glass-panel border-l border-white/10 overflow-y-auto transition-transform duration-300 shadow-2xl",
        isOpen ? "translate-x-0" : "translate-x-full")}>
        {/* Header */}
        <div className="sticky top-0 z-10 glass-panel border-b border-white/5 p-5 flex items-center justify-between">
          <h3 className="text-h3 font-space-grotesk text-themed-primary">Detalhes</h3>
          <button onClick={onClose} className="w-8 h-8 glass-panel rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-themed-muted" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Image gallery */}
          {images.length > 0 && (
            <div className="relative h-64 bg-black/40">
              <img src={images[imgIdx]} alt="" className="w-full h-full object-cover" />
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className={cn("w-2 h-2 rounded-full transition-all", i === imgIdx ? "bg-white w-4" : "bg-white/40")} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <h3 className="text-h3 font-space-grotesk text-themed-primary">{item.title}</h3>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
              catColors[item.category] ?? "text-zinc-400", catBgs[item.category] ?? "bg-white/5")}>
              <CatIcon className="w-3 h-3" />
              {catRev[item.category] ?? item.category}
            </span>
            {isProduct ? (
              <>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-400/10 text-blue-400 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Produto
                </span>
                {item.condition === "new" && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-400/10 text-green-400">Novo</span>}
                {item.condition === "used" && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-400/10 text-orange-400">Usado</span>}
              </>
            ) : (
              <>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-400/10 text-purple-400 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Serviço
                </span>
                {item.service_modality === "home" && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-bisno/10 text-accent-bisno">Ao Domicílio</span>
                )}
                {item.service_modality === "in_person" && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-games/10 text-accent-games">Presencial</span>
                )}
              </>
            )}
          </div>

          {/* Price */}
          <div className="glass-panel p-4 flex items-center justify-between">
            <span className="text-sm text-themed-muted">{isProduct ? "Preço" : "Cobrança"}</span>
            <span className="text-xl font-bold text-accent-bisno">
              {fmtPrice(item.price_centavos, isProduct ? null : item.price_type)}
              {isProduct && item.negotiable && <span className="text-xs text-themed-muted ml-2">Negociável</span>}
            </span>
          </div>

          {/* Description */}
          <p className="text-body-sm text-themed-secondary leading-relaxed">{item.description}</p>

          {/* Location */}
          {(item.location_name || item.latitude) && (
            <div className="flex items-center gap-2 text-sm text-themed-muted">
              <MapPin className="w-4 h-4" />
              {item.location_name}
              {item.distance_km && <span className="text-xs">· {item.distance_km} km</span>}
            </div>
          )}

          {/* Creator */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <Avatar className="w-9 h-9">
              {item.creator_avatar ? <img src={item.creator_avatar} className="rounded-full" /> : null}
              <AvatarFallback className="bg-accent-bisno/20 text-accent-bisno text-xs">
                {(item.creator_name ?? "U").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-body-sm font-medium text-themed-primary">{item.creator_name ?? "Utilizador"}</p>
              <p className="text-xs text-themed-muted">{timeAgo(item.created_at)}</p>
            </div>
          </div>

          {/* Location + Contact buttons */}
          <div className="flex gap-2">
            {item.latitude && (
              <Button
                onClick={() => navigate(`/mapa?lat=${item.latitude}&lng=${item.longitude}`)}
                className="flex-1 bg-accent-games text-white hover:brightness-110 font-semibold text-sm" size="lg">
                <MapPin className="w-4 h-4 mr-2" />
                Ver no Mapa
              </Button>
            )}
            <Button className="flex-1 bg-accent-bisno text-surface hover:brightness-110 font-semibold" size="lg">
              <ContactIcon className="w-4 h-4 mr-2" />
              {contactLabel(item.contact_method)}
            </Button>
          </div>

          {/* Creator actions */}
          {isCreator && item.status === "active" && (
            <div className="flex gap-2 pt-2">
              {onStatus && (
                <Button onClick={() => onStatus(isProduct ? "sold" : "completed")}
                  className="flex-1 bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 font-semibold text-sm" size="sm">
                  {isProduct ? "Marcar Vendido" : "Marcar Completo"}
                </Button>
              )}
              {onEdit && (
                <Button onClick={onEdit}
                  className="flex-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 font-semibold text-sm" size="sm">
                  Editar
                </Button>
              )}
              {onDelete && (
                <Button onClick={onDelete}
                  className="flex-1 bg-accent-sos/20 text-accent-sos border border-accent-sos/30 hover:bg-accent-sos/30 font-semibold text-sm" size="sm">
                  Eliminar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Bisno Card ─────────────────────────────────────────────────────────────────

function BisnoCard({ item, onOpen }: { item: BisnoItem; onOpen: () => void }) {
  const isProduct = item.type === "product";
  const CatIcon = categoryIcons[item.category] ?? Tag;
  const images = item.images ?? [];
  const firstImg = images[0] ?? null;

  return (
    <div onClick={onOpen}
      className="glass-panel luminous-edge overflow-hidden transition-all hover:border-white/20 cursor-pointer group">
      {/* Image */}
      <div className="relative h-36 bg-black/30">
        {firstImg ? (
          <img src={firstImg} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CatIcon className="w-10 h-10 text-white/20" />
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md border",
            isProduct ? "bg-blue-500/30 text-blue-200 border-blue-400/30" : "bg-purple-500/30 text-purple-200 border-purple-400/30")}>
            {isProduct ? "PRODUTO" : "SERVIÇO"}
          </span>
          {isProduct && item.condition === "new" && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/30 text-green-200 border border-green-400/30">Novo</span>
          )}
          {!isProduct && item.service_modality === "home" && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-bisno/30 text-accent-bisno/90 border border-accent-bisno/30">Domicílio</span>
          )}
        </div>

        {/* Price */}
        <div className="absolute bottom-2 right-2 glass-panel rounded-lg px-2.5 py-1">
          <p className="text-sm font-bold text-accent-bisno">
            {fmtPrice(item.price_centavos, isProduct ? null : item.price_type)}
          </p>
        </div>

        {images.length > 1 && (
          <div className="absolute top-2 right-2 glass-panel rounded-full w-6 h-6 flex items-center justify-center">
            <Image className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-body-md font-bold text-white leading-tight line-clamp-1">{item.title}</h3>
        </div>
        <p className="text-body-sm text-zinc-400 line-clamp-2">{item.description}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
            catColors[item.category] ?? "text-zinc-400", catBgs[item.category] ?? "bg-white/5")}>
            <CatIcon className="w-2.5 h-2.5" />
            {catRev[item.category] ?? item.category}
          </span>
          {item.location_name && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {item.location_name}
            </span>
          )}
          {item.distance_km !== null && item.distance_km !== undefined && (
            <span>{item.distance_km.toFixed(1)} km</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Publish Form ───────────────────────────────────────────────────────────────

const contactMethods = [
  { value: "chat" as const, label: "Chat Interno", icon: MessageCircle },
  { value: "whatsapp" as const, label: "WhatsApp", icon: Phone },
  { value: "call" as const, label: "Chamada", icon: PhoneCall },
];

function PublishForm({ onPublished, editItem }: { onPublished: () => void; editItem?: BisnoItem | null }) {
  const [step, setStep] = useState<FormStep>(editItem ? "common" : "type");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selLat, setSelLat] = useState<number | null>(editItem?.latitude ?? null);
  const [selLng, setSelLng] = useState<number | null>(editItem?.longitude ?? null);
  const [locating, setLocating] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>(editItem?.images ?? []);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editItem;

  const f = useForm<BisnoForm>({
    resolver: zodResolver(bisnoSchema),
    defaultValues: {
      type: editItem?.type ?? undefined,
      title: editItem?.title ?? "",
      description: editItem?.description ?? "",
      category: catRev[editItem?.category ?? ""] ?? editItem?.category ?? "",
      contact_method: (editItem?.contact_method ?? "chat") as "chat" | "whatsapp" | "call",
      contact_value: editItem?.contact_value ?? "",
      location_name: editItem?.location_name ?? "",
      price_centavos: editItem?.price_centavos ? String(editItem.price_centavos / 100) : "",
      negotiable: editItem?.negotiable ?? false,
      condition: editItem?.condition as "new" | "used" | undefined,
      price_type: editItem?.price_type as "hourly" | "fixed" | "negotiable" | undefined,
      service_modality: editItem?.service_modality as "home" | "in_person" | undefined,
    },
  });

  const watchType = f.watch("type");
  const contactMethod = f.watch("contact_method");

  function addImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newFiles = [...imageFiles, ...files].slice(0, 6);
    setImageFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  }

  function removeImage(i: number) {
    const newFiles = imageFiles.filter((_, idx) => idx !== i);
    setImageFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  }

  function useGps() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setSelLat(pos.coords.latitude); setSelLng(pos.coords.longitude); setLocating(false); },
      () => { setError("Não foi possível obter localização."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(values: BisnoForm) {
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("type", values.type);
      fd.append("title", values.title);
      fd.append("description", values.description);
      fd.append("category", catMap[values.category] ?? values.category);
      fd.append("contact_method", values.contact_method);
      if (values.contact_value) fd.append("contact_value", values.contact_value);
      if (values.location_name) fd.append("location_name", values.location_name);
      if (selLat !== null) fd.append("latitude", String(selLat));
      if (selLng !== null) fd.append("longitude", String(selLng));

      if (values.type === "product") {
        if (values.price_centavos) fd.append("price_centavos", String(Number(values.price_centavos) * 100));
        fd.append("negotiable", String(values.negotiable));
        if (values.condition) fd.append("condition", values.condition);
      } else {
        if (values.price_type) fd.append("price_type", values.price_type);
        if (values.price_type === "hourly" || values.price_type === "fixed") {
          if (values.price_centavos) fd.append("price_centavos", String(Number(values.price_centavos) * 100));
        }
        if (values.service_modality) fd.append("service_modality", values.service_modality);
      }

      imageFiles.forEach(file => fd.append("images", file));

      if (isEditing && editItem) {
        const body: Record<string, any> = {
          title: values.title,
          description: values.description,
          category: catMap[values.category] ?? values.category,
          contact_method: values.contact_method,
          contact_value: values.contact_value || null,
          location_name: values.location_name || null,
          latitude: selLat,
          longitude: selLng,
          negotiable: values.type === "product" ? values.negotiable : undefined,
        };
        if (values.type === "product") {
          body.price_centavos = values.price_centavos ? Number(values.price_centavos) * 100 : null;
          body.condition = values.condition || null;
        } else {
          body.price_type = values.price_type || null;
          body.price_centavos = values.price_centavos ? Number(values.price_centavos) * 100 : null;
          body.service_modality = values.service_modality || null;
        }
        await bisnoApi.update(editItem.id, body);
      } else {
        await bisnoApi.create(fd);
      }
      f.reset();
      setImageFiles([]);
      setPreviews([]);
      setSelLat(null); setSelLng(null);
      onPublished();
    } catch (e) { setError(extractApiError(e)); }
    finally { setSubmitting(false); }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-body-sm text-on-surface placeholder:text-zinc-600 focus:ring-1 focus:ring-accent-bisno/40 focus:border-accent-bisno/40 outline-none transition-all";
  const labelCls = "text-label-caps text-zinc-500 uppercase tracking-widest block mb-1.5";

  if (step === "type") {
    return (
      <div className="glass-panel luminous-edge rounded-xl p-8 max-w-xl">
        <h2 className="text-h3 font-space-grotesk text-white mb-2">O que queres publicar?</h2>
        <p className="text-on-surface-variant mb-8">Escolhe o tipo de anúncio que queres criar.</p>
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => { f.setValue("type", "product"); setStep("common"); }}
            className="glass-panel border border-white/10 rounded-2xl p-8 text-center hover:bg-white/5 hover:border-accent-bisno/40 transition-all group">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Tag className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-body-md font-bold text-white mb-1">Produto</h3>
            <p className="text-xs text-zinc-500">Vender um item físico ou digital</p>
          </button>
          <button type="button" onClick={() => { f.setValue("type", "service"); setStep("common"); }}
            className="glass-panel border border-white/10 rounded-2xl p-8 text-center hover:bg-white/5 hover:border-accent-bisno/40 transition-all group">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Wrench className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-body-md font-bold text-white mb-1">Serviço</h3>
            <p className="text-xs text-zinc-500">Oferecer um serviço ou biscate</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel luminous-edge rounded-xl p-6 max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep("type")} className="w-8 h-8 rounded-full bg-accent-bisno/10 text-accent-bisno flex items-center justify-center text-xs font-bold hover:bg-accent-bisno/20">1</button>
        <div className="h-px flex-1 bg-white/10" />
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
          step === "specific" ? "bg-accent-bisno/10 text-accent-bisno" : "bg-white/10 text-zinc-500")}>2</div>
        <div className="h-px flex-1 bg-white/10" />
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
          submitting ? "bg-accent-bisno/10 text-accent-bisno" : "bg-white/10 text-zinc-500")}>3</div>
      </div>

      <form onSubmit={f.handleSubmit(onSubmit)}>
        {/* ── Step: Common ── */}
        {step === "common" && (
          <div className="space-y-4">
            <h3 className="text-h3 font-space-grotesk text-white flex items-center gap-2">
              {watchType === "product" ? <Tag className="w-5 h-5 text-blue-400" /> : <Wrench className="w-5 h-5 text-purple-400" />}
              Informações Gerais
            </h3>

            {/* Photos */}
            <div>
              <label className={labelCls}>Fotos {previews.length > 0 && `(${previews.length}/6)`}</label>
              <div className="flex flex-wrap gap-2">
                {previews.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {previews.length < 6 && (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-accent-bisno/40 transition-colors">
                    <Plus className="w-5 h-5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">Foto</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addImages} />
            </div>

            <div>
              <label className={labelCls}>Título</label>
              <input {...f.register("title")} className={inputCls} placeholder="Ex: Reparação de computador" />
              {f.formState.errors.title && <p className="text-accent-sos text-xs mt-1">{f.formState.errors.title.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Categoria</label>
              <select {...f.register("category")} className={inputCls}>
                <option value="">Seleccionar categoria</option>
                {categoryLabels.filter(c => c !== "Todas").map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {f.formState.errors.category && <p className="text-accent-sos text-xs mt-1">{f.formState.errors.category.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Descrição</label>
              <textarea {...f.register("description")} rows={3} className={cn(inputCls, "resize-none")}
                placeholder="Descreve o anúncio em detalhe..." />
              {f.formState.errors.description && <p className="text-accent-sos text-xs mt-1">{f.formState.errors.description.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Localização</label>
              <div className="flex gap-2 mb-2">
                <input {...f.register("location_name")} className={cn(inputCls, "flex-1")} placeholder="Ex: Luanda, Talatona" />
                <button type="button" onClick={useGps} disabled={locating}
                  className="glass-panel border border-white/10 rounded-xl px-3 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
                  {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-accent-bisno" />}
                </button>
              </div>
              {selLat !== null && <p className="text-[10px] text-zinc-500">📍 {selLat.toFixed(4)}, {selLng?.toFixed(4)}</p>}
            </div>

            <div>
              <label className={labelCls}>Método de Contacto</label>
              <div className="flex gap-2">
                {contactMethods.map(cm => {
                  const active = contactMethod === cm.value;
                  return (
                    <button key={cm.value} type="button" onClick={() => f.setValue("contact_method", cm.value)}
                      className={cn("flex-1 flex items-center justify-center gap-1.5 glass-panel border rounded-xl px-3 py-3 text-xs transition-all",
                        active ? "border-accent-bisno/50 text-accent-bisno bg-accent-bisno/10" : "border-white/10 text-zinc-400 hover:text-white")}>
                      <cm.icon className="w-3.5 h-3.5" />
                      {cm.label}
                    </button>
                  );
                })}
              </div>
              <input {...f.register("contact_value")} className={cn(inputCls, "mt-2")}
                placeholder={contactMethod === "chat" ? "—" : "Número de telefone com código (ex: +244...)"} />
            </div>

            <Button type="button" onClick={() => setStep("specific")} className="w-full bg-accent-bisno text-surface hover:brightness-110 font-semibold mt-2">
              Continuar <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Step: Specific ── */}
        {step === "specific" && (
          <div className="space-y-4">
            {watchType === "product" ? (
              <>
                <h3 className="text-h3 font-space-grotesk text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-blue-400" /> Detalhes do Produto
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Preço (AOA)</label>
                    <input {...f.register("price_centavos")} type="number" className={inputCls} placeholder="Ex: 5000" />
                  </div>
                  <div>
                    <label className={labelCls}>Estado</label>
                    <select {...f.register("condition")} className={inputCls}>
                      <option value="">Seleccionar</option>
                      <option value="new">Novo</option>
                      <option value="used">Usado</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-3 glass-panel border border-white/10 rounded-xl px-4 py-3 cursor-pointer">
                  <input type="checkbox" {...f.register("negotiable")} className="w-4 h-4 rounded accent-accent-bisno" />
                  <span className="text-sm text-zinc-300">Preço negociável</span>
                </label>
              </>
            ) : (
              <>
                <h3 className="text-h3 font-space-grotesk text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-purple-400" /> Detalhes do Serviço
                </h3>
                <div>
                  <label className={labelCls}>Tipo de Cobrança</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "fixed" as const, label: "Preço Fixo" },
                      { value: "hourly" as const, label: "Por Hora" },
                      { value: "negotiable" as const, label: "A Negociar" },
                    ].map(pt => (
                      <button key={pt.value} type="button" onClick={() => f.setValue("price_type", pt.value)}
                        className={cn("glass-panel border rounded-xl px-3 py-3 text-xs font-medium text-center transition-all",
                          f.watch("price_type") === pt.value ? "border-accent-bisno/50 text-accent-bisno bg-accent-bisno/10" : "border-white/10 text-zinc-400 hover:text-white")}>
                        {pt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {(f.watch("price_type") === "fixed" || f.watch("price_type") === "hourly") && (
                  <div>
                    <label className={labelCls}>
                      {f.watch("price_type") === "hourly" ? "Valor por Hora (AOA)" : "Preço (AOA)"}
                    </label>
                    <input {...f.register("price_centavos")} type="number" className={inputCls} placeholder="Ex: 2000" />
                  </div>
                )}
                <div>
                  <label className={labelCls}>Modalidade</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "home" as const, label: "Ao Domicílio", desc: "Vou ao cliente" },
                      { value: "in_person" as const, label: "Presencial", desc: "Cliente vem a mim" },
                    ].map(m => (
                      <button key={m.value} type="button" onClick={() => f.setValue("service_modality", m.value)}
                        className={cn("glass-panel border rounded-xl px-4 py-4 text-left transition-all",
                          f.watch("service_modality") === m.value ? "border-accent-bisno/50 bg-accent-bisno/10" : "border-white/10 hover:bg-white/5")}>
                        <p className="text-sm font-semibold text-white">{m.label}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 mt-2">
              <Button type="button" variant="glass" onClick={() => setStep("common")} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button type="submit" className="flex-1 bg-accent-bisno text-surface hover:brightness-110 font-semibold" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Publicar
              </Button>
            </div>

            {error && <p className="text-accent-sos text-sm text-center mt-2">{error}</p>}
          </div>
        )}
      </form>
    </div>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────

function FilterBar({ onChange, userPos }: {
  onChange: (f: Record<string, any>) => void;
  userPos: [number, number] | null;
}) {
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [priceType, setPriceType] = useState("");
  const [radius, setRadius] = useState("50");
  const [search, setSearch] = useState("");

  function emit() {
    const p: Record<string, any> = {};
    if (type) p.type = type;
    if (category) p.category = catMap[category] ?? category;
    if (priceType) p.price_type = priceType;
    if (radius && userPos) { p.radius_km = Number(radius); p.lat = userPos[0]; p.lon = userPos[1]; }
    if (search) p.q = search;
    onChange(p);
  }

  useEffect(() => { emit(); }, [type, category, priceType, radius, search, userPos]);

  return (
    <div className="glass-panel rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter */}
        <div className="flex glass-panel-light rounded-lg p-0.5">
          {[
            { value: "", label: "Todos" },
            { value: "product", label: "Produtos" },
            { value: "service", label: "Serviços" },
          ].map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                type === t.value ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300")}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Category */}
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none">
          <option value="">Todas Categorias</option>
          {categoryLabels.filter(c => c !== "Todas").map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Price type (services) */}
        <select value={priceType} onChange={e => setPriceType(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none">
          <option value="">Qualquer Preço</option>
          <option value="fixed">Preço Fixo</option>
          <option value="hourly">Por Hora</option>
          <option value="negotiable">A Negociar</option>
        </select>

        {/* Radius */}
        {userPos && (
          <select value={radius} onChange={e => setRadius(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none">
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
            <option value="100">100 km</option>
            <option value="99999">Qualquer distância</option>
          </select>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-300 outline-none placeholder:text-zinc-600"
            placeholder="Pesquisar..." />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BisnoPage() {
  const [activeTab, setActiveTab] = useState<Tab>("disponiveis");
  const [allBisnos, setAllBisnos] = useState<BisnoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [detailItem, setDetailItem] = useState<BisnoItem | null>(null);
  const [editingItem, setEditingItem] = useState<BisnoItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  async function loadBisnos() {
    setLoading(true);
    try {
      const params: Record<string, any> = { ...filters };
      if (!params.status) params.status = "active";
      params.limit = 50;
      const data = await bisnoApi.list(params);
      setAllBisnos(data);
    } catch (e) { setError(extractApiError(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadBisnos(); }, [filters]);

  async function handleUpdateStatus(id: string, status: string) {
    try { await bisnoApi.update(id, { status }); await loadBisnos(); }
    catch (e) { alert(extractApiError(e)); }
  }

  async function handleDelete(id: string) {
    try { await bisnoApi.delete(id); setDetailItem(null); setConfirmDelete(null); await loadBisnos(); }
    catch (e) { alert(extractApiError(e)); }
  }

  const myBisnos = allBisnos.filter(j => j.creator_id === user?.id);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "disponiveis", label: "Disponíveis", icon: Briefcase },
    { id: "meus", label: "Os Meus", icon: Inbox },
    { id: "publicar", label: "Publicar", icon: Plus },
  ];

  const activeCount = allBisnos.filter(b => b.status === "active").length;
  const todayCount = allBisnos.filter(b =>
    new Date(b.created_at).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-accent-bisno/10 flex items-center justify-center border border-accent-bisno/20">
              <Zap className="w-5 h-5 text-accent-bisno" />
            </div>
            <h1 className="text-h1 font-space-grotesk text-white">Bisno Rápido</h1>
          </div>
          <p className="text-on-surface-variant mt-1">
            Produtos e serviços rápidos perto de ti.
          </p>
        </div>
        <div className="flex gap-3 text-center">
          <div className="glass-panel rounded-lg px-4 py-2">
            <p className="text-h3 font-space-grotesk font-bold text-accent-bisno">{activeCount}</p>
            <p className="text-zinc-500 text-xs">Activos</p>
          </div>
          <div className="glass-panel rounded-lg px-4 py-2">
            <p className="text-h3 font-space-grotesk font-bold text-accent-feed">{todayCount}</p>
            <p className="text-zinc-500 text-xs">Hoje</p>
          </div>
          {userPos && (
            <div className="glass-panel rounded-lg px-4 py-2">
              <p className="text-h3 font-space-grotesk font-bold text-accent-games flex items-center justify-center gap-1">
                <Navigation className="w-4 h-4" />
              </p>
              <p className="text-zinc-500 text-xs">GPS activo</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel p-1 rounded-full w-fit mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn("flex items-center gap-2 px-5 py-2 rounded-full text-body-sm font-medium transition-all",
              activeTab === id ? "bg-white/10 text-white border border-white/15" : "text-zinc-500 hover:text-zinc-300")}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="glass-panel rounded-lg p-4 mb-4 border border-accent-sos/30 text-accent-sos text-sm">{error}</div>
      )}

      {/* Disponíveis */}
      {activeTab === "disponiveis" && (
        <>
          <FilterBar onChange={setFilters} userPos={userPos} />
          <div className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-accent-bisno" /></div>
            ) : allBisnos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allBisnos.map(item => (
                  <BisnoCard key={item.id} item={item} onOpen={() => setDetailItem(item)} />
                ))}
              </div>
            ) : (
              <div className="glass-panel rounded-lg p-12 text-center">
                <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-h3 font-space-grotesk text-white mb-2">Nenhum anúncio encontrado</h3>
                <p className="text-on-surface-variant mb-4">Tenta ajustar os filtros ou publica o teu próprio.</p>
                <Button onClick={() => setActiveTab("publicar")} className="bg-accent-bisno text-surface hover:brightness-110">
                  <Plus className="w-4 h-4 mr-2" />
                  Publicar Anúncio
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Os Meus */}
      {activeTab === "meus" && (
        <div className={myBisnos.length > 0 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : ""}>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-accent-bisno" /></div>
          ) : myBisnos.length > 0 ? (
            myBisnos.map(item => (
              <div key={item.id} className="relative">
                <BisnoCard item={item} onOpen={() => setDetailItem(item)} />
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  {item.status === "active" && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(item.id, item.type === "product" ? "sold" : "completed"); }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/30 text-green-200 border border-green-400/30 backdrop-blur-md">
                        {item.type === "product" ? "Vendido" : "Completo"}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30 backdrop-blur-md">
                        Editar
                      </button>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(item.id); }}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/30 text-red-200 border border-red-400/30 backdrop-blur-md">
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-panel rounded-xl p-12 text-center">
              <Inbox className="w-14 h-14 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-h3 font-space-grotesk text-white mb-2">Sem anúncios teus</h3>
              <p className="text-on-surface-variant mb-6">Publica o teu primeiro anúncio.</p>
              <Button onClick={() => setActiveTab("publicar")} className="bg-accent-bisno text-surface hover:brightness-110">
                <Plus className="w-4 h-4 mr-2" />
                Publicar Anúncio
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Publicar */}
      {activeTab === "publicar" && (
        <PublishForm onPublished={() => { loadBisnos(); setActiveTab("disponiveis"); }} />
      )}

      {/* Detail side panel */}
      {detailItem && (
        <DetailSidePanel
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={() => { setEditingItem(detailItem); setDetailItem(null); }}
          onDelete={() => setConfirmDelete(detailItem.id)}
          onStatus={(status) => handleUpdateStatus(detailItem.id, status)}
        />
      )}

      {/* Edit form */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/60 overflow-y-auto">
          <div className="relative w-full max-w-2xl px-4">
            <div className="flex justify-end mb-2">
              <button onClick={() => setEditingItem(null)}
                className="w-8 h-8 glass-panel rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-themed-muted" />
              </button>
            </div>
            <PublishForm onPublished={() => { loadBisnos(); setEditingItem(null); }} editItem={editingItem} />
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="glass-panel rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-h3 font-space-grotesk text-white mb-2">Eliminar anúncio?</h3>
            <p className="text-on-surface-variant text-sm mb-6">Esta acção não pode ser desfeita.</p>
            <div className="flex gap-3">
              <Button variant="glass" onClick={() => setConfirmDelete(null)} className="flex-1">Cancelar</Button>
              <Button onClick={() => handleDelete(confirmDelete)} className="flex-1 bg-accent-sos text-white hover:brightness-110">
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

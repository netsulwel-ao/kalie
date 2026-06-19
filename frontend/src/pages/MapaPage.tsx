import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search, MapPin, Navigation, Plus, Minus,
  Users, Zap, Calendar,
  Filter, X, Upload, Loader2,
  Phone, PhoneCall, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { eventsApi, bisnoApi, timeAgo, type MapEvent, type BisnoItem, type AttendeeInfo } from "@/services/modules";
import { extractApiError } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/authStore";

type FilterChip = "Todos" | "Eventos" | "Bisnos" | "SOS" | "Utilizadores";

const pinColors: Record<string, string> = {
  sos: "#FF4D2E", bisno: "#00E5FF", evento: "#BF5AF2",
  torneio: "#BF5AF2", jogador: "#00C853", outro: "#888",
};

const filterChips: FilterChip[] = ["Todos", "Eventos", "Bisnos", "SOS", "Utilizadores"];
const filterCategoryMap: Partial<Record<FilterChip, string>> = {
  Eventos: "evento", Bisnos: "bisno", SOS: "sos", Utilizadores: "jogador",
};

const eventSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  category: z.string().default("evento"),
  location_name: z.string().optional().default(""),
  starts_at: z.string().optional().default(""),
  ends_at: z.string().optional().default(""),
});

type EventForm = z.infer<typeof eventSchema>;

const LUANDA: [number, number] = [-8.839, 13.289];
const LOC_HTML = `<div style="width:22px;height:22px;background:#BF5AF2;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(191,90,242,.3)"></div>`;
const PIN_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-right:2px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

// ── Contact helpers ──────────────────────────────────────────────────────────────

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

// ── Event Detail Side Panel ─────────────────────────────────────────────────────

function EventDetailPanel({ event, onClose, onRoute, onAttend, onUnattend }: { 
  event: MapEvent; 
  onClose: () => void; 
  onRoute: () => void;
  onAttend: () => void;
  onUnattend: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const { user } = useAuthStore();
  const isCreator = user?.id === event.creator_id;

  useEffect(() => {
    setIsOpen(true);
    
    // Carregar participantes se for o criador
    if (isCreator) {
      loadAttendees();
    }
    
    return () => setIsOpen(false);
  }, [event.id, isCreator, event.attendees_count]);

  async function loadAttendees() {
    setLoadingAttendees(true);
    try {
      const data = await eventsApi.attendees(event.id);
      setAttendees(data);
    } catch (e) {
      console.error("Erro ao carregar participantes:", e);
    } finally {
      setLoadingAttendees(false);
    }
  }

  return (
    <>
      {/* Side panel */}
      <div className={cn("fixed right-0 top-[180px] bottom-[72px] w-full max-w-sm glass-panel border-l border-white/10 overflow-y-auto transition-transform duration-300 shadow-2xl z-50",
        isOpen ? "translate-x-0" : "translate-x-full")}>
        {/* Header */}
        <div className="sticky top-0 z-10 glass-panel border-b border-white/5 p-4 flex items-center justify-between">
          <h3 className="text-h3 font-space-grotesk text-themed-primary">Detalhes</h3>
          <button onClick={onClose} className="w-8 h-8 glass-panel rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-themed-muted" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Image */}
          {event.image_url && (
            <div className="relative h-48 bg-black/40">
              <img src={event.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Title */}
          <h3 className="text-h3 font-space-grotesk text-themed-primary">{event.title}</h3>

          {/* Description */}
          <p className="text-body-sm text-themed-secondary leading-relaxed">{event.description}</p>

          {/* Location */}
          {event.location_name && (
            <div className="flex items-center gap-2 text-sm text-themed-muted">
              <MapPin className="w-4 h-4" />
              {event.location_name}
              {event.distance_km != null && event.distance_km > 0 && <span className="text-xs">· {event.distance_km.toFixed(1)} km</span>}
            </div>
          )}

          {/* Date */}
          {event.starts_at && (
            <div className="flex items-center gap-2 text-sm text-themed-muted">
              <Calendar className="w-4 h-4" />
              {new Date(event.starts_at).toLocaleString('pt-PT')}
            </div>
          )}

          {/* Attendees */}
          {event.category !== "bisno" && (
            <div className="flex items-center gap-2 text-sm text-themed-muted">
              <Users className="w-4 h-4" />
              {event.attendees_count} participantes
              {event.max_attendees && <span className="text-xs">· Máximo {event.max_attendees}</span>}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {event.latitude && (
                <Button onClick={onRoute} className="flex-1 bg-accent-games text-white hover:brightness-110 font-semibold text-sm">
                  <Navigation className="w-4 h-4 mr-2" />
                  Rota
                </Button>
              )}
              {event.starts_at && new Date(event.starts_at) > new Date() && (
                event.is_attending ? (
                  <Button onClick={onUnattend} className="flex-1 bg-accent-sos text-white hover:brightness-110 font-semibold text-sm">
                    Desconfirmar
                  </Button>
                ) : (
                  <Button onClick={onAttend} className="flex-1 bg-accent-bisno text-surface hover:brightness-110 font-semibold text-sm">
                    Confirmar
                  </Button>
                )
              )}
            </div>
            {event.category === "bisno" && event.contact_method && (() => {
              const Icon = contactIcon(event.contact_method);
              return (
                <Button className="w-full bg-accent-bisno text-surface hover:brightness-110 font-semibold text-sm">
                  <Icon className="w-4 h-4 mr-2" />
                  {contactLabel(event.contact_method)}
                </Button>
              );
            })()}
          </div>

          {/* Attendees list - only for creator, not bisnos */}
          {event.category !== "bisno" && isCreator && (
            <div className="space-y-3">
              <h4 className="text-body-sm font-semibold text-themed-primary">Participantes ({attendees.length})</h4>
              {loadingAttendees ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-themed-muted" />
                </div>
              ) : attendees.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {attendees.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-2 glass-panel rounded-lg">
                        <Avatar className="w-8 h-8">
                          {p.avatar_url ? (
                            <AvatarImage src={p.avatar_url} />
                          ) : null}
                          <AvatarFallback className="bg-accent-games/20 text-accent-games text-xs">
                            {(p.full_name ?? p.username ?? "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-body-sm font-medium text-themed-primary truncate">{p.full_name ?? p.username ?? "Anónimo"}</p>
                        </div>
                        <span className="text-xs text-themed-muted">{timeAgo(p.created_at)}</span>
                      </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm text-themed-muted text-center py-4">Nenhum participante ainda.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function pinIcon(category: string): L.DivIcon {
  const s = 16;
  const c = pinColors[category] ?? "#888";
  return L.divIcon({
    className: "",
    html: `<div style="width:${s}px;height:${s}px;background:${c};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`,
    iconSize: [s, s], iconAnchor: [s / 2, s / 2],
  });
}

export default function MapaPage() {
  const [activeFilter, setActiveFilter] = useState<FilterChip>("Todos");
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selLat, setSelLat] = useState<number | null>(null);
  const [selLng, setSelLng] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [routeLayer, setRouteLayer] = useState<L.Polyline | null>(null);
  const { toast } = useToast();
  const { user } = useAuthStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const userDot = useRef<L.Marker | null>(null);
  const locDot = useRef<L.Marker | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const geoDone = useRef(false);
  const initialParams = useRef<{ lat?: number; lng?: number }>({});

  const f = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: "", description: "", category: "evento", location_name: "", starts_at: "", ends_at: "" },
  });

  useEffect(() => {
    if (!containerRef.current || map.current) return;
    const m = L.map(containerRef.current, {
      center: LUANDA, zoom: 13,
      zoomControl: false, attributionControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> <a href="https://carto.com/">CARTO</a>',
    }).addTo(m);
    map.current = m;
    markers.current = L.layerGroup().addTo(m);

    m.on("click", (e: L.LeafletMouseEvent) => {
      if (!showCreate) return;
      const { lat, lng } = e.latlng;
      setSelLat(lat); setSelLng(lng);
      if (locDot.current) locDot.current.setLatLng(e.latlng);
      else locDot.current = L.marker(e.latlng, {
        icon: L.divIcon({ className: "", html: LOC_HTML, iconSize: [22, 22], iconAnchor: [11, 11] }),
      }).addTo(m);
    });

    return () => { m.remove(); map.current = null; };
  }, [showCreate]);

  function bisnoToEvent(b: BisnoItem): MapEvent {
    return {
      id: b.id, creator_id: b.creator_id, title: b.title,
      description: b.description, image_url: b.images?.[0] ?? null,
      category: "bisno", status: b.status,
      location_name: b.location_name, latitude: b.latitude, longitude: b.longitude,
      max_attendees: null, attendees_count: 0, is_attending: false,
      starts_at: null, ends_at: null, created_at: b.created_at,
      distance_km: b.distance_km,
      contact_method: b.contact_method,
      contact_value: b.contact_value,
    };
  }

  async function load(geoPos?: [number, number]) {
    setLoading(true); setError("");
    try {
      const pos = geoPos ?? userPos;
      const cat = filterCategoryMap[activeFilter];
      const onlyBisnos = cat === "bisno";
      const needsBisnos = !cat || onlyBisnos;

      const promises: Promise<any>[] = [];
      if (!onlyBisnos) {
        const eventParams: Record<string, any> = {};
        if (cat) eventParams.category = cat;
        if (pos) { eventParams.lat = pos[0]; eventParams.lon = pos[1]; }
        promises.push(eventsApi.list(eventParams));
      } else {
        promises.push(Promise.resolve([] as MapEvent[]));
      }
      promises.push(
        needsBisnos ? bisnoApi.list(pos ? { lat: pos[0], lon: pos[1] } : {}) : Promise.resolve([] as BisnoItem[])
      );

      const [eventData, bisnoData] = await Promise.all(promises);
      setEvents([...eventData, ...bisnoData.map(bisnoToEvent)]);
    } catch (e) { setError(extractApiError(e)); setEvents([]); }
    finally { setLoading(false); }
  }

  // Combined: geolocation + initial load (single fetch)
  useEffect(() => {
    if (geoDone.current) return;
    geoDone.current = true;

    const params = new URLSearchParams(window.location.search);
    const qlat = params.get("lat");
    const qlng = params.get("lng");
    if (qlat && qlng) initialParams.current = { lat: Number(qlat), lng: Number(qlng) };

    if (!navigator.geolocation) {
      load();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(p);
        load(p);
        map.current?.setView(p, 14);
        if (userDot.current) userDot.current.setLatLng(p);
        else userDot.current = L.marker(p, {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:14px;height:14px;background:#00E5FF;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(0,229,255,.3)"></div>`,
            iconSize: [14, 14], iconAnchor: [7, 7],
          }),
        }).addTo(map.current!);
      },
      () => { load(); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Refetch only when filter changes (userPos is stable after initial load)
  useEffect(() => {
    if (geoDone.current) load();
  }, [activeFilter]);

  // Fly to location from query params after data loads
  useEffect(() => {
    const p = initialParams.current;
    if (!p.lat || !p.lng || !map.current || events.length === 0) return;
    const target = events.find(e => Math.abs((e.latitude ?? 0) - p.lat!) < 0.001 && Math.abs((e.longitude ?? 0) - p.lng!) < 0.001);
    if (target) setSelectedEvent(target);
    map.current.setView([p.lat, p.lng], 15);
    L.popup()
      .setLatLng([p.lat, p.lng])
      .setContent(`<b>Localização do anúncio</b>`)
      .openOn(map.current!);
    initialParams.current = {};
  }, [events]);

  // Listen for custom event from popup
  useEffect(() => {
    const handler = (e: any) => {
      const eventId = e.detail;
      const event = events.find(ev => ev.id === eventId);
      if (event) handleOpenDetail(event);
    };
    window.addEventListener('open-event-detail', handler);
    return () => window.removeEventListener('open-event-detail', handler);
  }, [events]);

  useEffect(() => {
    if (!markers.current) return;
    markers.current.clearLayers();
    const filtered = events.filter(e =>
      search === "" ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.location_name ?? "").toLowerCase().includes(search.toLowerCase())
    );
    filtered.forEach((ev) => {
      if (!ev.latitude || !ev.longitude) return;
      L.marker([ev.latitude, ev.longitude], { icon: pinIcon(ev.category) })
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            <b style="font-size:13px">${ev.title}</b>
            <p style="font-size:11px;color:#555;margin:4px 0">${ev.description}</p>
            ${ev.location_name ? `<p style="font-size:11px;color:#888">${PIN_SVG} ${ev.location_name}</p>` : ""}
            ${ev.distance_km ? `<p style="font-size:11px;color:#888">${PIN_SVG} ${ev.distance_km} km</p>` : ""}
          </div>
        `)
        .addTo(markers.current!);
    });
  }, [events, search]);

  useEffect(() => {
    if (!showCreate) { setSelLat(null); setSelLng(null); }
  }, [showCreate]);

  async function createEvent(values: EventForm) {
    setCreating(true); setError("");
    try {
      const fd = new FormData();
      fd.append("title", values.title);
      fd.append("description", values.description);
      fd.append("category", values.category);
      if (values.location_name) fd.append("location_name", values.location_name);
      if (selLat !== null) fd.append("latitude", String(selLat));
      if (selLng !== null) fd.append("longitude", String(selLng));
      if (values.starts_at) fd.append("starts_at", new Date(values.starts_at).toISOString());
      if (values.ends_at) fd.append("ends_at", new Date(values.ends_at).toISOString());
      if (fileRef.current?.files?.[0]) fd.append("image", fileRef.current.files[0]);
      await eventsApi.create(fd);
      closeForm();
      await load();
    } catch (e) { setError(extractApiError(e)); }
    finally { setCreating(false); }
  }

  function closeForm() {
    setShowCreate(false);
    f.reset();
    setImagePreview(null);
    setSelLat(null); setSelLng(null);
    setError("");
    if (locDot.current) { locDot.current.remove(); locDot.current = null; }
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt`,
        { headers: { "User-Agent": "KalieApp/1.0" } },
      );
      const data = await res.json();
      const addr = data?.address;
      const province = addr?.state || "";
      const municipality = addr?.municipality || addr?.city || addr?.town || addr?.village || "";
      const parts = [province, municipality].filter(Boolean);
      if (parts.length) f.setValue("location_name", parts.join(", "));
    } catch { /* silencia */ }
  }

  function useGps() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setSelLat(lat); setSelLng(lng);
        if (locDot.current) locDot.current.setLatLng([lat, lng]);
        else locDot.current = L.marker([lat, lng], {
          icon: L.divIcon({ className: "", html: LOC_HTML, iconSize: [22, 22], iconAnchor: [11, 11] }),
        }).addTo(map.current!);
        map.current?.setView([lat, lng], 15);
        reverseGeocode(lat, lng);
      },
      () => { setError("Não foi possível obter localização."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function flyToEvent(ev: MapEvent) {
    if (!ev.latitude || !ev.longitude || !map.current) return;
    map.current.setView([ev.latitude, ev.longitude], 15);
    L.popup()
      .setLatLng([ev.latitude, ev.longitude])
      .setContent(`
        <div style="font-family:sans-serif;min-width:200px">
          <b style="font-size:13px">${ev.title}</b>
          <p style="font-size:11px;color:#555;margin:4px 0">${ev.description}</p>
          ${ev.location_name ? `<p style="font-size:11px;color:#888">${PIN_SVG} ${ev.location_name}</p>` : ""}
          ${ev.distance_km ? `<p style="font-size:11px;color:#888">${PIN_SVG} ${ev.distance_km} km</p>` : ""}
          <button onclick="window.dispatchEvent(new CustomEvent('open-event-detail', {detail: '${ev.id}'}))" 
            style="margin-top:8px;padding:6px 12px;background:#BF5AF2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;width:100%">
            Ver Detalhes
          </button>
        </div>
      `)
      .openOn(map.current!);
  }

  async function showRouteToEvent(ev: MapEvent) {
    if (!userPos || !ev.latitude || !ev.longitude || !map.current) return;
    
    // Remove rota anterior
    if (routeLayer) {
      map.current.removeLayer(routeLayer);
    }

    try {
      // Usar API OSRM para rota real
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${userPos[1]},${userPos[0]};${ev.longitude},${ev.latitude}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const routeCoords = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
        
        const route = L.polyline(routeCoords, {
          color: '#BF5AF2',
          weight: 5,
          opacity: 0.8,
        }).addTo(map.current);

        setRouteLayer(route);

        // Ajustar zoom para mostrar toda a rota
        const bounds = route.getBounds();
        map.current.fitBounds(bounds, { padding: [50, 50] });
      } else {
        // Fallback para linha reta se a API falhar
        const route = L.polyline([userPos, [ev.latitude, ev.longitude]], {
          color: '#BF5AF2',
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(map.current);

        setRouteLayer(route);

        const bounds = L.latLngBounds([userPos, [ev.latitude, ev.longitude]]);
        map.current.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      // Fallback para linha reta em caso de erro
      const route = L.polyline([userPos, [ev.latitude, ev.longitude]], {
        color: '#BF5AF2',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10'
      }).addTo(map.current);

      setRouteLayer(route);

      const bounds = L.latLngBounds([userPos, [ev.latitude, ev.longitude]]);
      map.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  async function handleOpenDetail(ev: MapEvent) {
    if (routeLayer && map.current) {
      map.current.removeLayer(routeLayer);
      setRouteLayer(null);
    }
    try {
      const detail = await eventsApi.get(ev.id);
      setSelectedEvent(detail);
    } catch {
      setSelectedEvent(ev);
    }
  }

  function handleCloseDetail() {
    setSelectedEvent(null);
    // Limpar rota ao fechar detalhes
    if (routeLayer && map.current) {
      map.current.removeLayer(routeLayer);
      setRouteLayer(null);
    }
  }

  async function handleAttend(ev: MapEvent) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Precisas de estar autenticado para confirmar presença.",
      });
      return;
    }

    if (ev.is_attending) {
      toast({
        variant: "destructive",
        title: "Aviso",
        description: "Já confirmaste presença neste evento.",
      });
      return;
    }

    try {
      await eventsApi.attend(ev.id);
      const updated = { ...ev, attendees_count: ev.attendees_count + 1, is_attending: true };
      setEvents(events.map(e => e.id === ev.id ? updated : e));
      setSelectedEvent(updated);
      
      // Recarregar detalhes do evento para obter lista atualizada de participantes
      if (user.id === ev.creator_id) {
        const detail = await eventsApi.get(ev.id);
        setSelectedEvent(detail);
      }
      
      toast({
        variant: "success",
        title: "Sucesso",
        description: "Presença confirmada com sucesso!",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: extractApiError(e),
      });
    }
  }

  async function handleUnattend(ev: MapEvent) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Precisas de estar autenticado para desconfirmar presença.",
      });
      return;
    }

    if (!ev.is_attending) {
      toast({
        variant: "destructive",
        title: "Aviso",
        description: "Não confirmaste presença neste evento.",
      });
      return;
    }

    try {
      await eventsApi.unattend(ev.id);
      const updated = { ...ev, attendees_count: Math.max(0, ev.attendees_count - 1), is_attending: false };
      setEvents(events.map(e => e.id === ev.id ? updated : e));
      setSelectedEvent(updated);
      
      // Recarregar detalhes do evento para obter lista atualizada de participantes
      if (user.id === ev.creator_id) {
        const detail = await eventsApi.get(ev.id);
        setSelectedEvent(detail);
      }
      
      toast({
        variant: "success",
        title: "Sucesso",
        description: "Presença desconfirmada com sucesso!",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: extractApiError(e),
      });
    }
  }

  const filtered = events.filter(e =>
    search === "" ||
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.location_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="py-6 flex flex-col gap-4" style={{ height: "calc(100vh - 80px - 48px)" }}>
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        {[
          { icon: Users, label: `${events.filter(e => e.category === "jogador").length} jogadores`, color: "text-accent-feed", bg: "bg-accent-feed/10" },
          { icon: Calendar, label: `${events.filter(e => e.category === "evento").length} eventos`, color: "text-accent-games", bg: "bg-accent-games/10" },
          { icon: Zap, label: `${events.filter(e => e.category === "bisno").length} bisnos`, color: "text-accent-bisno", bg: "bg-accent-bisno/10" },
        ].map(({ icon: Icon, label, color, bg }) => (
          <div key={label} className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border border-white/5">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", bg)}>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <span className={cn("text-body-sm font-semibold", color)}>{label}</span>
          </div>
        ))}
      </div>

      <div className={cn("flex gap-0 overflow-hidden flex-1 min-h-0 relative transition-all duration-300",
        selectedEvent ? "mr-[320px]" : "")}>
        {/* Sidebar */}
        <div className={cn("w-72 flex-shrink-0 glass-panel border-r border-white/10 flex flex-col overflow-hidden transition-all duration-300",
          showCreate && "hidden")}>
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
              const c = pinColors[ev.category] ?? "#888";
              return (
                <button key={ev.id} onClick={() => flyToEvent(ev)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/5 text-left">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10"
                    style={{ backgroundColor: c + "20" }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-themed-primary truncate">{ev.title}</p>
                    <p className="text-xs text-themed-muted">{ev.location_name ?? timeAgo(ev.created_at)}</p>
                  </div>
                  {ev.distance_km != null && ev.distance_km > 0 && <span className="text-xs text-themed-muted flex-shrink-0">{ev.distance_km.toFixed(1)} km</span>}
                </button>
              );
            })}
            {!loading && filtered.length === 0 && (
              <p className="text-themed-muted text-xs text-center py-8">Sem eventos. Cria o primeiro!</p>
            )}
          </div>
        </div>

        {/* Map + Create panel */}
        <div className="flex-1 relative flex">
          {/* Map */}
          <div className={cn("relative transition-all duration-300", showCreate ? "flex-1" : "flex-1")}>
            <div ref={containerRef} className="w-full h-full" style={{ minHeight: "400px" }} />

            <div className="absolute top-4 right-4 flex flex-col gap-1 z-[500]">
              <button onClick={() => map.current?.zoomIn()}
                className="w-10 h-10 glass-panel rounded-lg flex items-center justify-center text-themed-secondary hover:text-themed-primary hover:bg-white/10 transition-all border border-white/10">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => map.current?.zoomOut()}
                className="w-10 h-10 glass-panel rounded-lg flex items-center justify-center text-themed-secondary hover:text-themed-primary hover:bg-white/10 transition-all border border-white/10">
                <Minus className="w-4 h-4" />
              </button>
            </div>

            <div className="absolute top-4 left-4 z-[500] flex gap-2">
              <button onClick={() => map.current?.setView(userPos ?? LUANDA, 14)}
                className="glass-panel px-4 py-2 rounded-full text-body-sm text-themed-secondary hover:text-themed-primary transition-all border border-white/10 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-accent-bisno" /> Centrar
              </button>
            </div>

            {showCreate && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] glass-panel px-5 py-2.5 rounded-full text-sm text-accent-bisno border border-accent-bisno/30 whitespace-nowrap">
                Clica no mapa para definir a localização
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 glass-panel rounded-full px-4 py-2.5 flex items-center gap-3 z-[500]">
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-feed opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-feed" />
              </span>
              <Users className="w-4 h-4 text-themed-muted" />
              <span className="text-body-sm text-themed-secondary">
                <span className="text-accent-feed font-bold">{events.length}</span> eventos no mapa
              </span>
            </div>
          </div>

          {/* Create event panel */}
          {showCreate && (
            <div className="w-96 flex-shrink-0 glass-panel border-l border-white/10 flex flex-col overflow-y-auto">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-h3 font-space-grotesk text-themed-primary">Criar Evento</h3>
                <button onClick={closeForm} className="w-8 h-8 rounded-full glass-panel flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-themed-muted" />
                </button>
              </div>

              <div className="flex-1 p-5">
                <form onSubmit={f.handleSubmit(createEvent)} className="flex flex-col gap-4">
                  {/* Upload */}
                  <div>
                    <div className="w-full h-24 glass-panel border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-games/50 transition-colors overflow-hidden"
                      onClick={() => fileRef.current?.click()}>
                      {imagePreview ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" /> :
                        <><Upload className="w-4 h-4 text-themed-muted mb-1" /><span className="text-xs text-themed-muted">Imagem (opcional)</span></>}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f2 = e.target.files?.[0]; if (f2) setImagePreview(URL.createObjectURL(f2)); }} />
                  </div>

                  {/* Título */}
                  <div>
                    <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Título</label>
                    <input {...f.register("title")}
                      className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-sm text-themed-primary outline-none focus:border-accent-games/50"
                      placeholder="Nome do evento" />
                    {f.formState.errors.title && <p className="text-accent-sos text-xs mt-1">{f.formState.errors.title.message}</p>}
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Descrição</label>
                    <textarea {...f.register("description")}
                      className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-sm text-themed-primary outline-none focus:border-accent-games/50 resize-none h-16"
                      placeholder="Descreve o evento..." />
                    {f.formState.errors.description && <p className="text-accent-sos text-xs mt-1">{f.formState.errors.description.message}</p>}
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Categoria</label>
                    <select {...f.register("category")}
                      className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-sm text-themed-primary outline-none focus:border-accent-games/50 bg-transparent">
                      {["evento", "bisno", "torneio", "outro"].map(c => (
                        <option key={c} value={c} className="bg-zinc-900">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Localização */}
                  <div>
                    <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Localização</label>
                    <div className="space-y-2">
                      <input {...f.register("location_name")}
                        className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-sm text-themed-primary outline-none focus:border-accent-games/50"
                        placeholder="Ex: Talatona, Luanda" />

                      <div className="flex gap-2">
                        <button type="button" onClick={useGps}
                          className="flex-1 flex items-center justify-center gap-1.5 glass-panel border border-white/10 rounded-xl px-3 py-2 text-xs text-themed-secondary hover:bg-white/5 transition-colors">
                          <Navigation className="w-3.5 h-3.5 text-accent-bisno" /> GPS
                        </button>
                        <span className={cn("flex-1 flex items-center justify-center gap-1.5 glass-panel border rounded-xl px-3 py-2 text-xs transition-colors",
                          selLat !== null ? "border-accent-games/50 text-accent-games bg-accent-games/10" : "border-white/10 text-themed-secondary")}>
                          <MapPin className="w-3.5 h-3.5" />
                          {selLat !== null ? "Definida" : "Clica no mapa"}
                        </span>
                      </div>

                      {selLat !== null && (
                        <p className="text-[10px] text-themed-muted flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {selLat.toFixed(4)}, {selLng?.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Data/hora */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Início</label>
                      <input type="datetime-local" {...f.register("starts_at")}
                        className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-sm text-themed-primary outline-none focus:border-accent-games/50" />
                    </div>
                    <div>
                      <label className="text-label-caps text-themed-muted uppercase text-xs mb-1 block">Fim</label>
                      <input type="datetime-local" {...f.register("ends_at")}
                        className="w-full glass-panel border border-white/10 rounded-xl px-4 py-3 text-sm text-themed-primary outline-none focus:border-accent-games/50" />
                    </div>
                  </div>

                  {error && <p className="text-accent-sos text-sm">{error}</p>}

                  <Button type="submit" className="w-full bg-accent-games text-white hover:brightness-110 mt-2" disabled={creating}>
                    {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Criar Evento
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event detail side panel */}
      {selectedEvent && (
        <EventDetailPanel 
          event={selectedEvent} 
          onClose={handleCloseDetail}
          onRoute={() => showRouteToEvent(selectedEvent)}
          onAttend={() => handleAttend(selectedEvent)}
          onUnattend={() => handleUnattend(selectedEvent)}
        />
      )}
    </div>
  );
}

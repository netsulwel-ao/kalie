import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Car, Flame, ShieldAlert, Heart, Baby, HelpCircle, X, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import MapPicker from "@/components/ui/MapPicker";
import { sosApi } from "@/services/modules";
import { extractApiError } from "@/services/api";
import { useSOSStore } from "@/stores/sosStore";

const categories = [
  { icon: Car,         label: "Acidente",          value: "acidente",          color: "text-accent-sos",   bg: "bg-accent-sos/10"   },
  { icon: Flame,       label: "Incêndio",          value: "incendio",          color: "text-accent-gold",  bg: "bg-accent-gold/10"  },
  { icon: ShieldAlert, label: "Assalto",           value: "assalto",           color: "text-accent-sos",   bg: "bg-accent-sos/10"   },
  { icon: Heart,       label: "Emergência Médica", value: "emergencia_medica", color: "text-red-400",      bg: "bg-red-400/10"      },
  { icon: Baby,        label: "Criança Perdida",   value: "crianca_perdida",   color: "text-accent-bisno", bg: "bg-accent-bisno/10" },
  { icon: HelpCircle,  label: "Outro",             value: "outro",             color: "text-zinc-400",     bg: "bg-white/5"         },
];

export default function SOSQuickModal() {
  const { showQuickModal, closeQuickModal } = useSOSStore();
  const [category, setCategory] = useState("acidente");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const countdownStartedRef = useRef(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    if (showQuickModal && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  }, [showQuickModal]);

  function startCountdown() {
    countdownStartedRef.current = true;
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (!countdownStartedRef.current) return;
    if (countdown !== null || submitting) return;
    sendAlert();
  }, [countdown]);

  async function sendAlert() {
    setSubmitting(true); setError("");
    try {
      if ("geolocation" in navigator) {
        const pos = await new Promise<GeolocationPosition>((resolve) =>
          navigator.geolocation.getCurrentPosition(resolve, () => {}, { enableHighAccuracy: true, timeout: 8000 }),
        );
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
      }
    } catch {}
    try {
      const fd = new FormData();
      fd.append("category", category);
      if (coords) {
        fd.append("latitude", String(coords.lat));
        fd.append("longitude", String(coords.lng));
      }
      await sosApi.alerts.create(fd);
      closeQuickModal();
    } catch (e) { setError(extractApiError(e)); }
    finally { setSubmitting(false); setCountdown(null); }
  }

  function handleClose() {
    clearInterval(countdownRef.current);
    countdownStartedRef.current = false;
    setCountdown(null);
    closeQuickModal();
  }

  if (!showQuickModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="glass-panel luminous-edge rounded-2xl p-6 w-full max-w-sm border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-space-grotesk font-bold text-themed-primary flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-accent-sos" />
            SOS Emergência
          </h3>
          <button onClick={handleClose}><X className="w-5 h-5 text-themed-muted" /></button>
        </div>

        {coords && (
          <div className="mb-3">
            <p className="text-xs text-accent-feed flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Localização detectada{coords.accuracy ? ` (±${coords.accuracy}m)` : ""}
            </p>
            <button onClick={() => setShowMapPicker(!showMapPicker)}
              className="text-[11px] text-accent-feed hover:underline mt-1">
              {showMapPicker ? "Fechar mapa" : "Ajustar no mapa"}
            </button>
            {showMapPicker && coords && (
              <div className="mt-2">
                <MapPicker
                  lat={coords.lat}
                  lng={coords.lng}
                  onLocationChange={(lat, lng) => setCoords(prev => prev ? { ...prev, lat, lng } : { lat, lng })}
                />
              </div>
            )}
          </div>
        )}

        {countdown !== null ? (
          <div className="text-center py-6">
            <p className="text-6xl font-black text-accent-sos animate-pulse">{countdown}</p>
            <p className="text-sm text-themed-muted mt-3">A enviar alerta...</p>
            <button onClick={() => { clearInterval(countdownRef.current); setCountdown(null); }}
              className="text-xs text-themed-muted hover:text-accent-sos underline mt-4">Cancelar</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-themed-muted mb-3">Selecciona o tipo de emergência:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {categories.map(({ icon: Icon, label, value, color, bg }) => (
                <button key={value} onClick={() => setCategory(value)}
                  className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                    category === value ? "border-white/30 bg-white/10" : "border-white/5 hover:border-white/15", color, bg)}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-accent-sos text-xs mb-3">{error}</p>}
            <a href="tel:111"
              className="block text-center text-xs text-accent-feed mb-3 hover:underline">
              Ligar para CISP (111)
            </a>
            <Button className="w-full bg-accent-sos text-white hover:brightness-110"
              onClick={startCountdown} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Enviar Alerta SOS
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

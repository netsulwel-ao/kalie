import { Car, Flame, ShieldAlert, Heart, Baby, HelpCircle, AlertTriangle, UserX, Package } from "lucide-react";

export const emergencyCategories = [
  { icon: Car,         label: "Acidente",          value: "acidente",          color: "text-accent-sos",   bg: "bg-accent-sos/10"   },
  { icon: Flame,       label: "Incêndio",          value: "incendio",          color: "text-accent-gold",  bg: "bg-accent-gold/10"  },
  { icon: ShieldAlert, label: "Assalto",           value: "assalto",           color: "text-accent-sos",   bg: "bg-accent-sos/10"   },
  { icon: Heart,       label: "Emergência Médica", value: "emergencia_medica", color: "text-red-400",      bg: "bg-red-400/10"      },
  { icon: Baby,        label: "Criança Perdida",   value: "crianca_perdida",   color: "text-accent-bisno", bg: "bg-accent-bisno/10" },
  { icon: HelpCircle,  label: "Outro",             value: "outro",             color: "text-zinc-400",     bg: "bg-white/5"         },
];

export const categoryContact: Record<string, { label: string; number: string }> = {
  acidente:          { label: "CISP", number: "111" },
  incendio:          { label: "CISP", number: "111" },
  assalto:           { label: "CISP", number: "111" },
  emergencia_medica: { label: "CISP", number: "111" },
  crianca_perdida:   { label: "CISP", number: "111" },
  outro:             { label: "CISP", number: "111" },
};

export const contacts = [
  { label: "CISP", number: "111", icon: ShieldAlert, color: "text-accent-sos" },
];

export type SOSTab = "alertas" | "desaparecidos" | "achados" | "campanhas";

export const SOSTabs: { id: SOSTab; label: string; icon: React.ElementType }[] = [
  { id: "alertas",       label: "Alertas",           icon: AlertTriangle },
  { id: "desaparecidos", label: "Desaparecidos",      icon: UserX         },
  { id: "achados",       label: "Achados e Perdidos", icon: Package       },
  { id: "campanhas",     label: "Campanhas",          icon: Heart         },
];

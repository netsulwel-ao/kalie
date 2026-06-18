import { AlertTriangle } from "lucide-react";

interface SOSButtonProps {
  onClick?: () => void;
}

export default function SOSButton({ onClick }: SOSButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-8 w-16 h-16 bg-accent-sos rounded-full flex items-center justify-center z-50 animate-pulse-sos group active:scale-90 transition-transform shadow-glow-sos"
      aria-label="SOS — Emergência"
      title="SOS"
    >
      <AlertTriangle className="w-7 h-7 text-white transition-transform group-hover:scale-110" />
    </button>
  );
}

import { useEffect, useState } from "react";

interface CountdownTextProps {
  targetDate: string;
  fallback?: string;
  prefix?: string;
}

export function CountdownText({ targetDate, fallback = "Terminado", prefix = "" }: CountdownTextProps) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setRemaining(fallback); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setRemaining(`${d}d ${h}h ${m}m ${s}s`);
      else if (h > 0) setRemaining(`${h}h ${m}m ${s}s`);
      else setRemaining(`${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate, fallback]);

  return <>{prefix}{remaining}</>;
}

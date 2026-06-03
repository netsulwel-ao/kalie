import { NavLink } from "react-router-dom";
import { Home, Zap, Plus, Gamepad2, Map } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 w-full glass-panel-light border-t border-white/10 py-3 px-6 flex justify-between items-center md:hidden z-50">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          cn("flex flex-col items-center gap-1", isActive ? "text-white" : "text-zinc-500")
        }
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-bold">{t("nav.feed")}</span>
      </NavLink>

      <NavLink
        to="/bisno"
        className={({ isActive }) =>
          cn("flex flex-col items-center gap-1", isActive ? "text-white" : "text-zinc-500")
        }
      >
        <Zap className="w-5 h-5" />
        <span className="text-[10px]">{t("nav.bisno")}</span>
      </NavLink>

      {/* Center FAB */}
      <div className="relative -top-6">
        <button className="w-14 h-14 bg-white text-zinc-950 rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform">
          <Plus className="w-7 h-7" />
        </button>
      </div>

      <NavLink
        to="/jogos"
        className={({ isActive }) =>
          cn("flex flex-col items-center gap-1", isActive ? "text-white" : "text-zinc-500")
        }
      >
        <Gamepad2 className="w-5 h-5" />
        <span className="text-[10px]">{t("nav.games")}</span>
      </NavLink>

      <NavLink
        to="/mapa"
        className={({ isActive }) =>
          cn("flex flex-col items-center gap-1", isActive ? "text-white" : "text-zinc-500")
        }
      >
        <Map className="w-5 h-5" />
        <span className="text-[10px]">{t("nav.explore")}</span>
      </NavLink>
    </nav>
  );
}

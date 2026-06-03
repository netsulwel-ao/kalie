import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Gamepad2,
  Wallet,
  Zap,
  Map,
  AlertTriangle,
  Settings,
  HelpCircle,
  ChevronRight,
  Ticket,
  Gavel,
  Trophy,
  LogOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSideNav } from "./AppLayout";
import { useAuthStore } from "@/stores/authStore";

const navItems = [
  { to: "/",         icon: Home,        label: "nav.feed",       exact: true  },
  { to: "/jogos",    icon: Gamepad2,    label: "nav.games"                    },
  { to: "/torneios", icon: Trophy,      label: "nav.tournaments"              },
  { to: "/rifas",    icon: Ticket,      label: "nav.raffles"                  },
  { to: "/leiloes",  icon: Gavel,       label: "nav.auctions"                 },
  { to: "/carteira", icon: Wallet,      label: "nav.wallet"                   },
  { to: "/bisno",    icon: Zap,         label: "nav.bisno"                    },
  { to: "/mapa",     icon: Map,         label: "nav.explore"                  },
  { to: "/sos",      icon: AlertTriangle, label: "nav.sos",      accent: "text-accent-sos" },
];

// Expõe a largura actual para o AppLayout ajustar o padding
export const SIDENAV_COLLAPSED_W = "w-20";
export const SIDENAV_EXPANDED_W  = "w-56";

export default function SideNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { expanded, setExpanded } = useSideNav();
  const { logout } = useAuthStore();

  function handleLogout() {
    if (confirm("Tens a certeza que queres terminar a sessão?")) {
      logout();
      navigate("/entrar");
    }
  }

  return (
    <nav
      className={cn(
        "fixed left-0 top-0 h-full hidden md:flex flex-col py-20 z-40",
        "sidebar-themed",
        "shadow-[20px_0_40px_rgba(0,0,0,0.2)]",
        "transition-all duration-300 ease-in-out",
        expanded ? "rounded-r-[32px]" : "rounded-r-[40px]",
        expanded ? SIDENAV_EXPANDED_W : SIDENAV_COLLAPSED_W,
      )}
    >
      {/* ── Nav items ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 flex-1 px-2 mt-4">
        {navItems.map(({ to, icon: Icon, label, exact, accent }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            title={expanded ? undefined : t(label)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl",
                "transition-all duration-200 group",
                isActive
                  ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.08)] border border-white/15"
                  : cn("text-zinc-500 hover:text-zinc-200 hover:bg-white/5", accent),
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0 transition-transform duration-200",
                    !isActive && "group-hover:translate-x-0.5",
                  )}
                />
                {/* Label — só visível quando expandido */}
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap overflow-hidden",
                    "transition-all duration-300",
                    expanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0",
                  )}
                >
                  {t(label)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* ── Bottom: settings + help + toggle ─────────────────── */}
      <div className="flex flex-col gap-1 px-2 mb-4">
        <NavLink
          to="/definicoes"
          title={expanded ? undefined : t("nav.settings")}
          className="flex items-center gap-3 px-3 py-3 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all group"
        >
          <Settings className="w-5 h-5 flex-shrink-0 group-hover:rotate-45 transition-transform duration-300" />
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300",
              expanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0",
            )}
          >
            {t("nav.settings")}
          </span>
        </NavLink>

        <NavLink
          to="/ajuda"
          title={expanded ? undefined : t("nav.help")}
          className="flex items-center gap-3 px-3 py-3 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all group"
        >
          <HelpCircle className="w-5 h-5 flex-shrink-0" />
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300",
              expanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0",
            )}
          >
            {t("nav.help")}
          </span>
        </NavLink>

        {/* ── Logout ───────────────────────────────────────── */}
        <button
          onClick={handleLogout}
          title={expanded ? undefined : "Terminar sessão"}
          className="flex items-center gap-3 px-3 py-3 rounded-xl w-full text-accent-sos/70 hover:text-accent-sos hover:bg-accent-sos/5 transition-all group"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className={cn(
            "text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300",
            expanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0",
          )}>
            Sair
          </span>
        </button>

        {/* ── Toggle expand/collapse ────────────────────────── */}
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Colapsar menu" : "Expandir menu"}
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl w-full",
            "text-zinc-400 hover:text-white hover:bg-white/5",
            "transition-all duration-200 group mt-1",
            "border border-white/5 hover:border-white/15",
          )}
        >
          <ChevronRight
            className={cn(
              "w-5 h-5 flex-shrink-0 transition-transform duration-300",
              expanded && "rotate-180",
            )}
          />
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300",
              expanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0",
            )}
          >
            Colapsar
          </span>
        </button>
      </div>
    </nav>
  );
}

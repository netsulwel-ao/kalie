import { useState } from "react";
import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import SideNav from "./SideNav";
import BottomNav from "./BottomNav";
import SOSButton from "@/components/ui/SOSButton";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";

// Contexto leve — partilha o estado expanded entre SideNav e AppLayout
import { createContext, useContext } from "react";

interface SideNavCtx {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}

export const SideNavContext = createContext<SideNavCtx>({
  expanded: false,
  setExpanded: () => {},
});

export function useSideNav() {
  return useContext(SideNavContext);
}

export default function AppLayout() {
  const [expanded, setExpanded] = useState(false);

  return (
    <SideNavContext.Provider value={{ expanded, setExpanded }}>
      <div className="min-h-screen bg-surface text-on-surface">
        <TopBar />
        <SideNav />

        {/* Conteúdo principal — padding-left acompanha a largura do menu */}
        <main
          className={cn(
            "pt-20 pb-20 md:pb-0 min-h-screen",
            "transition-all duration-300 ease-in-out",
            expanded ? "md:pl-56" : "md:pl-20",
          )}
        >
          <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
            <Outlet />
          </div>
        </main>

        <BottomNav />
        <SOSButton />
        <Toaster />
      </div>
    </SideNavContext.Provider>
  );
}

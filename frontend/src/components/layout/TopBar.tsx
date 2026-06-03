import { Bot, Search } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NotificationBell from "@/components/ui/NotificationBell";

export default function TopBar() {
  const { user } = useAuthStore();

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-4 header-themed h-20">
      {/* Left: Logo + Search */}
      <div className="flex items-center gap-6">
        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500 font-space-grotesk tracking-tight">
          Kalie
        </span>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted w-4 h-4" />
          <input
            className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all outline-none w-64 text-themed-primary placeholder:text-themed-muted input-themed"
            placeholder="Pesquisar módulos..."
            type="text"
          />
        </div>
      </div>

      {/* Right: Actions + Avatar */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell />
        <button className="p-2 text-zinc-100 hover:bg-white/5 transition-all rounded-full active:scale-95">
          <Bot className="w-5 h-5" />
        </button>
        <Avatar className="w-9 h-9 border border-white/20 cursor-pointer ml-1">
          <AvatarImage src={user?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-white/10 text-white text-sm font-bold">
            {user?.full_name?.charAt(0).toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

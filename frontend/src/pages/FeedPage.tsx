import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Home, Gamepad2, Trophy, Ticket, Gavel, Wallet, Zap, Map, AlertTriangle,
  Settings, HelpCircle, LogOut,
  ImageIcon, PlusCircle, Heart, MessageCircle, Share2, Loader2, Send,
  CalendarDays, Cake, Users, Circle, MessageSquareText,
} from "lucide-react";
import api, { extractApiError } from "@/services/api";
import { eventsApi, type MapEvent } from "@/services/modules";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/dateUtils";

// ── Types ────────────────────────────────────────────────────────────────────
interface Author {
  id: string; username: string; full_name: string; avatar_url: string | null;
}
interface PostData {
  id: string; content: string; image_url: string | null;
  likes_count: number; comments_count: number; liked_by_me: boolean;
  created_at: string; author: Author;
}

// ── Navigation config ────────────────────────────────────────────────────────
const navItems = [
  { to: "/feed",     icon: Home,        label: "nav.feed",       exact: true  },
  { to: "/jogos",    icon: Gamepad2,    label: "nav.games"                    },
  { to: "/torneios", icon: Trophy,      label: "nav.tournaments"              },
  { to: "/rifas",    icon: Ticket,      label: "nav.raffles"                  },
  { to: "/leiloes",  icon: Gavel,       label: "nav.auctions"                 },
  { to: "/carteira", icon: Wallet,      label: "nav.wallet"                   },
  { to: "/bisno",    icon: Zap,         label: "nav.bisno"                    },
  { to: "/mapa",     icon: Map,         label: "nav.explore"                  },
  { to: "/sos",      icon: AlertTriangle, label: "nav.sos"                     },
];

const bottomNavItems = [
  { to: "/definicoes", icon: Settings, label: "nav.settings" },
  { to: "/ajuda",      icon: HelpCircle, label: "nav.help" },
];

// ── Post card ────────────────────────────────────────────────────────────────
function PostCard({ post, onLike }: { post: PostData; onLike: (id: string) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const { user } = useAuthStore();

  async function loadComments() {
    if (showComments) { setShowComments(false); return; }
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/feed/${post.id}/comments`);
      setComments(data);
      setShowComments(true);
    } finally {
      setLoadingComments(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const { data } = await api.post(`/feed/${post.id}/comments`, { content: commentText });
    setComments((prev) => [...prev, data]);
    setCommentText("");
  }

  return (
    <div className="glass-panel luminous-edge rounded-xl overflow-hidden">
      <div className="p-5 flex gap-3">
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={post.author.avatar_url ?? undefined} />
          <AvatarFallback className="bg-accent-bisno/20 text-accent-bisno font-bold text-sm">
            {post.author.full_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-body-sm font-bold text-themed-primary">
            {post.author.full_name}
            <span className="font-normal text-themed-muted ml-2">@{post.author.username}</span>
          </p>
          <p className="text-xs text-themed-muted">{formatDistanceToNow(post.created_at)}</p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <p className="text-body-md text-themed-secondary leading-relaxed">{post.content}</p>
        {post.image_url && (
          <img src={post.image_url} alt="" className="mt-3 w-full rounded-xl object-cover max-h-80 border border-white/5" />
        )}
      </div>

      <div className="px-5 py-3 border-t border-white/5 flex gap-5">
        <button
          onClick={() => onLike(post.id)}
          className={cn("flex items-center gap-1.5 transition-colors text-body-sm",
            post.liked_by_me ? "text-red-400" : "text-themed-muted hover:text-red-400")}
        >
          <Heart className={cn("w-4 h-4", post.liked_by_me && "fill-red-400")} />
          {post.likes_count}
        </button>
        <button
          onClick={loadComments}
          className="flex items-center gap-1.5 text-themed-muted hover:text-themed-primary transition-colors text-body-sm"
        >
          {loadingComments ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          {post.comments_count}
        </button>
        <button className="flex items-center gap-1.5 text-themed-muted hover:text-themed-primary transition-colors text-body-sm ml-auto">
          <Share2 className="w-4 h-4" />
          Partilhar
        </button>
      </div>

      {showComments && (
        <div className="border-t border-white/5 px-5 py-4 flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarImage src={c.author.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs bg-white/10">{c.author.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-white/5 rounded-xl px-3 py-2">
                <p className="text-xs font-bold text-themed-primary">{c.author.full_name}</p>
                <p className="text-xs text-themed-secondary mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
          <form onSubmit={submitComment} className="flex gap-2 mt-1">
            <Avatar className="w-7 h-7 flex-shrink-0">
              <AvatarImage src={user?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs bg-white/10">{user?.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 input-themed rounded-full px-4 py-1.5 text-xs"
              placeholder="Escreve um comentário..."
            />
            <button type="submit" className="text-accent-bisno hover:brightness-110 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Left sidebar ─────────────────────────────────────────────────────────────
function FeedLeftSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  function handleLogout() {
    if (confirm("Tens a certeza que queres terminar a sessão?")) {
      logout();
      navigate("/entrar");
    }
  }

  return (
    <aside className="hidden md:flex flex-col h-full sticky top-20 py-6">
      {/* Profile card */}
      <div className="glass-panel rounded-xl p-4 mb-4 text-center">
        <Avatar className="w-12 h-12 mx-auto mb-2 border-2 border-accent-bisno/30">
          <AvatarImage src={undefined} />
          <AvatarFallback className="bg-accent-bisno/20 text-accent-bisno font-bold">U</AvatarFallback>
        </Avatar>
        <p className="text-body-sm font-bold text-themed-primary truncate">Utilizador</p>
        <p className="text-xs text-themed-muted truncate">@username</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact ?? false}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.08)] border border-white/15"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5",
              )
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{t(label)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="flex flex-col gap-1 pt-2 mt-2 border-t border-white/5">
        {bottomNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.08)] border border-white/15"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5",
              )
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{t(label)}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-accent-sos/70 hover:text-accent-sos hover:bg-accent-sos/5 transition-all"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}

// ── Right sidebar widget sections ────────────────────────────────────────────

function WidgetHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-accent-bisno" />
      <h4 className="text-body-sm font-bold text-themed-primary">{title}</h4>
    </div>
  );
}

function EventsWidget() {
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsApi.list().then(setEvents).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div className="glass-panel rounded-xl p-4">
      <WidgetHeader icon={CalendarDays} title="Eventos Próximos" />
      <div className="flex flex-col gap-2">
        {events.length === 0 ? (
          <p className="text-xs text-themed-muted text-center py-2">Nenhum evento próximo</p>
        ) : (
          events.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-accent-bisno/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent-bisno">
                  {event.starts_at ? new Date(event.starts_at).getDate() : "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-semibold text-themed-primary truncate">{event.title}</p>
                <p className="text-xs text-themed-muted truncate">{event.location_name ?? "Angola"}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AdsWidget() {
  const ads = [
    { id: "1", title: "Anuncia aqui", subtitle: "Chega a milhares de utilizadores", color: "from-accent-bisno/20 to-accent-games/10" },
    { id: "2", title: "Kalie Pro", subtitle: "Desbloqueia funcionalidades exclusivas", color: "from-accent-gold/20 to-accent-bisno/10" },
  ];

  return (
    <div className="flex flex-col gap-2">
      {ads.map((ad) => (
        <div key={ad.id} className={cn("glass-panel rounded-xl p-4 cursor-pointer hover:brightness-110 transition-all bg-gradient-to-br", ad.color)}>
          <p className="text-body-sm font-bold text-themed-primary">{ad.title}</p>
          <p className="text-xs text-themed-muted">{ad.subtitle}</p>
        </div>
      ))}
    </div>
  );
}

function BirthdaysWidget() {
  const birthdays: { id: string; name: string; avatar: string | null }[] = [
    { id: "1", name: "Maria Santos", avatar: null },
    { id: "2", name: "João Pedro", avatar: null },
    { id: "3", name: "Ana Costa", avatar: null },
  ];

  return (
    <div className="glass-panel rounded-xl p-4">
      <WidgetHeader icon={Cake} title="Aniversariantes" />
      <div className="flex flex-col gap-2">
        {birthdays.length === 0 ? (
          <p className="text-xs text-themed-muted text-center py-2">Nenhum aniversário hoje</p>
        ) : (
          birthdays.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="text-xs bg-accent-gold/20 text-accent-gold">{b.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="text-body-sm text-themed-primary">{b.name}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GroupsWidget() {
  const groups: { id: string; name: string; members: number }[] = [
    { id: "1", name: "Devs Angola", members: 1240 },
    { id: "2", name: "Kalie Creators", members: 856 },
    { id: "3", name: "Gaming Angola", members: 2301 },
  ];

  return (
    <div className="glass-panel rounded-xl p-4">
      <WidgetHeader icon={Users} title="Grupos" />
      <div className="flex flex-col gap-2">
        {groups.map((g) => (
          <div key={g.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-accent-feed/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-3.5 h-3.5 text-accent-feed" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-medium text-themed-primary truncate">{g.name}</p>
              <p className="text-xs text-themed-muted">{g.members.toLocaleString()} membros</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactsWidget() {
  const contacts = [
    { id: "1", name: "Tânia Ramos", online: true },
    { id: "2", name: "Miguel Gomes", online: true },
    { id: "3", name: "Sofia Lima", online: false },
    { id: "4", name: "Carlos Mendes", online: true },
    { id: "5", name: "Beatriz Dias", online: false },
  ];

  return (
    <div className="glass-panel rounded-xl p-4">
      <WidgetHeader icon={Circle} title="Contactos Online" />
      <div className="flex flex-col gap-1.5">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
            <div className="relative">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="text-xs bg-white/10">{c.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {c.online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-feed rounded-full border-2 border-surface" />
              )}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <p className="text-body-sm text-themed-primary truncate">{c.name}</p>
              {c.online && <span className="text-xs text-accent-feed">●</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesWidget() {
  const messages = [
    { id: "1", user: "Tânia Ramos", preview: "Vamos marcar o encontro?", time: "5m", unread: true },
    { id: "2", user: "Miguel Gomes", preview: "Obrigado pela ajuda!", time: "15m", unread: false },
    { id: "3", user: "Sofia Lima", preview: "Gostei da tua publicação", time: "1h", unread: true },
    { id: "4", user: "Carlos Mendes", preview: "Quando é o próximo torneio?", time: "2h", unread: false },
  ];

  return (
    <div className="glass-panel rounded-xl p-4">
      <WidgetHeader icon={MessageSquareText} title="Mensagens" />
      <div className="flex flex-col gap-1.5">
        {messages.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
            <Avatar className="w-7 h-7 flex-shrink-0">
              <AvatarFallback className={cn("text-xs", m.unread ? "bg-accent-bisno/20 text-accent-bisno" : "bg-white/10")}>
                {m.user.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={cn("text-body-sm truncate", m.unread ? "font-bold text-themed-primary" : "text-themed-secondary")}>{m.user}</p>
                <span className="text-xs text-themed-muted ml-auto flex-shrink-0">{m.time}</span>
              </div>
              <p className={cn("text-xs truncate", m.unread ? "text-themed-primary" : "text-themed-muted")}>{m.preview}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FeedRightSidebar ──────────────────────────────────────────────────────────
function FeedRightSidebar() {
  return (
    <aside className="hidden lg:flex flex-col gap-4 sticky top-20 py-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <EventsWidget />
      <AdsWidget />
      <BirthdaysWidget />
      <GroupsWidget />
      <ContactsWidget />
      <MessagesWidget />
    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [content, setContent] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadFeed(1); }, []);

  async function loadFeed(p: number) {
    setLoading(true);
    try {
      const { data } = await api.get(`/feed?page=${p}&limit=20`);
      if (p === 1) setPosts(data.posts);
      else setPosts((prev) => [...prev, ...data.posts]);
      setHasMore(data.has_more);
      setPage(p);
    } catch {
      // show empty state
    } finally {
      setLoading(false);
    }
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post("/feed", { content });
      setPosts((prev) => [data, ...prev]);
      setContent("");
    } catch (err) {
      alert(extractApiError(err));
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(postId: string) {
    try {
      const { data } = await api.post(`/feed/${postId}/like`);
      setPosts((prev) => prev.map((p) =>
        p.id === postId ? { ...p, liked_by_me: data.liked, likes_count: data.likes_count } : p
      ));
    } catch { /* ignore */ }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 xl:gap-6 py-4 md:py-6">

      {/* ── Left: Navigation sidebar ─────────────────────────── */}
      <div className="md:col-span-3 xl:col-span-2">
        <FeedLeftSidebar />
      </div>

      {/* ── Center: Feed ──────────────────────────────────────── */}
      <section className="md:col-span-9 xl:col-span-7 flex flex-col gap-4">

        {/* Compositor */}
        <div className="glass-panel luminous-edge rounded-xl p-5">
          <form onSubmit={submitPost}>
            <div className="flex gap-3">
              <Avatar className="w-10 h-10 border border-white/10 flex-shrink-0">
                <AvatarImage src={user?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-white/10 text-themed-primary font-bold text-sm">
                  {user?.full_name?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-body-md text-themed-primary resize-none placeholder:text-themed-muted outline-none min-h-[60px]"
                placeholder={t("feed.placeholder")}
                rows={2}
              />
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-3">
              <div className="flex gap-2">
                <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel-light hover:bg-white/10 transition-all text-body-sm text-themed-muted">
                  <ImageIcon className="w-4 h-4" /> Media
                </button>
                <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel-light hover:bg-white/10 transition-all text-body-sm text-themed-muted">
                  <PlusCircle className="w-4 h-4" /> Módulo
                </button>
              </div>
              <Button type="submit" size="sm" loading={posting} disabled={!content.trim()}>
                {t("feed.post")}
              </Button>
            </div>
          </form>
        </div>

        {/* Posts */}
        {loading && page === 1 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-themed-muted" />
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel rounded-xl p-12 text-center">
            <MessageCircle className="w-12 h-12 text-themed-muted mx-auto mb-4" />
            <h3 className="text-h3 font-space-grotesk text-themed-primary mb-2">Sem publicações ainda</h3>
            <p className="text-themed-muted">Sê o primeiro a publicar algo.</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} />
            ))}
            {hasMore && (
              <Button variant="glass" className="w-full" onClick={() => loadFeed(page + 1)} loading={loading}>
                Carregar mais
              </Button>
            )}
          </>
        )}
      </section>

      {/* ── Right: Widgets sidebar ─────────────────────────────── */}
      <div className="hidden lg:block lg:col-span-3 xl:col-span-3">
        <FeedRightSidebar />
      </div>
    </div>
  );
}

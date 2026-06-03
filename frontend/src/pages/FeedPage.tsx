import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ImageIcon, PlusCircle, Heart, MessageCircle,
  Share2, TrendingUp, Zap, Send, X, Loader2,
} from "lucide-react";
import api, { extractApiError } from "@/services/api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/dateUtils";

interface Author {
  id: string; username: string; full_name: string; avatar_url: string | null;
}
interface PostData {
  id: string; content: string; image_url: string | null;
  likes_count: number; comments_count: number; liked_by_me: boolean;
  created_at: string; author: Author;
}

// ── Post card ─────────────────────────────────────────────────────────────────
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
      {/* Author */}
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

      {/* Content */}
      <div className="px-5 pb-4">
        <p className="text-body-md text-themed-secondary leading-relaxed">{post.content}</p>
        {post.image_url && (
          <img src={post.image_url} alt="" className="mt-3 w-full rounded-xl object-cover max-h-80 border border-white/5" />
        )}
      </div>

      {/* Actions */}
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

      {/* Comments */}
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
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">

      {/* ── Feed central ──────────────────────────────────────────── */}
      <section className="md:col-span-8 flex flex-col gap-4">

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

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="md:col-span-4 flex flex-col gap-4">
        <div className="glass-panel luminous-edge rounded-xl p-5 sticky top-24">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-accent-feed" />
            <h3 className="text-h3 font-space-grotesk text-themed-primary">{t("feed.trending")}</h3>
          </div>
          <div className="flex flex-col gap-4 mb-6">
            {[
              { tag: "#KalieApp",      posts: "45,2k" },
              { tag: "#AngolaDigital", posts: "28,1k" },
              { tag: "#KalieGames",    posts: "12,8k" },
            ].map(({ tag, posts }) => (
              <div key={tag} className="group cursor-pointer">
                <p className="text-label-caps text-themed-muted uppercase">Angola · Trending</p>
                <p className="text-body-md font-bold text-themed-primary group-hover:text-accent-bisno transition-colors">{tag}</p>
                <p className="text-body-sm text-themed-muted">{posts} publicações</p>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-accent-bisno" />
              <h3 className="text-body-md font-bold text-themed-primary">{t("feed.active_bisnos")}</h3>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: "Entrega de Compras",   price: "1.500 AOA", dist: "2,1 km" },
                { label: "Transporte Aeroporto", price: "4.000 AOA", dist: "15 min" },
                { label: "Correcção de Código",  price: "2.500 AOA", dist: "Remoto" },
              ].map(({ label, price, dist }) => (
                <div key={label} className="glass-panel-light p-3 rounded-xl flex justify-between items-center hover:bg-white/10 transition-colors cursor-pointer">
                  <p className="text-body-sm font-semibold text-themed-primary">{label}</p>
                  <div className="text-right">
                    <p className="text-body-sm font-bold text-accent-bisno">{price}</p>
                    <p className="text-xs text-themed-muted">{dist}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

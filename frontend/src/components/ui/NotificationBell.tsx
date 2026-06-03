/**
 * Notification bell — shows unread count, dropdown with notifications.
 * Game invites always show Accept/Decline buttons until acted upon.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Swords, Gamepad2, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { formatDistanceToNow } from "@/lib/dateUtils";

interface NotifData {
  id: string;
  type: string;
  title: string;
  body: string;
  data: {
    challenge_id?: string;
    invite_code?: string;
    game_type?: string;
    from_user?: { id: string; username: string; full_name: string; avatar_url: string | null };
  } | null;
  read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifData[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Unread = notifs that are unread AND not yet dismissed locally
  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function fetchNotifs() {
    try {
      const { data } = await api.get("/games/notifications");
      setNotifs(data);
    } catch { /* ignore if not authenticated */ }
  }

  // Only mark non-invite notifications as read when opening
  async function markNonInvitesRead() {
    const toMark = notifs.filter((n) => !n.read && n.type !== "game_invite");
    if (toMark.length === 0) return;
    try {
      await Promise.all(toMark.map((n) => api.post(`/games/notifications/${n.id}/read`)));
      setNotifs((prev) =>
        prev.map((n) =>
          !n.read && n.type !== "game_invite" ? { ...n, read: true } : n
        )
      );
    } catch { /* ignore */ }
  }

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      // Mark non-invite notifications as read when opening
      markNonInvitesRead();
    }
  }

  async function acceptInvite(notif: NotifData) {
    if (!notif.data?.challenge_id) return;
    setAccepting(notif.id);
    try {
      await api.post(`/games/challenges/${notif.data.challenge_id}/join`);
      // Mark as read after accepting
      await api.post(`/games/notifications/${notif.id}/read`);
      setNotifs((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
      setOpen(false);
      navigate(`/jogos/xadrez/${notif.data.challenge_id}`);
    } catch (err: any) {
      // Challenge may already be full or expired
      const detail = err?.response?.data?.detail ?? "Convite expirado ou já não disponível.";
      alert(detail);
    } finally {
      setAccepting(null);
    }
  }

  async function dismissInvite(notif: NotifData) {
    // Optimistically hide the buttons
    setDismissed((prev) => new Set([...prev, notif.id]));
    try {
      await api.post(`/games/notifications/${notif.id}/read`);
      setNotifs((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    } catch { /* ignore */ }
  }

  // A game_invite shows action buttons if:
  // 1. It's a game_invite type
  // 2. Not yet dismissed locally
  // 3. Not yet accepted (read can be true if we just accepted — we navigate away)
  function showInviteActions(notif: NotifData): boolean {
    return notif.type === "game_invite" && !dismissed.has(notif.id) && !notif.read;
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 text-zinc-100 hover:bg-white/5 transition-all rounded-full active:scale-95"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 bg-accent-sos text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-panel luminous-edge rounded-2xl overflow-hidden z-50 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-body-sm font-bold text-themed-primary">
              Notificações
              {unread > 0 && (
                <span className="ml-2 text-xs text-accent-bisno font-normal">{unread} nova{unread !== 1 ? "s" : ""}</span>
              )}
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-themed-muted hover:text-themed-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-themed-muted mx-auto mb-2 opacity-40" />
                <p className="text-body-sm text-themed-muted">Sem notificações</p>
              </div>
            ) : (
              notifs.map((notif) => {
                const isInvite = notif.type === "game_invite";
                const showActions = showInviteActions(notif);

                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "px-4 py-3.5 border-b border-white/5 last:border-0 transition-colors",
                      !notif.read && !dismissed.has(notif.id) && "bg-accent-bisno/5",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                        isInvite ? "bg-accent-games/15 border border-accent-games/20" : "bg-white/5",
                      )}>
                        {isInvite
                          ? (notif.data?.game_type === "chess"
                            ? <Swords className="w-4 h-4 text-accent-games" />
                            : <Gamepad2 className="w-4 h-4 text-accent-games" />)
                          : <Bell className="w-4 h-4 text-zinc-400" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-semibold text-themed-primary leading-snug">
                          {notif.title}
                        </p>
                        <p className="text-xs text-themed-secondary mt-0.5 leading-relaxed">
                          {notif.body}
                        </p>
                        <p className="text-xs text-themed-muted mt-1">
                          {formatDistanceToNow(notif.created_at)}
                        </p>

                        {/* Action buttons — always visible for pending invites */}
                        {showActions && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => acceptInvite(notif)}
                              disabled={accepting === notif.id}
                              className={cn(
                                "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all",
                                "bg-accent-feed text-surface hover:brightness-110 active:scale-95",
                                "disabled:opacity-60 disabled:cursor-not-allowed",
                              )}
                            >
                              {accepting === notif.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Check className="w-3 h-3" />}
                              {accepting === notif.id ? "A entrar..." : "Aceitar"}
                            </button>
                            <button
                              onClick={() => dismissInvite(notif)}
                              disabled={accepting === notif.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white/5 text-themed-muted border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                            >
                              <X className="w-3 h-3" />
                              Recusar
                            </button>
                          </div>
                        )}

                        {/* Already acted */}
                        {isInvite && (notif.read || dismissed.has(notif.id)) && !showActions && (
                          <p className="text-xs text-themed-muted mt-1 italic">
                            {dismissed.has(notif.id) ? "Recusado" : "Aceite"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

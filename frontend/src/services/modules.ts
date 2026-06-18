/**
 * API service functions for all modules:
 * Wallet, Raffles, Auctions, Events, SOS
 */
import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Wallet {
  id: string;
  balance_centavos: number;
  locked_centavos: number;
  available_centavos: number;
  balance_aoa: number;
}

export interface WalletTransaction {
  id: string;
  type: string;
  status: string;
  amount_centavos: number;
  balance_after_centavos: number;
  description: string | null;
  external_ref: string | null;
  created_at: string;
}

export interface Raffle {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  image_url: string | null;
  ticket_price_centavos: number;
  max_tickets: number;
  tickets_sold: number;
  status: string;
  server_seed_hash: string;
  winner_id: string | null;
  winning_ticket: number | null;
  ends_at: string;
  created_at: string;
  pct_sold: number;
}

export interface RaffleTicket {
  id: string;
  raffle_id: string;
  ticket_number: number;
  purchased_at: string;
}

export interface Auction {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  image_url: string | null;
  starting_bid_centavos: number;
  current_bid_centavos: number;
  min_increment_centavos: number;
  status: string;
  winner_id: string | null;
  ends_at: string;
  created_at: string;
  total_bids: number;
}

export interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  amount_centavos: number;
  is_winning: boolean;
  created_at: string;
}

export interface MapEvent {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  image_url: string | null;
  category: string;
  status: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  max_attendees: number | null;
  attendees_count: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  distance_km: number | null;
}

export interface SOSAlert {
  id: string;
  user_id: string;
  category: string;
  description: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  created_at: string;
}

export interface MissingPerson {
  id: string;
  reporter_id: string;
  name: string;
  age: number | null;
  person_type: string;
  description: string;
  photo_url: string | null;
  last_seen_location: string | null;
  last_seen_at: string | null;
  status: string;
  is_urgent: boolean;
  created_at: string;
}

export interface LostFound {
  id: string;
  reporter_id: string;
  item_type: string;
  title: string;
  description: string;
  photo_url: string | null;
  location: string | null;
  contact_info: string | null;
  is_resolved: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  image_url: string | null;
  goal_centavos: number;
  current_centavos: number;
  is_active: boolean;
  created_at: string;
  ends_at: string | null;
  pct: number;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export const walletApi = {
  get: () => api.get<Wallet>("/wallet").then(r => r.data),
  transactions: (limit = 20, offset = 0) =>
    api.get<WalletTransaction[]>(`/wallet/transactions?limit=${limit}&offset=${offset}`).then(r => r.data),
  deposit: (amount_centavos: number, description?: string) =>
    api.post<Wallet>("/wallet/deposit", { amount_centavos, description }).then(r => r.data),
  withdraw: (amount_centavos: number, description?: string) =>
    api.post<Wallet>("/wallet/withdraw", { amount_centavos, description }).then(r => r.data),
  transfer: (to_user_id: string, amount_centavos: number, description?: string) =>
    api.post<Wallet>("/wallet/transfer", { to_user_id, amount_centavos, description }).then(r => r.data),
};

// ── Raffles ───────────────────────────────────────────────────────────────────

export const rafflesApi = {
  list: (status = "active") => api.get<Raffle[]>(`/raffles?status=${status}`).then(r => r.data),
  get: (id: string) => api.get<Raffle>(`/raffles/${id}`).then(r => r.data),
  create: (form: FormData) =>
    api.post<Raffle>("/raffles", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
  buyTicket: (id: string) => api.post<RaffleTicket>(`/raffles/${id}/tickets`).then(r => r.data),
  myTickets: (id: string) => api.get<RaffleTicket[]>(`/raffles/${id}/my-tickets`).then(r => r.data),
  draw: (id: string) => api.post<Raffle>(`/raffles/${id}/draw`).then(r => r.data),
};

// ── Auctions ──────────────────────────────────────────────────────────────────

export const auctionsApi = {
  list: (status = "active") => api.get<Auction[]>(`/auctions?status=${status}`).then(r => r.data),
  get: (id: string) => api.get<Auction>(`/auctions/${id}`).then(r => r.data),
  create: (form: FormData) =>
    api.post<Auction>("/auctions", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
  bid: (id: string, amount_centavos: number) =>
    api.post<Bid>(`/auctions/${id}/bid`, { amount_centavos }).then(r => r.data),
  bids: (id: string) => api.get<Bid[]>(`/auctions/${id}/bids`).then(r => r.data),
  finalize: (id: string) => api.post<Auction>(`/auctions/${id}/finalize`).then(r => r.data),
};

// ── Events ────────────────────────────────────────────────────────────────────

export const eventsApi = {
  list: (params?: { category?: string; lat?: number; lon?: number; radius_km?: number }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.lat) q.set("lat", String(params.lat));
    if (params?.lon) q.set("lon", String(params.lon));
    if (params?.radius_km) q.set("radius_km", String(params.radius_km));
    return api.get<MapEvent[]>(`/events?${q}`).then(r => r.data);
  },
  get: (id: string) => api.get<MapEvent>(`/events/${id}`).then(r => r.data),
  create: (form: FormData) =>
    api.post<MapEvent>("/events", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
  attend: (id: string) => api.post(`/events/${id}/attend`).then(r => r.data),
  delete: (id: string) => api.delete(`/events/${id}`).then(r => r.data),
};

// ── SOS ───────────────────────────────────────────────────────────────────────

export const sosApi = {
  alerts: {
    list: (status = "active", userId?: string) => {
      let url = `/sos/alerts?status=${status}`;
      if (userId) url += `&user_id=${userId}`;
      return api.get<SOSAlert[]>(url).then(r => r.data);
    },
    create: (form: FormData) =>
      api.post<SOSAlert>("/sos/alerts", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
    resolve: (id: string) => api.patch(`/sos/alerts/${id}/resolve`).then(r => r.data),
  },
  missing: {
    list: (status = "active") => api.get<MissingPerson[]>(`/sos/missing?status=${status}`).then(r => r.data),
    create: (form: FormData) =>
      api.post<MissingPerson>("/sos/missing", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
    markFound: (id: string) => api.patch(`/sos/missing/${id}/found`).then(r => r.data),
  },
  lostFound: {
    list: (item_type?: string) => {
      const q = item_type ? `?item_type=${item_type}` : "";
      return api.get<LostFound[]>(`/sos/lost-found${q}`).then(r => r.data);
    },
    create: (form: FormData) =>
      api.post<LostFound>("/sos/lost-found", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
  },
  campaigns: {
    list: (creator_id?: string) => {
      const q = creator_id ? `?creator_id=${creator_id}` : "";
      return api.get<Campaign[]>(`/sos/campaigns${q}`).then(r => r.data);
    },
    create: (form: FormData) =>
      api.post<Campaign>("/sos/campaigns", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatAOA(centavos: number): string {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency", currency: "AOA", minimumFractionDigits: 0,
  }).format(centavos / 100);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function timeLeft(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Terminado";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

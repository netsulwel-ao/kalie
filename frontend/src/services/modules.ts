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
  video_url: string | null;
  ticket_price_centavos: number;
  max_tickets: number;
  tickets_sold: number;
  min_tickets_for_draw: number;
  total_raised_centavos: number;
  buyer_count: number;
  status: string;
  server_seed_hash: string;
  server_seed: string | null;
  client_seed: string | null;
  nonce: number;
  winner_id: string | null;
  winning_ticket: number | null;
  ends_at: string | null;
  starts_at: string | null;
  created_at: string;
  activated_at: string | null;
  drawn_at: string | null;
  is_auto_closed: boolean;
  pct_sold: number;
}

export interface RaffleTicket {
  id: string;
  raffle_id: string;
  ticket_number: number;
  status?: string;
  purchased_at: string;
}

export interface RaffleTicketFull {
  id: string;
  ticket_number: number;
  status: string;
  purchased_at: string | null;
}

export interface Auction {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  image_url: string | null;
  starting_bid_centavos: number;
  reserve_price_centavos: number;
  current_bid_centavos: number;
  min_increment_centavos: number;
  pool_held_centavos: number;
  status: string;
  winner_id: string | null;
  starts_at: string;
  ends_at: string;
  ends_at_extended: string | null;
  anti_sniping_window_seconds: number;
  extensions_count: number;
  max_extensions: number;
  has_delivery_code: boolean;
  delivery_code: string | null;
  delivery_status: string;
  delivery_confirmed_at: string | null;
  total_bids: number;
  total_participants: number;
  user_position: string | null;
  user_bid_amount: number | null;
  min_next_bid: number;
  created_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  amount_centavos: number;
  is_winning: boolean;
  created_at: string;
}

export interface EventParticipant {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar: string | null;
  attended_at: string;
}

export interface BidHistoryItem {
  amount_centavos: number;
  bidder_label: string;
  is_winning: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ParticipantInfo {
  label: string;
  name: string;
  total_locked_centavos: number;
  bid_count: number;
}

export interface AuctionDeliveryLookup {
  id: string;
  title: string;
  image_url: string | null;
  pool_held_centavos: number;
  delivery_status: string;
  winner_name: string;
}

export interface AuctionDeliveryConfirm {
  message: string;
  amount_centavos: number;
}

export interface AuctionMyWin {
  id: string;
  title: string;
  image_url: string | null;
  current_bid_centavos: number;
  delivery_status: string;
  winner_name: string | null;
}

export interface AuctionDeliveryStatus {
  id: string;
  title: string;
  image_url: string | null;
  current_bid_centavos: number;
  delivery_code: string | null;
  delivery_status: string;
  status: string;
}
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
  is_attending?: boolean;
  contact_method?: string;
  contact_value?: string | null;
}

export interface AttendeeInfo {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
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

export interface BisnoItem {
  id: string;
  creator_id: string;
  type: "product" | "service";
  title: string;
  description: string;
  category: string;
  contact_method: "chat" | "whatsapp" | "call";
  contact_value: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  images: string[] | null;
  price_centavos: number | null;
  negotiable: boolean;
  condition: "new" | "used" | null;
  price_type: "hourly" | "fixed" | "negotiable" | null;
  service_modality: "home" | "in_person" | null;
  status: string;
  created_at: string;
  updated_at: string;
  distance_km: number | null;
  creator_name: string | null;
  creator_avatar: string | null;
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

export interface ReserveResult {
  id: string;
  ticket_number: number;
  status: string;
  reserved_until: string | null;
}

export interface AvailableTicket {
  id: string;
  ticket_number: number;
}

export interface Participant {
  ticket_number: number;
  name: string;
  purchased_at: string | null;
}

export interface DeliveryCode {
  id: string;
  raffle_id: string;
  code: string;
  qr_data: string;
  status: string;
  escrow_amount_centavos: number;
  dual_confirmation: boolean;
  confirmed_by_winner_at: string | null;
  confirmed_by_creator_at: string | null;
  completed_at: string | null;
  expires_at: string;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  dispute_resolved_at: string | null;
  dispute_resolution: string | null;
  created_at: string;
}

export const rafflesApi = {
  list: (status = "active") => api.get<Raffle[]>(`/raffles?status=${status}`).then(r => r.data),
  get: (id: string) => api.get<Raffle>(`/raffles/${id}`).then(r => r.data),
  create: (form: FormData) =>
    api.post<Raffle>("/raffles", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
  activate: (id: string) => api.post<Raffle>(`/raffles/${id}/activate`).then(r => r.data),
  buyTicket: (id: string) => api.post<RaffleTicket>(`/raffles/${id}/tickets`).then(r => r.data),
  myTickets: (id: string) => api.get<RaffleTicket[]>(`/raffles/${id}/my-tickets`).then(r => r.data),
  tickets: (id: string, limit = 100, offset = 0) =>
    api.get<RaffleTicket[]>(`/raffles/${id}/tickets?limit=${limit}&offset=${offset}`).then(r => r.data),
  allTickets: (id: string, limit = 100, offset = 0) =>
    api.get<RaffleTicketFull[]>(`/raffles/${id}/all-tickets?limit=${limit}&offset=${offset}`).then(r => r.data),
  close: (id: string) => api.post<Raffle>(`/raffles/${id}/close`).then(r => r.data),
  cancel: (id: string) => api.post<Raffle>(`/raffles/${id}/cancel`).then(r => r.data),
  // Reservation extensions
  reserve: (raffleId: string, ticketNumber: number) =>
    api.post<ReserveResult>(`/raffles/${raffleId}/tickets/${ticketNumber}/reserve`).then(r => r.data),
  confirmPurchase: (raffleId: string, ticketId: string) =>
    api.post<ReserveResult>(`/raffles/${raffleId}/tickets/${ticketId}/confirm`).then(r => r.data),
  release: (raffleId: string, ticketId: string) =>
    api.post(`/raffles/${raffleId}/tickets/${ticketId}/release`).then(r => r.data),
  availableTickets: (raffleId: string, query?: string, limit = 20, offset = 0) => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return api.get<AvailableTicket[]>(`/raffles/${raffleId}/tickets/available?${params}`).then(r => r.data);
  },
  participants: (raffleId: string) =>
    api.get<Participant[]>(`/raffles/${raffleId}/participants`).then(r => r.data),
  setMinSales: (raffleId: string, min_tickets_for_draw: number) =>
    api.patch(`/raffles/${raffleId}/min-sales`, { min_tickets_for_draw }).then(r => r.data),
  // Delivery / escrow
  deliveryStatus: (raffleId: string) =>
    api.get<DeliveryCode | null>(`/raffles/${raffleId}/delivery`).then(r => r.data),
  confirmDelivery: (raffleId: string, code: string) =>
    api.post<DeliveryCode>(`/raffles/${raffleId}/delivery/confirm`, { code }).then(r => r.data),
  confirmDeliveryCreator: (raffleId: string) =>
    api.post<DeliveryCode>(`/raffles/${raffleId}/delivery/confirm-creator`).then(r => r.data),
  disputeDelivery: (raffleId: string, reason = "Não recebi o prémio") =>
    api.post<DeliveryCode>(`/raffles/${raffleId}/delivery/dispute`, { reason }).then(r => r.data),
  // Code-based delivery (creator enters winner's code)
  deliveryLookupByCode: (code: string) =>
    api.get<any>(`/raffles/delivery/code/${code}`).then(r => r.data),
  deliveryConfirmByCode: (code: string) =>
    api.post<DeliveryCode>(`/raffles/delivery/code/${code}/confirm`).then(r => r.data),
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
  history: (id: string) => api.get<BidHistoryItem[]>(`/auctions/${id}/history`).then(r => r.data),
  participants: (id: string) => api.get<ParticipantInfo[]>(`/auctions/${id}/participants`).then(r => r.data),
  myWins: () => api.get<AuctionMyWin[]>(`/auctions/my-wins`).then(r => r.data),
  myBids: () => api.get<Auction[]>(`/auctions/my-bids`).then(r => r.data),
  deliveryStatus: (id: string) => api.get<AuctionDeliveryStatus>(`/auctions/${id}/delivery`).then(r => r.data),
  deliveryLookupByCode: (code: string) =>
    api.get<AuctionDeliveryLookup>(`/auctions/delivery/code/${code}`).then(r => r.data),
  deliveryConfirmByCode: (code: string) =>
    api.post<AuctionDeliveryConfirm>(`/auctions/delivery/code/${code}/confirm`).then(r => r.data),
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
  unattend: (id: string) => api.delete(`/events/${id}/attend`).then(r => r.data),
  attendees: (id: string) => api.get<AttendeeInfo[]>(`/events/${id}/attendees`).then(r => r.data),
  delete: (id: string) => api.delete(`/events/${id}`).then(r => r.data),
};

// ── Bisno ──────────────────────────────────────────────────────────────────────

export const bisnoApi = {
  list: (params?: {
    type?: string; category?: string; status?: string;
    price_type?: string; q?: string;
    lat?: number; lon?: number; radius_km?: number;
    limit?: number; offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set("type", params.type);
    if (params?.category) q.set("category", params.category);
    if (params?.status) q.set("status", params.status);
    if (params?.price_type) q.set("price_type", params.price_type);
    if (params?.q) q.set("q", params.q);
    if (params?.lat) q.set("lat", String(params.lat));
    if (params?.lon) q.set("lon", String(params.lon));
    if (params?.radius_km) q.set("radius_km", String(params.radius_km));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return api.get<BisnoItem[]>(`/bisno?${q}`).then(r => r.data);
  },
  get: (id: string) => api.get<BisnoItem>(`/bisno/${id}`).then(r => r.data),
  create: (form: FormData) =>
    api.post<BisnoItem>("/bisno", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
  update: (id: string, body: Record<string, any>) =>
    api.patch<BisnoItem>(`/bisno/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/bisno/${id}`).then(r => r.data),
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
    delete: (id: string) => api.delete(`/sos/alerts/${id}`),
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

export function formatAOA(centavos: number | null | undefined): string {
  const val = centavos ?? 0;
  return new Intl.NumberFormat("pt-AO", {
    style: "currency", currency: "AOA", minimumFractionDigits: 0,
  }).format(val / 100);
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

export function timeLeft(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Terminado";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

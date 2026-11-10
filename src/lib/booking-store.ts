import type { LangCode } from "./booking-catalog";

export type BookingStatus =
  | "created"
  | "searching"
  | "assigned"
  | "on_the_way"
  | "arrived"
  | "started"
  | "completed"
  | "cancelled"
  | "disputed";

export const STATUS_META: Record<BookingStatus, { label: string; dot: string; badge: string }> = {
  created: { label: "Booking created", dot: "bg-slate-400", badge: "badge" },
  searching: { label: "Searching worker", dot: "bg-amber-500", badge: "badge badge-warning" },
  assigned: { label: "Worker assigned", dot: "bg-indigo-500", badge: "badge badge-info" },
  on_the_way: { label: "Worker on the way", dot: "bg-sky-500", badge: "badge badge-info" },
  arrived: { label: "Arrived", dot: "bg-violet-500", badge: "badge badge-info" },
  started: { label: "Work started", dot: "bg-brand-red", badge: "badge badge-brand" },
  completed: { label: "Completed", dot: "bg-emerald-500", badge: "badge badge-success" },
  cancelled: { label: "Cancelled", dot: "bg-rose-500", badge: "badge badge-warning" },
  disputed: { label: "Disputed", dot: "bg-amber-600", badge: "badge badge-warning" },
};

export const STATUS_FLOW: BookingStatus[] = [
  "created",
  "searching",
  "assigned",
  "on_the_way",
  "arrived",
  "started",
  "completed",
];

export type BookingAddress = {
  label: string;
  line1: string;
  landmark: string;
  instructions: string;
  phone: string;
  coords?: { lat: number; lng: number } | null;
};

export type Booking = {
  id: string;
  createdAt: string;
  language: LangCode;
  city: string;
  area: string;
  serviceId: string;
  subId: string;
  workers: number;
  timing: "immediate" | "scheduled";
  date: string | null;
  slot: string | null;
  address: BookingAddress;
  payment: {
    method: string;
    advance: number;
    remaining: number;
    total: number;
    taxes: number;
    platformFee: number;
    base: number;
  };
  status: BookingStatus;
  worker: { name: string; rating: number; jobs: number; phone: string };
  rating?: number;
  advanceAmount?: number;
  balanceAmount?: number;
  paymentStatus?: string;
  evidenceSubmitted?: boolean;
  disputed?: boolean;
};

const BOOKINGS_KEY = "daystart-bookings";
const DRAFT_KEY = "daystart-booking-draft";
const LANG_KEY = "daystart-language";
const ADDR_KEY = "daystart-saved-addresses";

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export const getLanguage = () => read<LangCode | null>(LANG_KEY, null);
export const setLanguage = (l: LangCode) => write(LANG_KEY, l);

export const getSavedAddresses = () => read<BookingAddress[]>(ADDR_KEY, []);
export function saveAddress(addr: BookingAddress) {
  const all = getSavedAddresses().filter((a) => a.line1 !== addr.line1);
  write(ADDR_KEY, [addr, ...all].slice(0, 5));
}

export const getDraft = <T>(fallback: T): T => read<T>(DRAFT_KEY, fallback);
export const saveDraft = (draft: unknown) => write(DRAFT_KEY, draft);
export const clearDraft = () => isBrowser() && window.localStorage.removeItem(DRAFT_KEY);

// Bookings are stored in the database (see bookings.functions.ts).
export async function getBookings(): Promise<Booking[]> {
  const { listMyBookings } = await import("./bookings.functions");
  try {
    return await listMyBookings();
  } catch (e) {
    console.error(e);
    return [];
  }
}
export async function getBooking(id: string): Promise<Booking | null> {
  const { getMyBooking } = await import("./bookings.functions");
  return getMyBooking({ data: { id } });
}
export async function cancelBooking(id: string) {
  const { cancelMyBooking } = await import("./bookings.functions");
  return cancelMyBooking({ data: { id } });
}
export async function advanceBooking(id: string) {
  const { advanceMyBooking } = await import("./bookings.functions");
  return advanceMyBooking({ data: { id } });
}
export async function rateBooking(id: string, rating: number) {
  const { rateMyBooking } = await import("./bookings.functions");
  return rateMyBooking({ data: { id, rating } });
}
export async function disputeBooking(id: string, reason: string, notes?: string) {
  const { openMyBookingDispute } = await import("./bookings.functions");
  return openMyBookingDispute({ data: { bookingId: id, reason, notes } });
}
void BOOKINGS_KEY;

const WORKER_NAMES = [
  "Ramesh Naidu",
  "Lakshmi Devi",
  "Suresh Kumar",
  "Anjali Rao",
  "Venkat Reddy",
  "Priya Sharma",
];

export function assignWorker() {
  const name = WORKER_NAMES[Math.floor(Math.random() * WORKER_NAMES.length)]!;
  return {
    name,
    rating: Math.round((4.4 + Math.random() * 0.6) * 10) / 10,
    jobs: 60 + Math.floor(Math.random() * 400),
    phone: "+91 90320 78142",
  };
}

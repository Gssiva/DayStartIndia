import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  Sprout,
  Sparkles,
  HardHat,
  Car,
  Scissors,
  Droplets,
  Wheat,
  Brush,
  Crown,
  Hammer,
  PaintRoller,
  Grid3X3,
  Plane,
  Moon,
  CalendarClock,
  Clock,
  Home,
  Layers,
  SprayCan,
  Tractor,
  type LucideIcon,
} from "lucide-react";
import { getServiceCatalog, type ServiceRow, type SubServiceRow } from "./services.functions";

export type { ServiceRow, SubServiceRow };

const ICONS: Record<string, LucideIcon> = {
  Sprout,
  Sparkles,
  HardHat,
  Car,
  Scissors,
  Droplets,
  Wheat,
  Brush,
  Crown,
  Hammer,
  PaintRoller,
  Grid3X3,
  Plane,
  Moon,
  CalendarClock,
  Clock,
  Home,
  Layers,
  SprayCan,
  Tractor,
};

export function serviceIcon(name: string): LucideIcon {
  return ICONS[name] ?? Sparkles;
}

export const ACCENTS: Record<string, string> = {
  agriculture: "from-emerald-500/15 to-emerald-500/0",
  beauty: "from-pink-500/15 to-pink-500/0",
  construction: "from-amber-500/15 to-amber-500/0",
  driver: "from-sky-500/15 to-sky-500/0",
};

export const catalogQueryOptions = queryOptions({
  queryKey: ["service-catalog"],
  queryFn: () => getServiceCatalog(),
  staleTime: 5 * 60_000,
});

export function useServiceCatalog() {
  const query = useQuery(catalogQueryOptions);
  const services = query.data?.services ?? [];
  return {
    services,
    isLoading: query.isLoading,
    error: query.data?.error ?? (query.isError ? "We couldn't load services right now." : null),
    refetch: query.refetch,
    findService: (slug?: string | null) => services.find((s) => s.slug === slug),
    findSub: (serviceSlug?: string | null, subSlug?: string | null) =>
      services.find((s) => s.slug === serviceSlug)?.subs.find((x) => x.slug === subSlug),
  };
}

/** Temporary (pre-booking) selection kept across the login round-trip. */
export type PendingSelection = {
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  subServiceId: string;
  subServiceSlug: string;
  subServiceName: string;
  price: number;
  unit: string;
};

const PENDING_KEY = "daystart-pending-selection";

export function setPendingSelection(sel: PendingSelection) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(sel));
  } catch {
    /* ignore */
  }
}

export function getPendingSelection(): PendingSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSelection) : null;
  } catch {
    return null;
  }
}

export function clearPendingSelection() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

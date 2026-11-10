import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ServiceWithSubs {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image: string | null;
  startingPrice: number | null;
  eta: string | null;
  multiWorker: boolean;
  status: string;
  subs: {
    id: string;
    name: string;
    slug: string;
    price: number;
    unit: string;
  }[];
}

export interface LocationServicesResult {
  services: ServiceWithSubs[];
  covered: boolean;
  message?: string;
  location?: {
    city: string;
    area: string;
    lat: number;
    lng: number;
  };
}

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("catalog_unavailable");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Get services available for a specific location (city/area or coordinates).
 * Returns empty list if location is not covered.
 */
export const getServicesByLocation = createServerFn({ method: "GET" })
  .inputValidator((data: { city?: string; area?: string; lat?: number; lng?: number }) => {
    const city = typeof data.city === "string" ? data.city.trim() : undefined;
    const area = typeof data.area === "string" ? data.area.trim() : undefined;
    const lat = typeof data.lat === "number" ? data.lat : undefined;
    const lng = typeof data.lng === "number" ? data.lng : undefined;
    return { city, area, lat, lng };
  })
  .handler(async ({ data }) => {
    try {
      const supabase = publicClient();

      // 1. Check service coverage for the requested location
      let covered = false;
      let locationId: string | undefined;
      let message: string | undefined;

      const { data: coverageLocations, error: covError } = await supabase
        .from("service_coverage_locations")
        .select("*")
        .eq("is_active", true);

      if (covError) {
        console.error("[location-services] Coverage check failed:", covError);
        // Fallback: show all services if DB query fails
        covered = true;
      } else if (coverageLocations && coverageLocations.length > 0) {
        const city = data.city;
        const area = data.area;
        const lat = data.lat;
        const lng = data.lng;

        // Check exact city/area match
        if (city && area) {
          const directMatch = coverageLocations.find(
            (loc) =>
              loc.city.toLowerCase() === city.toLowerCase() &&
              loc.area.toLowerCase() === area.toLowerCase(),
          );
          if (directMatch) {
            covered = true;
            locationId = directMatch.id;
          }
        }

        // If no direct match, check coordinates if provided
        if (!covered && lat && lng) {
          for (const loc of coverageLocations) {
            const dist = haversineDistanceKm(lat, lng, loc.lat, loc.lng);
            if (dist <= loc.radius_km) {
              covered = true;
              locationId = loc.id;
              break;
            }
          }
        }

        // If still not covered, check city-level match
        if (!covered && city) {
          const cityMatch = coverageLocations.some(
            (loc) => loc.city.toLowerCase() === city.toLowerCase(),
          );
          if (cityMatch) {
            covered = true;
          }
        }
      } else {
        // No coverage locations configured - show all services
        covered = true;
      }

      if (!covered) {
        return {
          services: [],
          covered: false,
          message:
            "DayStart is coming soon to your area. We're working to bring trusted services closer to you.",
        };
      }

      // 2. Fetch active services and sub-services
      const [{ data: services, error: sErr }, { data: subs, error: subErr }] = await Promise.all([
        supabase
          .from("services")
          .select(
            "id,name,slug,description,icon,image,starting_price,eta,multi_worker,status,sort_order",
          )
          .eq("status", "active")
          .order("sort_order", { ascending: true }),
        supabase
          .from("sub_services")
          .select("id,service_id,name,slug,price,unit,duration,status,sort_order")
          .eq("status", "active")
          .order("sort_order", { ascending: true }),
      ]);

      if (sErr || subErr) throw sErr ?? subErr;

      // Map services with their sub-services
      const mapped: ServiceWithSubs[] = (services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        icon: s.icon,
        image: s.image,
        startingPrice: s.starting_price,
        eta: s.eta,
        multiWorker: s.multi_worker,
        status: s.status,
        subs: (subs ?? [])
          .filter((x) => x.service_id === s.id)
          .map((x) => ({
            id: x.id,
            name: x.name,
            slug: x.slug,
            price: x.price,
            unit: x.unit,
          })),
      }));

      return {
        services: mapped,
        covered: true,
        location: data.city
          ? { city: data.city, area: data.area ?? "", lat: data.lat ?? 0, lng: data.lng ?? 0 }
          : undefined,
      };
    } catch (err) {
      console.error("[location-services] Failed to load services:", err);
      return {
        services: [],
        covered: true,
        message: "We couldn't load services right now. Please try again.",
      };
    }
  });

/**
 * Haversine formula to compute geodesic distance between two points in kilometers.
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

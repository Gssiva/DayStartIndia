import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PricingConfig {
  platformFee: number;
  gstRate: number;
  advancePercentage: number; // Deprecated: kept for backward compatibility
  platformCommissionRate: number;
}

export interface PricingSnapshot {
  unitPrice: number;
  workers: number;
  basePrice: number;
  platformFee: number;
  gstRate: number;
  taxes: number;
  totalPrice: number;
  advancePercentage: number;
  advanceAmount: number;
  balanceAmount: number;
  calculatedAt: string;
}

export interface PricingCalculationResult {
  serviceId: string;
  subServiceId: string;
  serviceName: string;
  subServiceName: string;
  unitPrice: number;
  workers: number;
  basePrice: number;
  platformFee: number;
  taxes: number;
  totalPrice: number;
  advanceAmount: number;
  balanceAmount: number;
  evidenceRequirements: Record<string, boolean>;
  pricingSnapshot: PricingSnapshot;
}

/**
 * Haversine formula to compute geodesic distance between two points in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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

/**
 * Verify whether a requested booking location is covered by active service locations.
 */
export async function verifyServiceCoverage(
  city: string,
  area: string,
  coords?: { lat: number; lng: number } | null,
): Promise<{
  covered: boolean;
  message?: string;
  locationId?: string;
  distanceKm?: number;
}> {
  const cleanCity = city.trim();
  const cleanArea = area.trim();

  // 1. Check exact or pattern match in coverage locations table
  const { data: locations, error } = await supabaseAdmin
    .from("service_coverage_locations")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("[pricing] Error checking coverage locations:", error);
    // Allow fallback if DB query fails to prevent total booking disruption
    return { covered: true };
  }

  if (!locations || locations.length === 0) {
    return { covered: true };
  }

  // Find exact city & area match
  const directMatch = locations.find(
    (loc) =>
      loc.city.toLowerCase() === cleanCity.toLowerCase() &&
      loc.area.toLowerCase() === cleanArea.toLowerCase(),
  );

  if (directMatch) {
    if (coords && coords.lat && coords.lng) {
      const dist = haversineDistanceKm(coords.lat, coords.lng, directMatch.lat, directMatch.lng);
      if (dist <= directMatch.radius_km) {
        return { covered: true, locationId: directMatch.id, distanceKm: dist };
      }
      return {
        covered: false,
        message: `Your location is ${dist} km away from our ${directMatch.area} hub (service limit: ${directMatch.radius_km} km).`,
        distanceKm: dist,
      };
    }
    return { covered: true, locationId: directMatch.id, distanceKm: 0 };
  }

  // If no direct match, check if coordinates fall within any active hub radius
  if (coords && coords.lat && coords.lng) {
    for (const loc of locations) {
      const dist = haversineDistanceKm(coords.lat, coords.lng, loc.lat, loc.lng);
      if (dist <= loc.radius_km) {
        return { covered: true, locationId: loc.id, distanceKm: dist };
      }
    }
  }

  // Also check city-level match
  const cityLocations = locations.filter(
    (loc) => loc.city.toLowerCase() === cleanCity.toLowerCase(),
  );

  if (cityLocations.length > 0) {
    // Covered under general city operational zone
    return { covered: true, locationId: cityLocations[0]?.id };
  }

  return {
    covered: false,
    message: `DayStart is not yet active in ${cleanArea}, ${cleanCity}. Active hubs: Visakhapatnam, Hyderabad, and Vijayawada.`,
  };
}

/**
 * Server-authoritative price calculation for bookings.
 * Pricing is NEVER trusted from the client payload.
 */
export async function calculateBookingPricing(params: {
  serviceSlug: string;
  subServiceSlug: string;
  workers: number;
}): Promise<PricingCalculationResult> {
  const { data: service, error: svcError } = await supabaseAdmin
    .from("services")
    .select("id, name, slug, multi_worker, status, evidence_requirements")
    .eq("slug", params.serviceSlug)
    .eq("status", "active")
    .maybeSingle();

  if (svcError || !service) {
    throw new Error(`Service "${params.serviceSlug}" is currently unavailable.`);
  }

  const { data: subService, error: subError } = await supabaseAdmin
    .from("sub_services")
    .select("id, name, slug, price, status")
    .eq("service_id", service.id)
    .eq("slug", params.subServiceSlug)
    .eq("status", "active")
    .maybeSingle();

  if (subError || !subService) {
    throw new Error(`Sub-service option "${params.subServiceSlug}" is currently unavailable.`);
  }

  // Constrain worker count: single-worker services strictly enforce 1 worker
  const workers = service.multi_worker ? Math.max(1, Math.min(20, params.workers)) : 1;
  const unitPrice = subService.price;
  const basePrice = unitPrice * workers;

  // Use safe default pricing configuration
  // Platform fee and GST can be configured via database in future
  const platformFee = 0;
  const gstRate = 0.05; // 5% GST
  const advancePercentage = 0; // No advance payment - new payment model

  // Only calculate taxes and fees if configured values exist
  const taxes =
    platformFee > 0 && gstRate > 0 ? Math.round((basePrice + platformFee) * gstRate) : 0;
  const totalPrice = basePrice + platformFee + taxes;
  const advanceAmount =
    advancePercentage > 0 ? Math.round(totalPrice * (advancePercentage / 100)) : 0;
  const balanceAmount = totalPrice - advanceAmount;

  const evidenceRequirements = (service.evidence_requirements ?? {
    before_photos: true,
    after_photos: true,
  }) as Record<string, boolean>;

  const pricingSnapshot: PricingSnapshot = {
    unitPrice,
    workers,
    basePrice,
    platformFee,
    gstRate,
    taxes,
    totalPrice,
    advancePercentage,
    advanceAmount,
    balanceAmount,
    calculatedAt: new Date().toISOString(),
  };

  return {
    serviceId: service.id,
    subServiceId: subService.id,
    serviceName: service.name,
    subServiceName: subService.name,
    unitPrice,
    workers,
    basePrice,
    platformFee,
    taxes,
    totalPrice,
    advanceAmount,
    balanceAmount,
    evidenceRequirements,
    pricingSnapshot,
  };
}

/**
 * Get current pricing configuration from database.
 * Returns safe defaults for now.
 */
export async function getPricingConfig(): Promise<PricingConfig> {
  // Use safe default pricing configuration
  // Platform fee and GST can be configured via database in future
  return {
    platformFee: 0,
    gstRate: 0.05, // 5% GST
    advancePercentage: 0, // No advance payment - new payment model
    platformCommissionRate: 0.15, // 15% platform commission for workers
  };
}

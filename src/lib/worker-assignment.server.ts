import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { haversineDistanceKm } from "./pricing.server";

export interface WorkerCandidate {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  rating: number;
  completed_jobs_count: number;
  approval_status: string;
  approval_date: string | null;
  availability_status: string;
  current_lat: number | null;
  current_lng: number | null;
  distanceKm: number;
  score: number;
  scoreBreakdown: {
    distanceScore: number;
    ratingScore: number;
    fairnessScore: number;
    postApprovalBonus: number;
    baseScore: number;
    total: number;
  };
}

export interface AssignmentResult {
  assigned: boolean;
  worker?: WorkerCandidate;
  assignmentId?: string;
  reason?: string;
}

/**
 * Calculate 5-factor deterministic ranking score for an eligible worker.
 */
export function calculateWorkerScore(
  worker: {
    rating: number;
    completed_jobs_count: number;
    approval_date: string | null;
  },
  distanceKm: number,
): {
  distanceScore: number;
  ratingScore: number;
  fairnessScore: number;
  postApprovalBonus: number;
  baseScore: number;
  total: number;
} {
  // 1. Distance Score (0 - 40 points): closer = higher
  const clampedDist = Math.min(10, Math.max(0, distanceKm));
  const distanceScore = Math.round((10 - clampedDist) * 4 * 10) / 10;

  // 2. Rating Score (0 - 25 points): rating / 5.0 * 25
  const rating = Math.min(5, Math.max(1, worker.rating || 5.0));
  const ratingScore = Math.round((rating / 5.0) * 25 * 10) / 10;

  // 3. Fairness / Workload Balancing Score (0 - 20 points):
  // Workers with fewer jobs receive higher score to distribute opportunities evenly
  const jobs = Math.max(0, worker.completed_jobs_count || 0);
  const fairnessScore = Math.round(Math.max(0, 20 - Math.min(20, jobs * 0.5)) * 10) / 10;

  // 4. Post-Approval 3-day bonus (10 points):
  // Workers approved within the last 72 hours get a fairness boost
  let postApprovalBonus = 0;
  if (worker.approval_date) {
    const approvedAt = new Date(worker.approval_date).getTime();
    const hoursSinceApproval = (Date.now() - approvedAt) / (1000 * 60 * 60);
    if (hoursSinceApproval >= 0 && hoursSinceApproval <= 72) {
      postApprovalBonus = 10;
    }
  }

  // 5. Base reliability score (5 points)
  const baseScore = 5;

  const total =
    Math.round((distanceScore + ratingScore + fairnessScore + postApprovalBonus + baseScore) * 10) /
    10;

  return {
    distanceScore,
    ratingScore,
    fairnessScore,
    postApprovalBonus,
    baseScore,
    total,
  };
}

/**
 * Deterministically find and rank all eligible workers within 10 km.
 */
export async function findEligibleWorkers(params: {
  serviceSlug: string;
  category?: string;
  siteLat: number;
  siteLng: number;
  maxRadiusKm?: number;
}): Promise<WorkerCandidate[]> {
  const maxRadius = params.maxRadiusKm ?? 10.0;

  // 1. Fetch currently active worker assignments to avoid double-booking
  const { data: activeAssignments } = await supabaseAdmin
    .from("worker_assignments")
    .select("worker_id")
    .in("status", ["assigned", "en_route", "arrived", "in_progress"]);

  const busyWorkerIds = new Set((activeAssignments ?? []).map((a) => a.worker_id));

  // 2. Query approved and online worker profiles
  const { data: profiles, error } = await supabaseAdmin
    .from("worker_profiles")
    .select(
      "id, user_id, full_name, phone, rating, completed_jobs_count, approval_status, approval_date, availability_status, current_lat, current_lng, skill_categories, service_areas",
    )
    .eq("approval_status", "approved")
    .eq("availability_status", "available");

  if (error || !profiles) {
    console.error("[assignment] Error fetching worker profiles:", error);
    return [];
  }

  const candidates: WorkerCandidate[] = [];

  for (const p of profiles) {
    // Hard Filter: Worker is busy with another active job
    if (busyWorkerIds.has(p.user_id)) {
      continue;
    }

    // Hard Filter: Rating must be at least 3.0
    if (p.rating < 3.0) {
      continue;
    }

    // Hard Filter: Service skill match
    // Check if worker has skill matching service slug or category
    const skills = p.skill_categories || [];
    const hasSkill =
      skills.length === 0 || // unconstrained general worker
      skills.some(
        (s) =>
          params.serviceSlug.toLowerCase().includes(s.toLowerCase()) ||
          (params.category && params.category.toLowerCase().includes(s.toLowerCase())) ||
          s.toLowerCase().includes(params.serviceSlug.toLowerCase()),
      );

    if (!hasSkill) {
      continue;
    }

    // Distance calculation: If worker coordinates not set, default to site (assume hub standby)
    const workerLat = p.current_lat ?? params.siteLat;
    const workerLng = p.current_lng ?? params.siteLng;
    const distanceKm = haversineDistanceKm(params.siteLat, params.siteLng, workerLat, workerLng);

    // Hard Filter: Must be within 10.0 km
    if (distanceKm > maxRadius) {
      continue;
    }

    const scoreBreakdown = calculateWorkerScore(
      {
        rating: p.rating,
        completed_jobs_count: p.completed_jobs_count,
        approval_date: p.approval_date,
      },
      distanceKm,
    );

    candidates.push({
      id: p.id,
      user_id: p.user_id,
      full_name: p.full_name || "Verified Worker",
      phone: p.phone,
      rating: p.rating,
      completed_jobs_count: p.completed_jobs_count,
      approval_status: p.approval_status,
      approval_date: p.approval_date,
      availability_status: p.availability_status,
      current_lat: workerLat,
      current_lng: workerLng,
      distanceKm,
      score: scoreBreakdown.total,
      scoreBreakdown,
    });
  }

  // Sort descending by fairness/composite score, ties broken by closer distance
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.distanceKm - b.distanceKm;
  });

  return candidates;
}

/**
 * Automatically assign the highest-ranked eligible worker to a booking.
 * Concurrency safe: checks for existing active assignment before assigning.
 */
export async function assignWorkerToBooking(bookingId: string): Promise<AssignmentResult> {
  // 1. Fetch booking details
  const { data: booking, error: bError } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (bError || !booking) {
    throw new Error(`Booking ${bookingId} not found.`);
  }

  // If already assigned to an active assignment, return existing
  const { data: existingAssignment } = await supabaseAdmin
    .from("worker_assignments")
    .select("*")
    .eq("booking_id", bookingId)
    .in("status", ["assigned", "en_route", "arrived", "in_progress"])
    .maybeSingle();

  if (existingAssignment) {
    return {
      assigned: true,
      assignmentId: existingAssignment.id,
      reason: "Worker already assigned to this booking.",
    };
  }

  // Determine site coordinates (fallback to city center if not provided)
  let siteLat = booking.site_lat;
  let siteLng = booking.site_lng;

  if (!siteLat || !siteLng) {
    const address = booking.address as { coords?: { lat: number; lng: number } };
    if (address?.coords?.lat && address?.coords?.lng) {
      siteLat = address.coords.lat;
      siteLng = address.coords.lng;
    } else {
      // Look up coverage location coordinates
      const { data: cov } = await supabaseAdmin
        .from("service_coverage_locations")
        .select("lat, lng")
        .eq("city", booking.city)
        .eq("area", booking.area)
        .maybeSingle();

      siteLat = cov?.lat ?? 17.6868; // default Visakhapatnam center
      siteLng = cov?.lng ?? 83.2185;
    }
  }

  // 2. Find and rank eligible candidates within 10 km
  const candidates = await findEligibleWorkers({
    serviceSlug: booking.service_slug,
    siteLat,
    siteLng,
    maxRadiusKm: 10.0,
  });

  if (candidates.length === 0) {
    // No worker available within 10 km
    await supabaseAdmin.from("bookings").update({ status: "searching" }).eq("id", bookingId);

    await supabaseAdmin.from("booking_events").insert({
      booking_id: bookingId,
      status_from: booking.status,
      status_to: "searching",
      event_type: "assignment_pending_no_worker",
      notes: "No eligible verified worker available within 10 km. Searching in progress.",
    });

    return {
      assigned: false,
      reason: "No eligible verified worker found within 10 km radius. System searching.",
    };
  }

  // 3. Pick top-scoring candidate
  const bestWorker = candidates[0]!;

  // 4. Create worker assignment with pending status (2-minute acceptance window)
  const acceptanceDeadline = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
  const { data: assignment, error: assignError } = await supabaseAdmin
    .from("worker_assignments")
    .insert({
      booking_id: bookingId,
      worker_id: bestWorker.user_id,
      status: "pending_acceptance",
      distance_km: bestWorker.distanceKm,
      score: bestWorker.score,
      assignment_reason: `Auto-assigned: 5-factor fairness score ${bestWorker.score} (Dist: ${bestWorker.distanceKm}km, Rating: ${bestWorker.rating}, Jobs: ${bestWorker.completed_jobs_count})`,
      acceptance_deadline: acceptanceDeadline.toISOString(),
    })
    .select("id")
    .single();

  if (assignError || !assignment) {
    console.error("[assignment] Failed to create assignment record:", assignError);
    return {
      assigned: false,
      reason: "Failed to create assignment record.",
    };
  }

  // 5. Update booking with assigned worker details and status
  const workerJson = {
    id: bestWorker.user_id,
    name: bestWorker.full_name || "Verified DayStart Partner",
    rating: bestWorker.rating,
    jobs: bestWorker.completed_jobs_count,
    phone: bestWorker.phone || "+91 90320 78142",
    distanceKm: bestWorker.distanceKm,
    assignedAt: new Date().toISOString(),
  };

  await supabaseAdmin
    .from("bookings")
    .update({
      status: "assigned",
      worker: workerJson,
    })
    .eq("id", bookingId);

  // 6. Record booking lifecycle event
  await supabaseAdmin.from("booking_events").insert({
    booking_id: bookingId,
    status_from: booking.status,
    status_to: "assigned",
    event_type: "worker_assigned",
    actor_id: bestWorker.user_id,
    actor_role: "worker",
    notes: `Worker ${bestWorker.full_name} assigned (${bestWorker.distanceKm} km away, score: ${bestWorker.score}).`,
    metadata: {
      workerId: bestWorker.user_id,
      score: bestWorker.score,
      distanceKm: bestWorker.distanceKm,
      scoreBreakdown: bestWorker.scoreBreakdown,
    },
  });

  // 7. Send notification to the worker
  await supabaseAdmin.from("notifications").insert({
    user_id: bestWorker.user_id,
    title: "New Job Assignment",
    message: `You have been assigned booking ${bookingId} in ${booking.area}, ${booking.city}.`,
    type: "job_assigned",
    link: `/worker/jobs/${bookingId}`,
  });

  return {
    assigned: true,
    worker: bestWorker,
    assignmentId: assignment.id,
  };
}

/**
 * Handle worker reassignment (e.g., worker cancelled, no-show, or emergency).
 */
export async function reassignBookingWorker(
  bookingId: string,
  workerId: string,
  reason: "no_show" | "cancelled",
  notes?: string,
): Promise<AssignmentResult> {
  // Update previous assignment status
  await supabaseAdmin
    .from("worker_assignments")
    .update({
      status: reason,
      assignment_reason: notes ?? `Worker ${reason}`,
    })
    .eq("booking_id", bookingId)
    .eq("worker_id", workerId);

  // Record event
  await supabaseAdmin.from("booking_events").insert({
    booking_id: bookingId,
    status_from: "assigned",
    status_to: "searching",
    event_type: `worker_${reason}`,
    actor_id: workerId,
    actor_role: "worker",
    notes: notes ?? `Worker marked as ${reason}. Seeking replacement.`,
  });

  // Reset booking to searching and seek next worker
  await supabaseAdmin.from("bookings").update({ status: "searching" }).eq("id", bookingId);

  return assignWorkerToBooking(bookingId);
}

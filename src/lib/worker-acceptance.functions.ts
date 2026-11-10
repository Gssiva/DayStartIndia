import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assignWorkerToBooking } from "./worker-assignment.server";

/**
 * Worker accepts a job assignment.
 * Changes status from pending_acceptance to assigned.
 */
export const acceptAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assignmentId: string }) =>
    z.object({ assignmentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Verify the assignment belongs to this worker
    const { data: assignment, error } = await supabaseAdmin
      .from("worker_assignments")
      .select("*")
      .eq("id", data.assignmentId)
      .eq("worker_id", context.userId)
      .eq("status", "pending_acceptance")
      .maybeSingle();

    if (error || !assignment) {
      throw new Error("Assignment not found or already processed.");
    }

    // 2. Check if deadline has passed
    if (assignment.acceptance_deadline && new Date(assignment.acceptance_deadline) < new Date()) {
      // Deadline passed - mark as declined and reassign
      await supabaseAdmin
        .from("worker_assignments")
        .update({
          status: "declined",
          assignment_reason: "Acceptance deadline expired",
        })
        .eq("id", data.assignmentId);

      // Trigger reassignment
      await reassignBookingWorker(
        assignment.booking_id,
        context.userId,
        "timeout",
        "Worker did not accept within deadline",
      );

      throw new Error("Acceptance deadline has expired. Job has been reassigned.");
    }

    // 3. Update assignment status to assigned
    await supabaseAdmin
      .from("worker_assignments")
      .update({ status: "assigned" })
      .eq("id", data.assignmentId);

    // 4. Update booking status
    await supabaseAdmin
      .from("bookings")
      .update({ status: "assigned" })
      .eq("id", assignment.booking_id);

    // 5. Record booking event
    await supabaseAdmin.from("booking_events").insert({
      booking_id: assignment.booking_id,
      status_from: "searching",
      status_to: "assigned",
      event_type: "worker_accepted",
      actor_id: context.userId,
      actor_role: "worker",
      notes: "Worker accepted job assignment within deadline.",
    });

    return { ok: true };
  });

/**
 * Worker declines a job assignment.
 * Triggers automatic reassignment to next eligible worker.
 */
export const declineAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assignmentId: string; reason?: string }) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        reason: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Verify the assignment belongs to this worker
    const { data: assignment, error } = await supabaseAdmin
      .from("worker_assignments")
      .select("*")
      .eq("id", data.assignmentId)
      .eq("worker_id", context.userId)
      .eq("status", "pending_acceptance")
      .maybeSingle();

    if (error || !assignment) {
      throw new Error("Assignment not found or already processed.");
    }

    // 2. Update assignment status to declined
    await supabaseAdmin
      .from("worker_assignments")
      .update({
        status: "declined",
        assignment_reason: data.reason || "Worker declined assignment",
      })
      .eq("id", data.assignmentId);

    // 3. Trigger reassignment
    await reassignBookingWorker(
      assignment.booking_id,
      context.userId,
      "declined",
      data.reason || "Worker declined assignment",
    );

    return { ok: true };
  });

/**
 * Check for timed-out assignments and trigger reassignment.
 * This should be called by a scheduled job/cron.
 */
export const checkTimeoutAssignments = createServerFn({ method: "POST" }).handler(async () => {
  const now = new Date().toISOString();

  // Find all pending_acceptance assignments past deadline
  const { data: expiredAssignments, error } = await supabaseAdmin
    .from("worker_assignments")
    .select("*")
    .eq("status", "pending_acceptance")
    .lt("acceptance_deadline", now);

  if (error) {
    console.error("[timeout-check] Failed to fetch expired assignments:", error);
    throw new Error("Failed to check for timed-out assignments.");
  }

  if (!expiredAssignments || expiredAssignments.length === 0) {
    return { processed: 0 };
  }

  // Process each expired assignment
  for (const assignment of expiredAssignments) {
    await supabaseAdmin
      .from("worker_assignments")
      .update({
        status: "declined",
        assignment_reason: "Acceptance deadline expired",
      })
      .eq("id", assignment.id);

    await reassignBookingWorker(
      assignment.booking_id,
      assignment.worker_id,
      "timeout",
      "Worker did not accept within deadline",
    );
  }

  return { processed: expiredAssignments.length };
});

/**
 * Reassign a booking to the next eligible worker.
 */
async function reassignBookingWorker(
  bookingId: string,
  previousWorkerId: string,
  reason: "timeout" | "declined" | "no_show" | "cancelled",
  notes?: string,
) {
  // Update previous assignment status
  await supabaseAdmin
    .from("worker_assignments")
    .update({
      status: reason,
      assignment_reason: notes ?? `Worker ${reason}`,
    })
    .eq("booking_id", bookingId)
    .eq("worker_id", previousWorkerId);

  // Record event
  await supabaseAdmin.from("booking_events").insert({
    booking_id: bookingId,
    status_from: "pending_acceptance",
    status_to: "searching",
    event_type: `worker_${reason}`,
    actor_id: previousWorkerId,
    actor_role: "worker",
    notes: notes ?? `Worker marked as ${reason}. Seeking replacement.`,
  });

  // Reset booking to searching and seek next worker
  await supabaseAdmin.from("bookings").update({ status: "searching" }).eq("id", bookingId);

  // Attempt to assign to next eligible worker
  try {
    const result = await assignWorkerToBooking(bookingId);
    return result;
  } catch (error) {
    console.error("[reassign] Failed to assign new worker:", error);
    return { assigned: false, reason: "No other workers available" };
  }
}

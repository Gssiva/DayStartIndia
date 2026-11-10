import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Open a dispute for a booking.
 */
export const openDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookingId: string; reason: string }) =>
    z
      .object({
        bookingId: z.string(),
        reason: z.string().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Verify booking exists and user is the customer
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", data.bookingId)
      .eq("user_id", context.userId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found or you don't have permission to dispute this booking.");
    }

    // 2. Check if booking is in a state that allows disputes
    if (!["completed", "in_progress", "arrived"].includes(booking.status)) {
      throw new Error("Disputes can only be opened for completed or in-progress bookings.");
    }

    // 3. Check if dispute already exists
    const { data: existingDispute } = await supabaseAdmin
      .from("booking_disputes")
      .select("id")
      .eq("booking_id", data.bookingId)
      .maybeSingle();

    if (existingDispute) {
      throw new Error("A dispute already exists for this booking.");
    }

    // 4. Get worker assignment
    const { data: assignment } = await supabaseAdmin
      .from("worker_assignments")
      .select("worker_id")
      .eq("booking_id", data.bookingId)
      .eq("status", "assigned")
      .maybeSingle();

    if (!assignment) {
      throw new Error("No assigned worker found for this booking.");
    }

    // 5. Update booking status to under_review
    await supabaseAdmin
      .from("bookings")
      .update({ status: "under_review" })
      .eq("id", data.bookingId);

    // 6. Hold worker earnings
    await supabaseAdmin
      .from("worker_earnings")
      .update({ status: "held" })
      .eq("booking_id", data.bookingId);

    // 7. Create dispute record
    const { error: disputeError } = await supabaseAdmin.from("booking_disputes").insert({
      booking_id: data.bookingId,
      worker_id: assignment.worker_id,
      customer_id: context.userId,
      reason: data.reason,
      status: "opened",
    });

    if (disputeError) {
      console.error("[dispute] Failed to create dispute:", disputeError);
      throw new Error("Failed to create dispute. Please try again.");
    }

    // 8. Record booking event
    await supabaseAdmin.from("booking_events").insert({
      booking_id: data.bookingId,
      status_from: booking.status,
      status_to: "under_review",
      event_type: "dispute_opened",
      actor_id: context.userId,
      actor_role: "customer",
      notes: `Dispute opened: ${data.reason}`,
    });

    return { ok: true };
  });

/**
 * Get dispute details for a booking.
 */
export const getDisputeDetails = createServerFn({ method: "GET" })
  .inputValidator((d: { bookingId: string }) => z.object({ bookingId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { data: dispute, error } = await supabaseAdmin
      .from("booking_disputes")
      .select("*")
      .eq("booking_id", data.bookingId)
      .maybeSingle();

    if (error) {
      console.error("[dispute] Fetch failed:", error);
      throw new Error("Failed to load dispute details.");
    }

    return { dispute };
  });

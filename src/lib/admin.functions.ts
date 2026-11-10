import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, logAdminAudit } from "./security.server";

/**
 * List all workers for admin verification and oversight.
 * Protects sensitive financial details by masking.
 */
export const adminListWorkers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { status?: string }) =>
    z.object({ status: z.string().optional() }).optional().parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    let query = supabaseAdmin
      .from("worker_profiles")
      .select(
        "id, user_id, full_name, phone, alt_phone, experience_years, skill_categories, service_areas, approval_status, approval_date, approved_by, availability_status, rating, rating_count, completed_jobs_count, current_lat, current_lng, payout_preference, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (data?.status) {
      query = query.eq("approval_status", data.status);
    }

    const { data: workers, error } = await query;
    if (error) {
      console.error("[admin] Failed to list workers:", error);
      throw new Error("Failed to load worker list.");
    }

    return workers ?? [];
  });

/**
 * Approve or reject a worker profile.
 * When approved, automatically grants the "worker" role in user_roles.
 */
export const adminApproveWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workerUserId: string; approve: boolean; reviewerNote?: string }) =>
    z
      .object({
        workerUserId: z.string().uuid(),
        approve: z.boolean(),
        reviewerNote: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const newStatus = data.approve ? "approved" : "rejected";

    // 1. Update worker profile status
    const { data: updated, error: pError } = await supabaseAdmin
      .from("worker_profiles")
      .update({
        approval_status: newStatus,
        approval_date: data.approve ? new Date().toISOString() : null,
        approved_by: context.userId,
      })
      .eq("user_id", data.workerUserId)
      .select("*")
      .single();

    if (pError || !updated) {
      console.error("[admin] Failed to update worker approval:", pError);
      throw new Error("Failed to update worker approval status.");
    }

    // 2. If approved, ensure user has 'worker' role in user_roles
    if (data.approve) {
      await supabaseAdmin.from("user_roles").upsert(
        {
          user_id: data.workerUserId,
          role: "worker",
        },
        { onConflict: "user_id,role" },
      );
    }

    // 3. Log administrative audit trail
    await logAdminAudit({
      adminId: context.userId,
      action: data.approve ? "worker_approved" : "worker_rejected",
      targetType: "worker_profile",
      targetId: data.workerUserId,
      details: {
        workerUserId: data.workerUserId,
        approvalStatus: newStatus,
        reviewerNote: data.reviewerNote,
      },
    });

    // 4. Notify worker
    await supabaseAdmin.from("notifications").insert({
      user_id: data.workerUserId,
      title: data.approve ? "Application Approved! 🎉" : "Application Status Update",
      message: data.approve
        ? "Your DayStart worker profile is approved. You can now accept incoming jobs!"
        : `Your application could not be approved at this time. Note: ${data.reviewerNote || "Documentation incomplete"}`,
      type: data.approve ? "approval_success" : "approval_rejected",
      link: "/worker/dashboard",
    });

    return { ok: true, status: newStatus };
  });

/**
 * List all bookings across the platform with optional status filtering.
 */
export const adminListBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { status?: string; city?: string }) =>
    z
      .object({
        status: z.string().optional(),
        city: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    let query = supabaseAdmin
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    if (data?.status) {
      query = query.eq("status", data.status);
    }
    if (data?.city) {
      query = query.eq("city", data.city);
    }

    const { data: bookings, error } = await query;
    if (error) {
      console.error("[admin] Failed to list bookings:", error);
      throw new Error("Failed to load bookings.");
    }

    return bookings ?? [];
  });

/**
 * Manual worker assignment or override by an admin.
 */
export const adminOverrideAssignWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookingId: string; workerUserId: string; notes?: string }) =>
    z
      .object({
        bookingId: z.string().min(1),
        workerUserId: z.string().uuid(),
        notes: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Fetch worker profile
    const { data: worker, error: wError } = await supabaseAdmin
      .from("worker_profiles")
      .select("id, user_id, full_name, phone, rating, completed_jobs_count")
      .eq("user_id", data.workerUserId)
      .single();

    if (wError || !worker) {
      throw new Error("Worker profile not found.");
    }

    // Cancel any current assignment on this booking
    await supabaseAdmin
      .from("worker_assignments")
      .update({
        status: "cancelled",
        assignment_reason: "Admin manual reassignment override",
      })
      .eq("booking_id", data.bookingId)
      .in("status", ["assigned", "en_route"]);

    // Create new assignment
    const { data: assignment, error: aError } = await supabaseAdmin
      .from("worker_assignments")
      .insert({
        booking_id: data.bookingId,
        worker_id: data.workerUserId,
        status: "assigned",
        assignment_reason: data.notes || "Admin manual assignment override",
      })
      .select("id")
      .single();

    if (aError) {
      throw new Error("Failed to create worker assignment.");
    }

    // Update booking
    const workerJson = {
      id: worker.user_id,
      name: worker.full_name || "Verified Worker",
      rating: worker.rating,
      jobs: worker.completed_jobs_count,
      phone: worker.phone || "+91 90320 78142",
      assignedByAdmin: true,
    };

    await supabaseAdmin
      .from("bookings")
      .update({
        status: "assigned",
        worker: workerJson,
      })
      .eq("id", data.bookingId);

    // Log audit & event
    await logAdminAudit({
      adminId: context.userId,
      action: "admin_override_worker_assignment",
      targetType: "booking",
      targetId: data.bookingId,
      details: {
        workerUserId: data.workerUserId,
        assignmentId: assignment.id,
        notes: data.notes,
      },
    });

    await supabaseAdmin.from("booking_events").insert({
      booking_id: data.bookingId,
      status_to: "assigned",
      event_type: "admin_assignment_override",
      actor_id: context.userId,
      actor_role: "admin",
      notes: `Admin manually assigned worker ${worker.full_name}.`,
    });

    return { ok: true, assignmentId: assignment.id };
  });

/**
 * Resolve a booking dispute.
 */
export const adminResolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      disputeId: string;
      resolution: "resolved_refund" | "resolved_payout" | "dismissed";
      resolutionNotes: string;
    }) =>
      z
        .object({
          disputeId: z.string().uuid(),
          resolution: z.enum(["resolved_refund", "resolved_payout", "dismissed"]),
          resolutionNotes: z.string().min(5).max(1000),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: dispute, error } = await supabaseAdmin
      .from("booking_disputes")
      .select("*")
      .eq("id", data.disputeId)
      .single();

    if (error || !dispute) {
      throw new Error("Dispute not found.");
    }

    // Update dispute record
    await supabaseAdmin
      .from("booking_disputes")
      .update({
        status: data.resolution,
        resolution_notes: data.resolutionNotes,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.disputeId);

    // If resolved in favor of payout or dismissed, release the held earnings
    if (data.resolution === "resolved_payout" || data.resolution === "dismissed") {
      await supabaseAdmin
        .from("worker_earnings")
        .update({
          status: "available",
          hold_reason: null,
        })
        .eq("booking_id", dispute.booking_id)
        .eq("status", "held");
    }

    // Log admin audit
    await logAdminAudit({
      adminId: context.userId,
      action: "dispute_resolved",
      targetType: "booking_dispute",
      targetId: data.disputeId,
      details: {
        bookingId: dispute.booking_id,
        resolution: data.resolution,
        notes: data.resolutionNotes,
      },
    });

    return { ok: true };
  });

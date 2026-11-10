import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertWorker } from "./security.server";
import { recordEvidenceUpload, validateCompletionEvidence } from "./evidence-tracking.server";
import {
  getWorkerEarningsSummary,
  recordJobCompletionEarnings,
  requestWorkerPayout,
} from "./payouts.server";

/**
 * Worker self-registration.
 * Status defaults to "pending" until reviewed and approved by an admin.
 */
export const workerRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      fullName: string;
      phone: string;
      altPhone?: string;
      city: string;
      area: string;
      skills: string[];
      experienceYears: number;
      aadhaarLast4: string;
      eShramNumber?: string;
      termsAccepted: boolean;
    }) =>
      z
        .object({
          fullName: z.string().min(2).max(100),
          phone: z.string().regex(/^[6-9]\d{9}$/),
          altPhone: z
            .string()
            .regex(/^[6-9]\d{9}$/)
            .optional(),
          city: z.string().min(2).max(60),
          area: z.string().min(2).max(80),
          skills: z.array(z.string()).min(1),
          experienceYears: z.number().int().min(0).max(50),
          aadhaarLast4: z.string().regex(/^\d{4}$/),
          eShramNumber: z.string().max(30).optional(),
          termsAccepted: z.literal(true),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Check if profile already exists
    const { data: existing } = await supabaseAdmin
      .from("worker_profiles")
      .select("id, approval_status")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      return {
        ok: true,
        message: "Worker profile already registered.",
        approvalStatus: existing.approval_status,
      };
    }

    // 2. Create worker profile (strictly 'pending' approval)
    const { data: profile, error } = await supabaseAdmin
      .from("worker_profiles")
      .insert({
        user_id: context.userId,
        full_name: data.fullName,
        phone: data.phone,
        alt_phone: data.altPhone || null,
        district: data.city,
        state: "Andhra Pradesh",
        skill_categories: data.skills,
        experience_years: data.experienceYears,
        approval_status: "pending", // Strictly pending until admin approval
        availability_status: "offline",
        e_shram_number: data.eShramNumber || null,
        terms_accepted_at: new Date().toISOString(),
      })
      .select("id, approval_status")
      .single();

    if (error || !profile) {
      console.error("[worker] Registration failed:", error);
      throw new Error("Worker registration failed. Please try again.");
    }

    // 3. Also record registration metadata
    await supabaseAdmin.from("worker_registrations").insert({
      user_id: context.userId,
      full_name: data.fullName,
      phone: data.phone,
      city: data.city,
      area: data.area,
      category: data.skills[0] || "general",
      pay_model: "daily",
      aadhaar_last4: data.aadhaarLast4,
      status: "pending",
    });

    return {
      ok: true,
      message: "Worker registration submitted. Admin review is pending.",
      approvalStatus: "pending",
    };
  });

/**
 * Worker profile update (bank details, UPI, payout preferences).
 * Strips any attempted self-escalation or approval modification.
 */
export const workerUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      bankAccountName?: string;
      bankAccountNumber?: string;
      bankIfsc?: string;
      upiId?: string;
      payoutPreference?: "daily" | "weekly" | "monthly";
      languages?: string[];
    }) =>
      z
        .object({
          bankAccountName: z.string().max(100).optional(),
          bankAccountNumber: z.string().min(9).max(20).optional(),
          bankIfsc: z
            .string()
            .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/)
            .optional(),
          upiId: z
            .string()
            .regex(/^[\w.-]+@[\w.-]+$/)
            .optional(),
          payoutPreference: z.enum(["daily", "weekly", "monthly"]).optional(),
          languages: z.array(z.string()).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("worker_profiles")
      .update({
        bank_account_name: data.bankAccountName,
        bank_account_number: data.bankAccountNumber,
        bank_ifsc: data.bankIfsc,
        upi_id: data.upiId,
        payout_preference: data.payoutPreference,
        languages: data.languages,
      })
      .eq("user_id", context.userId);

    if (error) {
      console.error("[worker] Update profile failed:", error);
      throw new Error("Failed to update worker profile.");
    }

    return { ok: true };
  });

/**
 * Toggle worker availability (online / offline).
 * Only approved workers are permitted to go online.
 */
export const workerToggleAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { available: boolean }) => z.object({ available: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    // 1. Verify worker approval
    const { data: profile, error } = await supabaseAdmin
      .from("worker_profiles")
      .select("approval_status")
      .eq("user_id", context.userId)
      .single();

    if (error || !profile) {
      throw new Error("Worker profile not found.");
    }

    if (profile.approval_status !== "approved") {
      throw new Error(
        `Cannot go online: Worker account status is "${profile.approval_status}". You must be approved by DayStart admins first.`,
      );
    }

    const nextStatus = data.available ? "available" : "offline";

    await supabaseAdmin
      .from("worker_profiles")
      .update({
        availability_status: nextStatus,
        last_location_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);

    return { ok: true, availabilityStatus: nextStatus };
  });

/**
 * Update worker live coordinates for proximity matching within 10 km.
 */
export const workerUpdateLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lat: number; lng: number }) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await supabaseAdmin
      .from("worker_profiles")
      .update({
        current_lat: data.lat,
        current_lng: data.lng,
        last_location_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);

    return { ok: true };
  });

/**
 * Fetch jobs assigned to the authenticated worker.
 */
export const workerGetAssignedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: assignments, error } = await supabaseAdmin
      .from("worker_assignments")
      .select(
        "id, booking_id, status, assigned_at, arrived_at, started_at, completed_at, distance_km",
      )
      .eq("worker_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[worker] Failed to load assigned jobs:", error);
      throw new Error("Failed to load assigned jobs.");
    }

    return assignments ?? [];
  });

/**
 * Advance job status along lifecycle:
 * assigned -> en_route -> arrived -> started -> completed
 * Enforces mandatory work evidence check and triggers earnings calculation on completion.
 */
export const workerUpdateJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      bookingId: string;
      nextStatus: "en_route" | "arrived" | "started" | "completed";
      notes?: string;
    }) =>
      z
        .object({
          bookingId: z.string().min(1),
          nextStatus: z.enum(["en_route", "arrived", "started", "completed"]),
          notes: z.string().max(300).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Verify worker is assigned to this booking
    const { data: assignment, error: aError } = await supabaseAdmin
      .from("worker_assignments")
      .select("*")
      .eq("booking_id", data.bookingId)
      .eq("worker_id", context.userId)
      .in("status", ["assigned", "en_route", "arrived", "in_progress"])
      .maybeSingle();

    if (aError || !assignment) {
      throw new Error("You are not actively assigned to this booking.");
    }

    // 2. If completing, enforce mandatory photo evidence check
    if (data.nextStatus === "completed") {
      await validateCompletionEvidence(data.bookingId);
    }

    // 3. Map status to worker_assignments table
    const assignmentStatusMap: Record<string, string> = {
      en_route: "en_route",
      arrived: "arrived",
      started: "in_progress",
      completed: "completed",
    };

    const nextAssignmentStatus = assignmentStatusMap[data.nextStatus]!;
    const now = new Date().toISOString();

    const updateFields: {
      status: string;
      arrived_at?: string;
      started_at?: string;
      completed_at?: string;
    } = {
      status: nextAssignmentStatus,
    };
    if (data.nextStatus === "arrived") updateFields.arrived_at = now;
    if (data.nextStatus === "started") updateFields.started_at = now;
    if (data.nextStatus === "completed") updateFields.completed_at = now;

    await supabaseAdmin.from("worker_assignments").update(updateFields).eq("id", assignment.id);

    // 4. Update booking table status
    const bookingStatusMap: Record<string, string> = {
      en_route: "on_the_way",
      arrived: "arrived",
      started: "started",
      completed: "completed",
    };

    const nextBookingStatus = bookingStatusMap[data.nextStatus]!;
    await supabaseAdmin
      .from("bookings")
      .update({ status: nextBookingStatus })
      .eq("id", data.bookingId);

    // 5. If completing, calculate & record worker earnings
    if (data.nextStatus === "completed") {
      await recordJobCompletionEarnings(data.bookingId);
    }

    // 6. Record lifecycle event
    await supabaseAdmin.from("booking_events").insert({
      booking_id: data.bookingId,
      status_from: assignment.status,
      status_to: nextBookingStatus,
      event_type: `worker_${data.nextStatus}`,
      actor_id: context.userId,
      actor_role: "worker",
      notes: data.notes || `Worker transitioned job to ${data.nextStatus}.`,
    });

    return { ok: true, status: nextBookingStatus };
  });

/**
 * Submit work evidence metadata (photos uploaded to work-evidence bucket).
 */
export const workerSubmitEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      bookingId: string;
      evidenceType: "before" | "during" | "after" | "supervisor";
      filePath: string;
      notes?: string;
    }) =>
      z
        .object({
          bookingId: z.string().min(1),
          evidenceType: z.enum(["before", "during", "after", "supervisor"]),
          filePath: z.string().min(1),
          notes: z.string().max(300).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    return recordEvidenceUpload({
      bookingId: data.bookingId,
      workerId: context.userId,
      evidenceType: data.evidenceType,
      filePath: data.filePath,
      notes: data.notes,
    });
  });

/**
 * Fetch worker earnings summary.
 */
export const workerGetEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getWorkerEarningsSummary(context.userId);
  });

/**
 * Request payout for available earnings balance.
 */
export const workerRequestEarningsPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { amount?: number }) =>
    z.object({ amount: z.number().int().positive().optional() }).optional().parse(d),
  )
  .handler(async ({ data, context }) => {
    return requestWorkerPayout({
      workerId: context.userId,
      amount: data?.amount,
    });
  });

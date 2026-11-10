import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Booking, BookingStatus } from "./booking-store";
import { calculateBookingPricing, verifyServiceCoverage } from "./pricing.server";
import { assignWorkerToBooking } from "./worker-assignment.server";
import { validateCompletionEvidence, openBookingDispute } from "./evidence-tracking.server";

const STATUSES = [
  "created",
  "searching",
  "assigned",
  "on_the_way",
  "arrived",
  "started",
  "completed",
  "cancelled",
  "disputed",
] as const;

const FLOW: BookingStatus[] = [
  "created",
  "searching",
  "assigned",
  "on_the_way",
  "arrived",
  "started",
  "completed",
];

const slug = z.string().regex(/^[a-z0-9-]{2,60}$/);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBooking(r: any): Booking {
  return {
    id: r.id,
    createdAt: r.created_at,
    language: r.language,
    city: r.city,
    area: r.area,
    serviceId: r.service_slug,
    subId: r.sub_service_slug,
    workers: r.workers,
    timing: r.timing,
    date: r.booking_date,
    slot: r.slot,
    address: r.address,
    payment: r.payment,
    status: r.status,
    worker: r.worker,
    rating: r.rating ?? undefined,
    advanceAmount: r.advance_amount,
    balanceAmount: r.balance_amount,
    paymentStatus: r.payment_status,
    evidenceSubmitted: r.evidence_submitted,
    disputed: r.disputed,
  };
}

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[bookings] list failed", error);
      throw new Error("We couldn't load your bookings. Please try again.");
    }
    return (data ?? []).map(toBooking);
  });

export const getMyBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) throw new Error("We couldn't load this booking.");
    return row ? toBooking(row) : null;
  });

const createSchema = z.object({
  language: z.enum(["en", "te", "hi"]),
  city: z.string().min(1).max(60),
  area: z.string().min(1).max(80),
  serviceSlug: slug,
  subSlug: slug,
  workers: z.number().int().min(1).max(20),
  timing: z.enum(["immediate", "scheduled"]),
  date: z.string().max(20).nullable(),
  slot: z.string().max(40).nullable(),
  method: z.string().min(1).max(30),
  paymentOption: z.enum(["pay_now", "pay_after_completion"]),
  address: z.object({
    label: z.string().max(40),
    line1: z.string().min(3).max(200),
    landmark: z.string().max(120),
    instructions: z.string().max(300),
    phone: z.string().max(20),
    coords: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  }),
});

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof createSchema>) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    // 1. Verify service coverage in the requested city and area
    const coverage = await verifyServiceCoverage(data.city, data.area, data.address.coords);
    if (!coverage.covered) {
      throw new Error(coverage.message || "Requested area is outside our active service hubs.");
    }

    // 2. Compute authoritative server-side pricing and fee snapshots
    const pricing = await calculateBookingPricing({
      serviceSlug: data.serviceSlug,
      subServiceSlug: data.subSlug,
      workers: data.workers,
    });

    const paymentData = {
      method: data.method,
      advance: pricing.advanceAmount,
      remaining: pricing.balanceAmount,
      total: pricing.totalPrice,
      taxes: pricing.taxes,
      platformFee: pricing.platformFee,
      base: pricing.basePrice,
    };

    // 3. Create booking record with retry for ID collisions
    let createdRow: { id: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = `DS-${Math.floor(100000 + Math.random() * 899999)}`;
      const { data: row, error } = await supabaseAdmin
        .from("bookings")
        .insert({
          id,
          user_id: context.userId,
          service_id: pricing.serviceId,
          sub_service_id: pricing.subServiceId,
          service_slug: data.serviceSlug,
          sub_service_slug: data.subSlug,
          language: data.language,
          city: data.city,
          area: data.area,
          workers: pricing.workers,
          timing: data.timing,
          booking_date: data.timing === "scheduled" ? data.date : null,
          slot: data.timing === "scheduled" ? data.slot : null,
          address: data.address as unknown as import("@/integrations/supabase/types").Json,
          site_lat: data.address.coords?.lat ?? null,
          site_lng: data.address.coords?.lng ?? null,
          payment: paymentData as unknown as import("@/integrations/supabase/types").Json,
          price_snapshot:
            pricing.pricingSnapshot as unknown as import("@/integrations/supabase/types").Json,
          total_price: pricing.totalPrice,
          advance_amount: pricing.advanceAmount,
          balance_amount: pricing.balanceAmount,
          payment_status: "advance_paid", // In mock/demo booking, advance is captured
          status: "searching",
          worker: {} as unknown as import("@/integrations/supabase/types").Json,
        })
        .select("*")
        .single();

      if (!error && row) {
        createdRow = row;
        break;
      }

      if (error && error.code !== "23505") {
        console.error("[bookings] create failed", error);
        throw new Error("We couldn't save your booking. Please try again.");
      }
    }

    if (!createdRow) {
      throw new Error("We couldn't save your booking. Please try again.");
    }

    const bookingId = createdRow.id;

    // 4. Insert booking item line item
    await supabaseAdmin.from("booking_items").insert({
      booking_id: bookingId,
      title: `${pricing.serviceName} - ${pricing.subServiceName}`,
      quantity: pricing.workers,
      unit_price: pricing.unitPrice,
      total_price: pricing.basePrice,
    });

    // 5. Record initial booking lifecycle event
    await supabaseAdmin.from("booking_events").insert({
      booking_id: bookingId,
      status_to: "searching",
      event_type: "booking_created",
      actor_id: context.userId,
      actor_role: "customer",
      notes: `Booking created for ${pricing.workers} worker(s). Advance payment recorded.`,
    });

    // 6. Record payment transaction with idempotency key
    await supabaseAdmin.from("payment_transactions").insert({
      booking_id: bookingId,
      customer_id: context.userId,
      amount: pricing.advanceAmount,
      currency: "INR",
      payment_type: "advance_30",
      gateway_name: "mock_gateway",
      gateway_order_id: `ord_${bookingId}`,
      status: "successful",
      idempotency_key: `pay_${bookingId}_advance`,
      metadata: {
        method: data.method,
        total: pricing.totalPrice,
        advance: pricing.advanceAmount,
      },
    });

    // 7. Deterministic worker matching and assignment within 10 km
    try {
      const assignmentResult = await assignWorkerToBooking(bookingId);
      if (assignmentResult.assigned && assignmentResult.worker) {
        // Refresh booking with assigned worker details
        const { data: updatedRow } = await supabaseAdmin
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .single();

        if (updatedRow) {
          createdRow = updatedRow;
        }
      }
    } catch (assignError) {
      console.warn(
        "[bookings] Automatic assignment deferred or no eligible worker found:",
        assignError,
      );
    }

    return toBooking(createdRow);
  });

async function ownBooking(userId: string, id: string) {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) throw new Error("Booking not found.");
  return data as { id: string; status: BookingStatus };
}

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const b = await ownBooking(context.userId, data.id);
    if (!["created", "searching", "assigned"].includes(b.status)) {
      throw new Error("This booking can no longer be cancelled.");
    }

    // Cancel any active worker assignment
    await supabaseAdmin
      .from("worker_assignments")
      .update({
        status: "cancelled",
        assignment_reason: "Customer cancelled booking",
      })
      .eq("booking_id", b.id)
      .in("status", ["assigned", "en_route"]);

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", b.id);

    if (error) throw new Error("Cancellation failed. Please try again.");

    // Log lifecycle event
    await supabaseAdmin.from("booking_events").insert({
      booking_id: b.id,
      status_from: b.status,
      status_to: "cancelled",
      event_type: "customer_cancelled",
      actor_id: context.userId,
      actor_role: "customer",
      notes: "Customer initiated cancellation.",
    });

    return { ok: true };
  });

export const advanceMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const b = await ownBooking(context.userId, data.id);
    const i = FLOW.indexOf(b.status);
    if (i < 0 || i === FLOW.length - 1) return { status: b.status };
    const next = FLOW[i + 1]!;

    // Enforce evidence check if next is 'completed'
    if (next === "completed") {
      await validateCompletionEvidence(b.id);
    }

    await supabaseAdmin.from("bookings").update({ status: next }).eq("id", b.id);

    await supabaseAdmin.from("booking_events").insert({
      booking_id: b.id,
      status_from: b.status,
      status_to: next,
      event_type: `status_advanced_to_${next}`,
      actor_id: context.userId,
      actor_role: "customer",
      notes: `Status advanced to ${next}.`,
    });

    return { status: next };
  });

export const rateMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; rating: number; feedback?: string }) =>
    z
      .object({
        id: z.string().max(20),
        rating: z.number().int().min(1).max(5),
        feedback: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const b = await ownBooking(context.userId, data.id);
    if (b.status !== "completed") throw new Error("You can rate once the job is completed.");

    // Update booking rating
    await supabaseAdmin
      .from("bookings")
      .update({ rating: data.rating, rating_feedback: data.feedback || null })
      .eq("id", b.id);

    // Get assigned worker
    const { data: assignment } = await supabaseAdmin
      .from("worker_assignments")
      .select("worker_id")
      .eq("booking_id", b.id)
      .maybeSingle();

    // Insert or update reviews table
    await supabaseAdmin.from("reviews").upsert(
      {
        booking_id: b.id,
        customer_id: context.userId,
        worker_id: assignment?.worker_id || null,
        rating: data.rating,
        feedback: data.feedback || null,
      },
      { onConflict: "booking_id" },
    );

    // If worker assigned, recalculate worker profile rating
    if (assignment?.worker_id) {
      const { data: allReviews } = await supabaseAdmin
        .from("reviews")
        .select("rating")
        .eq("worker_id", assignment.worker_id);

      if (allReviews && allReviews.length > 0) {
        const sum = allReviews.reduce((acc, curr) => acc + curr.rating, 0);
        const avg = Math.round((sum / allReviews.length) * 100) / 100;
        await supabaseAdmin
          .from("worker_profiles")
          .update({
            rating: avg,
            rating_count: allReviews.length,
          })
          .eq("user_id", assignment.worker_id);
      }
    }

    return { ok: true };
  });

export const openMyBookingDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookingId: string; reason: string; notes?: string }) =>
    z
      .object({
        bookingId: z.string().max(20),
        reason: z.string().min(5).max(300),
        notes: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    return openBookingDispute({
      bookingId: data.bookingId,
      customerId: context.userId,
      reason: data.reason,
      notes: data.notes,
    });
  });

export { STATUSES };

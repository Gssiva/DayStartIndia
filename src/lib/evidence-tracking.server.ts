import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EvidenceType = "before" | "during" | "after" | "supervisor";

export interface RecordEvidenceParams {
  bookingId: string;
  workerId: string;
  evidenceType: EvidenceType;
  filePath: string;
  notes?: string;
}

export interface DisputeParams {
  bookingId: string;
  customerId: string;
  reason: string;
  notes?: string;
}

/**
 * Record a work evidence submission in the database.
 */
export async function recordEvidenceUpload(params: RecordEvidenceParams) {
  // 1. Verify worker assignment
  const { data: assignment, error: aError } = await supabaseAdmin
    .from("worker_assignments")
    .select("id")
    .eq("booking_id", params.bookingId)
    .eq("worker_id", params.workerId)
    .maybeSingle();

  if (aError || !assignment) {
    throw new Error("Worker is not assigned to this booking.");
  }

  // 2. Insert into booking_evidence
  const { data: evidence, error: eError } = await supabaseAdmin
    .from("booking_evidence")
    .insert({
      booking_id: params.bookingId,
      assignment_id: assignment.id,
      worker_id: params.workerId,
      evidence_type: params.evidenceType,
      file_path: params.filePath,
      bucket_id: "work-evidence",
      notes: params.notes || null,
      verified_by_admin: false,
    })
    .select("id")
    .single();

  if (eError || !evidence) {
    console.error("[evidence] Failed to save evidence metadata:", eError);
    throw new Error("Failed to record work evidence.");
  }

  // 3. Mark booking evidence_submitted as true
  await supabaseAdmin
    .from("bookings")
    .update({ evidence_submitted: true })
    .eq("id", params.bookingId);

  // 4. Log lifecycle event
  await supabaseAdmin.from("booking_events").insert({
    booking_id: params.bookingId,
    status_to: "evidence_uploaded",
    event_type: "evidence_submitted",
    actor_id: params.workerId,
    actor_role: "worker",
    notes: `Worker submitted "${params.evidenceType}" evidence (${params.filePath}).`,
    metadata: {
      evidenceId: evidence.id,
      evidenceType: params.evidenceType,
      filePath: params.filePath,
    },
  });

  return evidence;
}

/**
 * Validate that mandatory work evidence has been submitted before job completion.
 * Throws an Error if required evidence is missing.
 */
export async function validateCompletionEvidence(bookingId: string): Promise<void> {
  const { data: booking, error: bError } = await supabaseAdmin
    .from("bookings")
    .select("id, service_slug")
    .eq("id", bookingId)
    .single();

  if (bError || !booking) {
    throw new Error("Booking not found.");
  }

  // Fetch service evidence requirements
  const { data: service } = await supabaseAdmin
    .from("services")
    .select("evidence_requirements")
    .eq("slug", booking.service_slug)
    .maybeSingle();

  const requirements = (service?.evidence_requirements ?? {
    before_photos: true,
    after_photos: true,
  }) as { before_photos?: boolean; after_photos?: boolean; during_photos?: boolean };

  // Fetch all evidence uploaded for this booking
  const { data: evidenceList } = await supabaseAdmin
    .from("booking_evidence")
    .select("evidence_type")
    .eq("booking_id", bookingId);

  const uploadedTypes = new Set((evidenceList ?? []).map((e) => e.evidence_type));

  const missingTypes: string[] = [];
  if (requirements.before_photos && !uploadedTypes.has("before")) {
    missingTypes.push("before-work photo");
  }
  if (requirements.after_photos && !uploadedTypes.has("after")) {
    missingTypes.push("after-work completion photo");
  }

  if (missingTypes.length > 0) {
    throw new Error(
      `Cannot complete job: mandatory evidence missing [${missingTypes.join(", ")}]. Worker must upload required photos first.`,
    );
  }
}

/**
 * Open a formal dispute for a booking and immediately hold worker earnings.
 */
export async function openBookingDispute(params: DisputeParams) {
  // 1. Fetch booking
  const { data: booking, error: bError } = await supabaseAdmin
    .from("bookings")
    .select("id, status, user_id")
    .eq("id", params.bookingId)
    .single();

  if (bError || !booking) {
    throw new Error("Booking not found.");
  }

  if (booking.user_id !== params.customerId) {
    throw new Error("Unauthorized: Only the customer who placed this booking can raise a dispute.");
  }

  // 2. Identify assigned worker
  const { data: assignment } = await supabaseAdmin
    .from("worker_assignments")
    .select("worker_id")
    .eq("booking_id", params.bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workerId = assignment?.worker_id ?? null;

  // 3. Insert into booking_disputes
  const { data: dispute, error: dError } = await supabaseAdmin
    .from("booking_disputes")
    .insert({
      booking_id: params.bookingId,
      customer_id: params.customerId,
      worker_id: workerId,
      reason: params.reason,
      status: "opened",
      resolution_notes: params.notes || null,
    })
    .select("id")
    .single();

  if (dError) {
    console.error("[disputes] Failed to open dispute:", dError);
    throw new Error("Failed to register dispute. Please contact support.");
  }

  // 4. Update booking to disputed status
  await supabaseAdmin
    .from("bookings")
    .update({
      disputed: true,
      dispute_reason: params.reason,
      status: "disputed",
    })
    .eq("id", params.bookingId);

  // 5. Place worker earnings on HOLD immediately
  await supabaseAdmin
    .from("worker_earnings")
    .update({
      status: "held",
      hold_reason: `Dispute opened: ${params.reason}`,
    })
    .eq("booking_id", params.bookingId);

  // 6. Log booking event
  await supabaseAdmin.from("booking_events").insert({
    booking_id: params.bookingId,
    status_from: booking.status,
    status_to: "disputed",
    event_type: "dispute_opened",
    actor_id: params.customerId,
    actor_role: "customer",
    notes: `Customer opened dispute: "${params.reason}". Worker payouts placed on hold.`,
    metadata: {
      disputeId: dispute.id,
      reason: params.reason,
    },
  });

  return dispute;
}

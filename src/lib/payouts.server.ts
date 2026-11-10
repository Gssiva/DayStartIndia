import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface WorkerEarningsSummary {
  totalGross: number;
  totalPlatformCommission: number;
  availableBalance: number;
  heldBalance: number;
  paidBalance: number;
  completedJobsCount: number;
  payoutPreference: string;
}

/**
 * Record worker earnings when a job is successfully completed.
 * Commission rate is configured in pricing_config table.
 */
export async function recordJobCompletionEarnings(bookingId: string) {
  // 1. Fetch booking and assigned worker
  const { data: booking, error: bError } = await supabaseAdmin
    .from("bookings")
    .select("id, total_price, worker, status")
    .eq("id", bookingId)
    .single();

  if (bError || !booking) {
    throw new Error(`Booking ${bookingId} not found.`);
  }

  const { data: assignment, error: aError } = await supabaseAdmin
    .from("worker_assignments")
    .select("id, worker_id")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aError || !assignment) {
    throw new Error("No worker assignment found for this booking.");
  }

  // Check if earnings already recorded for this booking
  const { data: existing } = await supabaseAdmin
    .from("worker_earnings")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const grossAmount = booking.total_price || 0;

  // Fetch platform commission rate from pricing config
  const { data: pricingConfig } = await supabaseAdmin
    .from("pricing_config")
    .select("platform_commission_rate")
    .eq("is_active", true)
    .maybeSingle();

  const commissionRate = pricingConfig?.platform_commission_rate ?? 0;
  const platformFee = commissionRate > 0 ? Math.round(grossAmount * commissionRate) : 0;
  const netEarnings = grossAmount - platformFee;

  // Insert worker_earnings row
  const { data: earnings, error: eError } = await supabaseAdmin
    .from("worker_earnings")
    .insert({
      booking_id: bookingId,
      assignment_id: assignment.id,
      worker_id: assignment.worker_id,
      gross_amount: grossAmount,
      platform_fee: platformFee,
      net_earnings: netEarnings,
      status: "available",
    })
    .select("id")
    .single();

  if (eError || !earnings) {
    console.error("[payouts] Failed to record worker earnings:", eError);
    throw new Error("Failed to record worker earnings.");
  }

  // Increment worker completed jobs count
  const { data: profile } = await supabaseAdmin
    .from("worker_profiles")
    .select("completed_jobs_count")
    .eq("user_id", assignment.worker_id)
    .maybeSingle();

  const count = (profile?.completed_jobs_count ?? 0) + 1;

  await supabaseAdmin
    .from("worker_profiles")
    .update({ completed_jobs_count: count })
    .eq("user_id", assignment.worker_id);

  return earnings;
}

/**
 * Fetch total available, held, and paid balances for a worker.
 */
export async function getWorkerEarningsSummary(workerId: string): Promise<WorkerEarningsSummary> {
  const { data: earnings } = await supabaseAdmin
    .from("worker_earnings")
    .select("*")
    .eq("worker_id", workerId);

  const { data: profile } = await supabaseAdmin
    .from("worker_profiles")
    .select("completed_jobs_count, payout_preference")
    .eq("user_id", workerId)
    .maybeSingle();

  let totalGross = 0;
  let totalPlatformCommission = 0;
  let availableBalance = 0;
  let heldBalance = 0;
  let paidBalance = 0;

  for (const row of earnings ?? []) {
    totalGross += row.gross_amount;
    totalPlatformCommission += row.platform_fee;
    if (row.status === "available") {
      availableBalance += row.net_earnings;
    } else if (row.status === "held") {
      heldBalance += row.net_earnings;
    } else if (row.status === "paid") {
      paidBalance += row.net_earnings;
    }
  }

  return {
    totalGross,
    totalPlatformCommission,
    availableBalance,
    heldBalance,
    paidBalance,
    completedJobsCount: profile?.completed_jobs_count ?? 0,
    payoutPreference: profile?.payout_preference ?? "daily",
  };
}

/**
 * Create a new payout request for available earnings.
 */
export async function requestWorkerPayout(params: {
  workerId: string;
  amount?: number;
  notes?: string;
}) {
  const summary = await getWorkerEarningsSummary(params.workerId);

  const amount = params.amount ?? summary.availableBalance;
  if (amount <= 0) {
    throw new Error("No available earnings to withdraw.");
  }

  if (amount > summary.availableBalance) {
    throw new Error(
      `Requested amount (₹${amount}) exceeds available balance (₹${summary.availableBalance}).`,
    );
  }

  // Get payout account info snapshot
  const { data: profile } = await supabaseAdmin
    .from("worker_profiles")
    .select("bank_account_name, bank_account_number, bank_ifsc, upi_id, payout_preference")
    .eq("user_id", params.workerId)
    .single();

  const payoutMethod = profile?.upi_id ? "upi" : "bank_transfer";
  const accountSnapshot = {
    bank_account_name: profile?.bank_account_name,
    bank_account_number: profile?.bank_account_number
      ? `****${profile.bank_account_number.slice(-4)}`
      : null,
    bank_ifsc: profile?.bank_ifsc,
    upi_id: profile?.upi_id,
    payout_preference: profile?.payout_preference || "daily",
  };

  const { data: payout, error } = await supabaseAdmin
    .from("payout_requests")
    .insert({
      worker_id: params.workerId,
      amount,
      status: "requested",
      payout_method: payoutMethod,
      account_snapshot: accountSnapshot as import("@/integrations/supabase/types").Json,
      notes: params.notes || null,
    })
    .select("id")
    .single();

  if (error || !payout) {
    console.error("[payouts] Failed to create payout request:", error);
    throw new Error("Failed to submit payout request.");
  }

  return payout;
}

/**
 * Admin action: Process and complete a payout request.
 */
export async function processPayoutRequest(params: {
  payoutRequestId: string;
  adminId: string;
  referenceId: string;
  notes?: string;
}) {
  const { data: payout, error } = await supabaseAdmin
    .from("payout_requests")
    .select("*")
    .eq("id", params.payoutRequestId)
    .single();

  if (error || !payout) {
    throw new Error("Payout request not found.");
  }

  if (payout.status === "completed") {
    return { ok: true, message: "Payout already completed." };
  }

  // Update payout request
  await supabaseAdmin
    .from("payout_requests")
    .update({
      status: "completed",
      reference_id: params.referenceId,
      processed_by: params.adminId,
      processed_at: new Date().toISOString(),
      notes: params.notes ?? payout.notes,
    })
    .eq("id", params.payoutRequestId);

  // Mark available earnings up to this amount as paid
  const { data: availableRows } = await supabaseAdmin
    .from("worker_earnings")
    .select("id, net_earnings")
    .eq("worker_id", payout.worker_id)
    .eq("status", "available")
    .order("created_at", { ascending: true });

  let remainingToMark = payout.amount;
  for (const row of availableRows ?? []) {
    if (remainingToMark <= 0) break;
    await supabaseAdmin.from("worker_earnings").update({ status: "paid" }).eq("id", row.id);
    remainingToMark -= row.net_earnings;
  }

  return { ok: true, payoutId: payout.id };
}

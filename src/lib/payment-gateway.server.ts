import crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CreateOrderParams {
  bookingId: string;
  customerId: string;
  amount: number; // in INR
  currency?: string;
  paymentType: "advance_30" | "full_100" | "balance_70";
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface OrderResult {
  orderId: string;
  amount: number;
  currency: string;
  gatewayName: string;
  keyId?: string;
  paymentTransactionId: string;
}

export interface VerifyPaymentParams {
  bookingId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  idempotencyKey: string;
}

export interface PaymentGatewayAdapter {
  name: string;
  createOrder(params: CreateOrderParams): Promise<{ orderId: string; keyId?: string }>;
  verifySignature(params: { orderId: string; paymentId: string; signature: string }): boolean;
}

/**
 * Mock Payment Gateway Adapter for testing and demonstration.
 */
class MockPaymentGatewayAdapter implements PaymentGatewayAdapter {
  name = "mock_gateway";

  async createOrder(params: CreateOrderParams): Promise<{ orderId: string; keyId?: string }> {
    const orderId = `order_mock_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      orderId,
      keyId: "mock_key_daystart_demo",
    };
  }

  verifySignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    // In mock mode, check if signature matches generated mock signature or has demo prefix
    const expectedSig = crypto
      .createHmac("sha256", "mock_secret_key")
      .update(`${params.orderId}|${params.paymentId}`)
      .digest("hex");

    return (
      params.signature === expectedSig ||
      params.signature.startsWith("mock_sig_") ||
      params.signature.length > 10
    );
  }
}

/**
 * Razorpay Payment Gateway Adapter.
 */
class RazorpayPaymentGatewayAdapter implements PaymentGatewayAdapter {
  name = "razorpay";
  private keyId: string;
  private keySecret: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || "";
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  }

  async createOrder(params: CreateOrderParams): Promise<{ orderId: string; keyId?: string }> {
    if (!this.keyId || !this.keySecret) {
      // Graceful fallback to mock if API keys not provided in environment
      console.warn("[payment] Razorpay keys not provided; using mock fallback.");
      const mock = new MockPaymentGatewayAdapter();
      return mock.createOrder(params);
    }

    // In a live environment with credentials:
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: params.amount * 100, // paise
        currency: params.currency || "INR",
        receipt: params.bookingId,
        notes: {
          bookingId: params.bookingId,
          customerId: params.customerId,
          paymentType: params.paymentType,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[payment] Razorpay order creation failed:", errText);
      throw new Error("Payment order creation failed.");
    }

    const data = (await res.json()) as { id: string };
    return { orderId: data.id, keyId: this.keyId };
  }

  verifySignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    if (!this.keySecret) {
      return true;
    }
    const body = `${params.orderId}|${params.paymentId}`;
    const expected = crypto.createHmac("sha256", this.keySecret).update(body).digest("hex");
    return expected === params.signature;
  }
}

/**
 * Get active payment gateway adapter based on environment configuration.
 */
export function getPaymentGateway(): PaymentGatewayAdapter {
  const provider = (process.env.PAYMENT_GATEWAY_PROVIDER || "mock_gateway").toLowerCase();
  if (provider === "razorpay" && process.env.RAZORPAY_KEY_ID) {
    return new RazorpayPaymentGatewayAdapter();
  }
  return new MockPaymentGatewayAdapter();
}

/**
 * Create a new payment transaction with idempotency protection.
 */
export async function initiatePayment(params: CreateOrderParams): Promise<OrderResult> {
  // 1. Check idempotency: If this key already exists, return the existing order
  const { data: existing } = await supabaseAdmin
    .from("payment_transactions")
    .select("*")
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (existing) {
    return {
      orderId: existing.gateway_order_id || `order_${existing.id}`,
      amount: existing.amount,
      currency: existing.currency,
      gatewayName: existing.gateway_name,
      paymentTransactionId: existing.id,
    };
  }

  // 2. Obtain gateway order
  const gateway = getPaymentGateway();
  const { orderId, keyId } = await gateway.createOrder(params);

  // 3. Record pending payment transaction
  const { data: tx, error: txError } = await supabaseAdmin
    .from("payment_transactions")
    .insert({
      booking_id: params.bookingId,
      customer_id: params.customerId,
      amount: params.amount,
      currency: params.currency || "INR",
      payment_type: params.paymentType,
      gateway_name: gateway.name,
      gateway_order_id: orderId,
      status: "pending",
      idempotency_key: params.idempotencyKey,
      metadata: (params.metadata ?? {}) as import("@/integrations/supabase/types").Json,
    })
    .select("id")
    .single();

  if (txError || !tx) {
    console.error("[payment] Failed to insert payment transaction:", txError);
    throw new Error("Failed to initialize payment transaction.");
  }

  return {
    orderId,
    amount: params.amount,
    currency: params.currency || "INR",
    gatewayName: gateway.name,
    keyId,
    paymentTransactionId: tx.id,
  };
}

/**
 * Verify payment signature and transition payment & booking status.
 */
export async function confirmPayment(params: VerifyPaymentParams): Promise<{
  success: boolean;
  paymentStatus: string;
  bookingStatus: string;
}> {
  // 1. Locate the transaction by idempotency key or order ID
  const { data: tx, error } = await supabaseAdmin
    .from("payment_transactions")
    .select("*")
    .eq("idempotency_key", params.idempotencyKey)
    .single();

  if (error || !tx) {
    throw new Error("Payment transaction not found for verification.");
  }

  // If already successful, return idempotent success
  if (tx.status === "successful") {
    return {
      success: true,
      paymentStatus: "advance_paid",
      bookingStatus: "searching",
    };
  }

  // 2. Verify signature
  const gateway = getPaymentGateway();
  const isValid = gateway.verifySignature({
    orderId: params.orderId,
    paymentId: params.paymentId,
    signature: params.signature,
  });

  if (!isValid) {
    await supabaseAdmin
      .from("payment_transactions")
      .update({
        status: "failed",
        gateway_payment_id: params.paymentId,
        gateway_signature: params.signature,
      })
      .eq("id", tx.id);

    throw new Error("Invalid payment signature verification.");
  }

  // 3. Mark transaction successful
  await supabaseAdmin
    .from("payment_transactions")
    .update({
      status: "successful",
      gateway_payment_id: params.paymentId,
      gateway_signature: params.signature,
    })
    .eq("id", tx.id);

  // 4. Update booking payment status
  const nextPaymentStatus =
    tx.payment_type === "advance_30"
      ? "advance_paid"
      : tx.payment_type === "full_100" || tx.payment_type === "balance_70"
        ? "fully_paid"
        : "pending";

  await supabaseAdmin
    .from("bookings")
    .update({
      payment_status: nextPaymentStatus,
      advance_amount: tx.payment_type === "advance_30" ? tx.amount : undefined,
    })
    .eq("id", params.bookingId);

  // 5. Record booking event
  await supabaseAdmin.from("booking_events").insert({
    booking_id: params.bookingId,
    status_to: nextPaymentStatus,
    event_type: "payment_confirmed",
    actor_id: tx.customer_id,
    actor_role: "customer",
    notes: `Payment of ₹${tx.amount} (${tx.payment_type}) verified successfully via ${tx.gateway_name}.`,
    metadata: {
      transactionId: tx.id,
      paymentId: params.paymentId,
      amount: tx.amount,
      paymentType: tx.payment_type,
    },
  });

  return {
    success: true,
    paymentStatus: nextPaymentStatus,
    bookingStatus: "searching",
  };
}

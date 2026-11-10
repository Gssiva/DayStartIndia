import { createServerFn } from "@tanstack/react-start";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SendOtpParams {
  phone?: string;
  email?: string;
}

export interface VerifyOtpParams {
  phone?: string;
  email?: string;
  code: string;
}

/**
 * Generate a 6-digit OTP code.
 */
function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash the OTP code for secure storage.
 */
function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Send OTP via email or mobile.
 * For email: Uses Supabase Auth's built-in email OTP.
 * For mobile: Stores in phone_otp_requests table (requires SMS gateway integration).
 */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((data: SendOtpParams) => {
    const phone = typeof data.phone === "string" ? data.phone.trim() : undefined;
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : undefined;

    if (!phone && !email) {
      throw new Error("Either phone or email is required.");
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      throw new Error("Invalid mobile number. Must be 10 digits starting with 6-9.");
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new Error("Invalid email address.");
    }

    return { phone, email };
  })
  .handler(async ({ data }) => {
    try {
      if (data.email) {
        // Use Supabase Auth's built-in email OTP
        const { error } = await supabaseAdmin.auth.signInWithOtp({
          email: data.email,
          options: {
            emailRedirectTo: `${process.env.VITE_SUPABASE_URL}/auth/callback`,
          },
        });

        if (error) {
          console.error("[otp] Email OTP send failed:", error);
          throw new Error("Failed to send OTP to email. Please try again.");
        }

        return { success: true, method: "email", sentTo: data.email };
      }

      if (data.phone) {
        // For mobile OTP, store in phone_otp_requests table
        // Note: This requires SMS gateway integration (e.g., Twilio, MSG91)
        const otpCode = generateOtpCode();
        const codeHash = hashOtpCode(otpCode);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Clean up old OTPs for this phone
        await supabaseAdmin
          .from("phone_otp_requests")
          .delete()
          .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .eq("phone", data.phone);

        // Insert new OTP
        const { error } = await supabaseAdmin.from("phone_otp_requests").insert({
          phone: data.phone,
          code_hash: codeHash,
          expires_at: expiresAt.toISOString(),
        });

        if (error) {
          console.error("[otp] Mobile OTP storage failed:", error);
          throw new Error("Failed to generate OTP. Please try again.");
        }

        // TODO: Integrate SMS gateway here
        // For now, log the OTP for development (REMOVE IN PRODUCTION)
        console.log(`[OTP DEV] Mobile OTP for ${data.phone}: ${otpCode}`);

        return {
          success: true,
          method: "mobile",
          sentTo: data.phone,
          // In development, return the OTP for testing
          devOtp: process.env.NODE_ENV === "development" ? otpCode : undefined,
        };
      }

      throw new Error("Invalid OTP request.");
    } catch (err) {
      console.error("[otp] Send OTP failed:", err);
      throw err instanceof Error ? err : new Error("Failed to send OTP.");
    }
  });

/**
 * Verify OTP code.
 * For email: Uses Supabase Auth's built-in verification.
 * For mobile: Checks against stored hash in phone_otp_requests.
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: VerifyOtpParams) => {
    const phone = typeof data.phone === "string" ? data.phone.trim() : undefined;
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : undefined;
    const code = typeof data.code === "string" ? data.code.trim() : "";

    if (!phone && !email) {
      throw new Error("Either phone or email is required.");
    }

    if (!code || !/^\d{6}$/.test(code)) {
      throw new Error("Invalid OTP code. Must be 6 digits.");
    }

    return { phone, email, code };
  })
  .handler(async ({ data }) => {
    try {
      if (data.email) {
        // Use Supabase Auth's built-in email OTP verification
        const { data: authData, error } = await supabaseAdmin.auth.verifyOtp({
          email: data.email,
          token: data.code,
          type: "email",
        });

        if (error || !authData.user) {
          throw new Error("Invalid or expired OTP code.");
        }

        return {
          success: true,
          userId: authData.user.id,
          email: authData.user.email,
        };
      }

      if (data.phone) {
        // Verify mobile OTP against stored hash
        const codeHash = hashOtpCode(data.code);

        const { data: otpRecord, error } = await supabaseAdmin
          .from("phone_otp_requests")
          .select("*")
          .eq("phone", data.phone)
          .eq("code_hash", codeHash)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !otpRecord) {
          throw new Error("Invalid or expired OTP code.");
        }

        // Delete the used OTP
        await supabaseAdmin.from("phone_otp_requests").delete().eq("id", otpRecord.id);

        // Check if user exists with this phone
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .eq("phone", data.phone)
          .maybeSingle();

        if (profile) {
          // User exists - return user ID for session creation
          return {
            success: true,
            userId: profile.id,
            phone: data.phone,
            isNewUser: false,
          };
        }

        // New user - return phone for registration
        return {
          success: true,
          phone: data.phone,
          isNewUser: true,
        };
      }

      throw new Error("Invalid OTP verification request.");
    } catch (err) {
      console.error("[otp] Verify OTP failed:", err);
      throw err instanceof Error ? err : new Error("Failed to verify OTP.");
    }
  });

/**
 * Check if a phone number is already registered.
 */
export const checkPhoneExists = createServerFn({ method: "GET" })
  .inputValidator((data: { phone: string }) => {
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new Error("Invalid mobile number.");
    }
    return { phone };
  })
  .handler(async ({ data }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .maybeSingle();

    return { exists: !!profile };
  });

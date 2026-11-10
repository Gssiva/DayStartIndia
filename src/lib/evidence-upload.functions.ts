import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Upload evidence photo to Supabase storage.
 */
export const uploadEvidencePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { bookingId: string; evidenceType: string; fileBase64: string; fileName: string }) =>
      z
        .object({
          bookingId: z.string(),
          evidenceType: z.enum(["before", "during", "after", "dispute"]),
          fileBase64: z.string(),
          fileName: z.string(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Verify user has permission to upload for this booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", data.bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found.");
    }

    // Check if user is the customer
    const isCustomer = booking.user_id === context.userId;

    // Check if user is the assigned worker
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("worker_assignments")
      .select("*")
      .eq("booking_id", data.bookingId)
      .eq("worker_id", context.userId)
      .eq("status", "assigned")
      .maybeSingle();

    const isWorker = !assignmentError && !!assignment;

    if (!isCustomer && !isWorker) {
      throw new Error("You don't have permission to upload evidence for this booking.");
    }

    // 2. Convert base64 to buffer
    const base64Data = data.fileBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // 3. Generate unique file path
    const timestamp = Date.now();
    const filePath = `${data.bookingId}/${data.evidenceType}/${timestamp}-${data.fileName}`;

    // 4. Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("work-evidence")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("[evidence] Upload failed:", uploadError);
      throw new Error("Failed to upload photo. Please try again.");
    }

    // 5. Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("work-evidence")
      .getPublicUrl(filePath);

    // 6. Record evidence in database
    const assignmentId = assignment?.id || null;

    const { error: dbError } = await supabaseAdmin.from("booking_evidence").insert({
      booking_id: data.bookingId,
      assignment_id: assignmentId,
      worker_id: context.userId,
      evidence_type: data.evidenceType,
      file_path: filePath,
      bucket_id: "work-evidence",
      notes: `Uploaded by ${isWorker ? "worker" : "customer"}`,
    });

    if (dbError) {
      console.error("[evidence] Database insert failed:", dbError);
      // Attempt to cleanup uploaded file
      await supabaseAdmin.storage.from("work-evidence").remove([filePath]);
      throw new Error("Failed to record evidence. Please try again.");
    }

    return {
      success: true,
      filePath,
      publicUrl: publicUrlData.publicUrl,
    };
  });

/**
 * Get all evidence for a booking.
 */
export const getBookingEvidence = createServerFn({ method: "GET" })
  .inputValidator((d: { bookingId: string }) => z.object({ bookingId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { data: evidence, error } = await supabaseAdmin
      .from("booking_evidence")
      .select("*")
      .eq("booking_id", data.bookingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[evidence] Fetch failed:", error);
      throw new Error("Failed to load evidence.");
    }

    return { evidence: evidence || [] };
  });

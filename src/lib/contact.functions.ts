import { createServerFn } from "@tanstack/react-start";

export const CONTACT_TOPICS = {
  booking: "Booking enquiry",
  support: "Help with an existing booking",
  business: "Business / bulk requirement",
  other: "Something else",
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;

export type ContactInput = {
  name: string;
  phone: string;
  email: string;
  topic: ContactTopic;
  service: string;
  message: string;
  /** Honeypot — real users never fill this in. */
  website?: string;
};

const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

// Tiny in-memory throttle (per phone number): 3 enquiries / hour.
const recent = new Map<string, number[]>();

/**
 * Saves every enquiry to the `contact_messages` table and emails it to the DayStart team
 * (CONTACT_TO, default gsk@daystart.co.in). The enquiry succeeds if at least one of the two
 * worked, so a missing SMTP login never loses a customer's message (and vice-versa).
 */
export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: ContactInput) => data)
  .handler(async ({ data }) => {
    if (data.website?.trim()) return { ok: true }; // bot — pretend success

    const name = (data.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    const digits = (data.phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
    const phone = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
    const email = (data.email ?? "").trim().toLowerCase().slice(0, 254);
    const message = (data.message ?? "").trim().slice(0, 3000);
    const service = (data.service ?? "").trim().slice(0, 60);
    const topic: ContactTopic = data.topic in CONTACT_TOPICS ? data.topic : "other";

    if (name.length < 2) throw new Error("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(phone))
      throw new Error("Please enter a valid 10-digit mobile number.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      throw new Error("Please enter a valid email address.");
    if (message.length < 10)
      throw new Error("Please tell us a little more (at least 10 characters).");

    const now = Date.now();
    const hits = (recent.get(phone) ?? []).filter((t) => now - t < 3_600_000);
    if (hits.length >= 3)
      throw new Error("You've sent several enquiries already. Please call us on +91 90320 78142.");
    recent.set(phone, [...hits, now]);

    const topicLabel = CONTACT_TOPICS[topic];
    const serviceLabel = topic === "booking" ? service || "—" : null;

    // 1) Save to the database (best effort — logged if the table isn't created yet).
    let saved = false;
    try {
      const { adminClient, assertServerReady } = await import("./supabase-admin.server");
      assertServerReady();
      const { error } = await adminClient()
        .from("contact_messages" as never)
        .insert({ name, phone, email, topic, service: serviceLabel, message } as never);
      if (error) console.error("[contact] could not save enquiry:", error.message);
      else saved = true;
    } catch (err) {
      console.error("[contact] could not save enquiry:", err instanceof Error ? err.message : err);
    }

    // 2) Email the team.
    let emailed = false;
    const { sendMail, emailConfigured } = await import("./mail.server");
    if (emailConfigured()) {
      const to = process.env["CONTACT_TO"]?.trim() || "gsk@daystart.co.in";
      const when = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
      const rows: [string, string][] = [
        ["Name", name],
        ["Phone", `+91 ${phone}`],
        ["Email", email],
        ["Topic", topicLabel],
        ...(serviceLabel ? ([["Service needed", serviceLabel]] as [string, string][]) : []),
        ["Message", message],
        ["Received", `${when} IST`],
      ];
      try {
        await sendMail({
          to,
          replyTo: email,
          subject: `New DayStart enquiry — ${topicLabel} · ${name}`,
          text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
          html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px">
<h2 style="margin:0 0 4px;color:#0f172a">New website enquiry</h2>
<p style="margin:0 0 16px;color:#64748b;font-size:13px">Submitted via the DayStart contact page</p>
<table cellpadding="10" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="background:#f8fafc;border-bottom:1px solid #e2e8f0;width:34%;font-weight:600;color:#334155;vertical-align:top">${esc(k)}</td><td style="border-bottom:1px solid #e2e8f0;color:#0f172a;white-space:pre-wrap">${esc(v)}</td></tr>`).join("")}
</table></div>`,
        });
        emailed = true;
      } catch {
        /* already logged in mail.server */
      }

      // Friendly acknowledgement to the sender (best effort).
      if (emailed) {
        void sendMail({
          to: email,
          subject: "We received your DayStart enquiry",
          text: `Hi ${name},\n\nThanks for contacting DayStart. Our team will call you on +91 ${phone} within 2 working hours.\n\n— Team DayStart`,
          html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;color:#0f172a"><p>Hi ${esc(name)},</p><p>Thanks for contacting <strong>DayStart</strong>. Our team will call you on <strong>+91 ${esc(phone)}</strong> within 2 working hours.</p><p style="color:#64748b">— Team DayStart</p></div>`,
        }).catch(() => undefined);
      }
    } else {
      console.error("[contact] MAIL_USERNAME / MAIL_PASSWORD missing — enquiry not emailed.");
    }

    if (!saved && !emailed) {
      throw new Error(
        process.env["NODE_ENV"] === "production"
          ? "Messages are temporarily unavailable. Please call us on +91 90320 78142."
          : "Could not save or email the enquiry. Run supabase/setup.sql in Supabase (creates contact_messages) and/or add MAIL_USERNAME + MAIL_PASSWORD to .env, then restart.",
      );
    }
    return { ok: true };
  });

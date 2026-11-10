import nodemailer from "nodemailer";

function mailConfig() {
  const env = process.env;
  const user = env["MAIL_USERNAME"] ?? env["SMTP_USER"];
  const pass = (env["MAIL_PASSWORD"] ?? env["SMTP_PASS"] ?? "").replace(/\s+/g, ""); // Gmail shows app passwords with spaces
  if (!user || !pass) return null;
  const port = Number(env["MAIL_PORT"] ?? env["SMTP_PORT"] ?? 587);
  return {
    host: env["MAIL_SERVER"] ?? env["SMTP_HOST"] ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    requireTLS: String(env["MAIL_USE_TLS"] ?? "true").toLowerCase() !== "false" && port !== 465,
    user,
    pass,
    from: env["MAIL_FROM"] ?? `DayStart <${user}>`,
  };
}

export const emailConfigured = () => mailConfig() !== null;

/** Sends any email over the configured SMTP account. Returns false when SMTP is not configured. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<boolean> {
  const cfg = mailConfig();
  if (!cfg) return false;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: cfg.requireTLS,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transporter.sendMail({ from: cfg.from, ...opts });
  } catch (err) {
    console.error("[mail] send failed:", err instanceof Error ? err.message : err);
    throw new Error("Could not send the email right now. Please try again in a moment.");
  }
  return true;
}

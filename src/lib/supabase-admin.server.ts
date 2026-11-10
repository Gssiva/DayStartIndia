import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getServerConfig() {
  const url = process.env["SUPABASE_URL"]?.trim();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();

  if (!url || !key) {
    console.error("[auth] Missing Supabase server environment variables", {
      hasUrl: Boolean(url),
      hasKey: Boolean(key),
    });

    throw new Error(
      "Server configuration is incomplete. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!url.startsWith("https://")) {
    throw new Error("SUPABASE_URL must be an HTTPS project URL.");
  }

  return { url, key };
}

export function assertServerReady() {
  getServerConfig();
}

export function adminClient() {
  const { url, key } = getServerConfig();

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function describeDbError(
  error: { message?: string; code?: string } | null | undefined,
  fallback: string,
): Error {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  console.error("[db] Supabase operation failed:", { code, message });

  if (/42P01|PGRST205|schema cache|does not exist/i.test(`${code} ${message}`)) {
    return new Error("Database table or column is missing. Check your Supabase database schema.");
  }

  if (/invalid api key|apikey|unauthorized|JWT/i.test(message)) {
    return new Error(
      "Supabase rejected the server credentials. Check your project URL and server key.",
    );
  }

  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network|timeout/i.test(message)) {
    return new Error(
      "Could not connect to Supabase. Check your project URL and internet connection.",
    );
  }

  if (code === "23505") {
    return new Error("This email or mobile number is already registered.");
  }

  if (process.env["NODE_ENV"] !== "production" && message) {
    return new Error(`${fallback} (${code ? `${code}: ` : ""}${message})`);
  }

  return new Error(fallback);
}

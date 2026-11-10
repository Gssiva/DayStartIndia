// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Server functions read non-VITE_ secrets (SMTP, service key) from process.env — load .env for dev.
// Empty/blank variables already present in the shell are overridden by the .env value.
const dotenv = loadEnv(
  process.env.NODE_ENV === "production" ? "production" : "development",
  process.cwd(),
  "",
);
for (const [k, v] of Object.entries(dotenv)) {
  if (!process.env[k]?.trim() && v?.trim()) process.env[k] = v.trim();
}
if (process.env.NODE_ENV !== "production") {
  const has = (k: string) => (process.env[k]?.trim() ? "✔ loaded" : "✘ MISSING");
  console.log(
    `\n[env] SUPABASE_SERVICE_ROLE_KEY ${has("SUPABASE_SERVICE_ROLE_KEY")} · MAIL_USERNAME ${has("MAIL_USERNAME")} · MAIL_PASSWORD ${has("MAIL_PASSWORD")}  (from ${process.cwd()}/.env)\n`,
  );
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

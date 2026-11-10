import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setRememberMe } from "@/lib/auth-session";
import { useServerFn } from "@tanstack/react-start";
import { sendOtp, verifyOtp } from "@/lib/otp-auth.functions";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login — DayStart" },
      {
        name: "description",
        content:
          "Log in to your DayStart account with your email and password to book verified workers.",
      },
      { property: "og:title", content: "Login — DayStart" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function safeRedirect(target: string | undefined, fallback: string) {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);

  const destination = safeRedirect(search.redirect, "/");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneValid = /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""));

  const sendOtpFn = useServerFn(sendOtp);
  const verifyOtpFn = useServerFn(verifyOtp);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: destination, replace: true });
    });
  }, [destination, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (method === "password") {
      if (!emailValid) return setError("Enter a valid email address.");
      if (!password) return setError("Enter your password.");
      setLoading(true);
      try {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (err) {
          throw new Error(
            /invalid login|credentials/i.test(err.message)
              ? "Incorrect email or password."
              : /fetch|network/i.test(err.message)
                ? "Can't reach the server. Check your internet connection and try again."
                : err.message,
          );
        }
        setRememberMe(remember);
        for (let i = 0; i < 10; i += 1) {
          const { data } = await supabase.auth.getSession();
          if (data.session) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        navigate({ href: destination, replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleSendOtp() {
    setError(null);
    setOtpSending(true);

    try {
      const result = await sendOtpFn({
        data: {
          email: method === "otp" && emailValid ? email : undefined,
          phone: method === "otp" && phoneValid ? phone : undefined,
        },
      });

      if (result.success) {
        setOtpSent(true);
        setDevOtp(result.devOtp || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setLoading(true);

    try {
      const result = await verifyOtpFn({
        data: {
          email: emailValid ? email : undefined,
          phone: phoneValid ? phone : undefined,
          code: otpCode,
        },
      });

      if (result.success) {
        if (result.isNewUser) {
          // Redirect to registration
          navigate({ href: "/register" });
        } else if (result.userId) {
          // Create session for existing user
          // Note: For mobile OTP, we need to create a session via Supabase Auth
          // This is a simplified version - in production, you'd use a proper auth flow
          setRememberMe(remember);
          navigate({ href: destination, replace: true });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-red hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
      </Link>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Logo className="mb-5 h-12 w-12 object-contain" size={48} />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Log in to DayStart</h1>
            <p className="text-sm text-muted-foreground">Customer account</p>
          </div>
        </div>

        {/* Method toggle */}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMethod("password");
              setOtpSent(false);
              setError(null);
            }}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              method === "password"
                ? "bg-brand-red text-white"
                : "border border-border bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("otp");
              setOtpSent(false);
              setError(null);
            }}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              method === "otp"
                ? "bg-brand-red text-white"
                : "border border-border bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            OTP
          </button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={
            method === "password"
              ? submit
              : (e) => {
                  e.preventDefault();
                }
          }
          noValidate
        >
          {method === "password" ? (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Email address</span>
                <div className="flex items-center gap-2 rounded-xl border border-border px-3 focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    autoFocus
                    type="email"
                    autoComplete="email"
                    className="w-full bg-transparent py-2.5 outline-none"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Password</span>
                <div className="flex items-center gap-2 rounded-xl border border-border px-3 focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20">
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    className="w-full bg-transparent py-2.5 outline-none"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Email or Mobile</span>
                <div className="flex items-center gap-2 rounded-xl border border-border px-3 focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    autoFocus
                    type="text"
                    autoComplete="tel"
                    inputMode="numeric"
                    className="w-full bg-transparent py-2.5 outline-none"
                    placeholder="Email or 10-digit mobile"
                    value={email || phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[0-9]*$/.test(val)) {
                        setPhone(val);
                        setEmail("");
                      } else {
                        setEmail(val);
                        setPhone("");
                      }
                    }}
                  />
                </div>
              </label>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending || (!emailValid && !phoneValid)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-brand disabled:opacity-60"
                >
                  {otpSending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {otpSending ? "Sending OTP…" : "Send OTP"}
                </button>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Enter OTP</span>
                    <div className="flex items-center gap-2 rounded-xl border border-border px-3 focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20">
                      <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        className="w-full bg-transparent py-2.5 outline-none text-center text-2xl tracking-widest"
                        placeholder="000000"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </label>

                  {devOtp && (
                    <p className="text-xs text-muted-foreground">
                      Development OTP: <span className="font-mono font-semibold">{devOtp}</span>
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otpCode.length !== 6}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-brand disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {loading ? "Verifying…" : "Verify OTP"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Change email/mobile
                  </button>
                </>
              )}
            </>
          )}

          {method === "password" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-brand-red"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me logged in on this device
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-brand-red">
              {error}
            </p>
          )}

          {method === "password" && (
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-brand disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? "Logging in…" : "Log in"}
            </button>
          )}

          <p className="text-center text-sm text-muted-foreground">
            New to DayStart?{" "}
            <Link
              to="/register"
              search={{ redirect: search.redirect }}
              className="font-semibold text-brand-red hover:underline"
            >
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}

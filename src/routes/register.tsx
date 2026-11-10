import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from "lucide-react";

import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { setRememberMe } from "@/lib/auth-session";
import { registerCustomer, validateRegistration } from "@/lib/customer-auth.functions";

type Search = {
  redirect?: string;
};

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Create your account — DayStart" },
      {
        name: "description",
        content: "Create a DayStart account to book verified workers.",
      },
    ],
  }),
  component: RegisterPage,
});

function safeRedirect(target?: string) {
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/book";
  }

  return target;
}

function RegisterPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/register" });
  const register = useServerFn(registerCustomer);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = safeRedirect(search.redirect);

  function updateField(field: keyof typeof form, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active || error || !data.session) return;

      await navigate({
        href: destination,
        replace: true,
      });
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [destination, navigate]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError(null);

    const validation = validateRegistration(form);

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoading(true);

    try {
      // Create the customer in Supabase using the server function.
      await register({ data: form });

      // Sign in using the same email and password.
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: validation.email,
        password: validation.password,
      });

      if (signInError) {
        throw new Error(
          "Your account was created, but automatic login failed. Please log in manually.",
        );
      }

      if (!data.session) {
        throw new Error(
          "Your account was created, but no login session was returned. Please log in.",
        );
      }

      setRememberMe(true);

      await navigate({
        href: destination,
        replace: true,
      });
    } catch (err: unknown) {
      console.error("[register page] Registration failed:", err);

      setError(
        err instanceof Error ? err.message : "Could not create your account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldWrap =
    "flex items-center gap-2 rounded-xl border border-border px-3 focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20";

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-red hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to home
      </Link>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Logo className="mb-5 h-12 w-12 object-contain" size={48} />

        <h1 className="font-display text-2xl font-bold">Create your account</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Customer sign-up — book verified workers in under a minute.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Full name</span>
            <div className={fieldWrap}>
              <User className="h-4 w-4 text-muted-foreground" />
              <input
                required
                autoComplete="name"
                className="w-full bg-transparent py-2.5 outline-none"
                placeholder="Your name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Email</span>
            <div className={fieldWrap}>
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                required
                type="email"
                autoComplete="email"
                className="w-full bg-transparent py-2.5 outline-none"
                placeholder="you@example.com"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Phone number</span>
            <div className={fieldWrap}>
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">+91</span>
              <input
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                className="w-full bg-transparent py-2.5 tracking-wide outline-none"
                placeholder="98765 43210"
                value={form.phone}
                onChange={(event) =>
                  updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))
                }
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Password</span>
            <div className={fieldWrap}>
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="w-full bg-transparent py-2.5 outline-none"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Confirm password</span>
            <div className={fieldWrap}>
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="w-full bg-transparent py-2.5 outline-none"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={(event) => updateField("confirmPassword", event.target.value)}
              />
            </div>

            {form.confirmPassword.length > 0 && form.confirmPassword !== form.password && (
              <span className="mt-1 block text-xs text-brand-red">Passwords do not match.</span>
            )}
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-brand-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-red text-sm font-semibold text-white shadow-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              search={{ redirect: search.redirect }}
              className="font-semibold text-brand-red hover:underline"
            >
              Log in
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}

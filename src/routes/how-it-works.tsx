import { createFileRoute } from "@tanstack/react-router";
import { User } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — DayStart" },
      {
        name: "description",
        content:
          "The DayStart journey: log in, choose a service, confirm your booking and a verified worker reaches you — step by step.",
      },
      { property: "og:title", content: "How DayStart works — Auto-assignment in 60 seconds" },
      {
        property: "og:description",
        content:
          "Login, booking, worker assignment, live tracking, payment and ratings — the full customer journey.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const journey = [
  "Create your account (name, email, phone, password) and log in.",
  "Choose the service you need.",
  "Select the date and time slot.",
  "Confirm your booking and pay the 30% advance.",
  "A verified worker accepts the request.",
  "The worker reaches your location.",
  "The service is completed.",
  "The remaining payment is completed.",
  "Rate and review your worker.",
];

const customer = [
  "Create an account or log in with your email and password, then choose your language.",
  "Set your location via GPS or pick your area manually.",
  "Choose one of four services, then pick a sub-service.",
  "Choose worker count (for multi-worker services) and a date/slot.",
  "Enter your address and phone. Pay 30% advance via UPI or card.",
  "The engine auto-assigns the nearest verified worker in under 60 seconds.",
  "See your worker's name, photo, rating, distance and live ETA on a map.",
  "Worker arrives → performs job → marks it complete.",
  "Pay the remaining 70%. Rate the worker 1–5 stars.",
];

function HowItWorksPage() {
  return (
    <>
      <section className="border-b border-border bg-brand-cream">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
            The engine
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold sm:text-6xl">
            One booking. <span className="text-gradient-sunrise">Sixty seconds.</span> One worker.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            DayStart's GPS-based auto-assignment engine is mechanically similar to Rapido or Uber —
            applied to physical daily labour instead of transport. Workers can't reject jobs by
            design; the nearest available, verified worker is auto-pushed.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-2xl gap-6">
          <Column
            icon={User}
            label="Customer flow"
            color="from-brand-red to-rose-500"
            steps={customer}
          />
        </div>
      </section>

      <section className="bg-brand-black py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
            The booking journey
          </p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">
            From login to review in nine steps
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {journey.map((step, idx) => (
              <li key={step} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-red text-sm font-bold">
                  {idx + 1}
                </span>
                <p className="mt-3 text-sm text-white/85">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

function Column({
  icon: Icon,
  label,
  color,
  steps,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  steps: string[];
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold">{label}</h2>
      <ol className="mt-5 space-y-3">
        {steps.map((s, idx) => (
          <li key={idx} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white">
              {idx + 1}
            </span>
            <span className="text-foreground/85">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

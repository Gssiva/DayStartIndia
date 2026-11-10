import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Target, Rocket, Heart } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About DayStart — Our mission & rollout plan" },
      {
        name: "description",
        content:
          "DayStart is turning India's daily labour market from exploitation into opportunity — starting in Hyderabad, scaling pan-India.",
      },
      { property: "og:title", content: "About DayStart" },
      {
        property: "og:description",
        content:
          "Founded in Visakhapatnam. Piloting in Hyderabad. Building for pan-India daily labour.",
      },
    ],
  }),
  component: AboutPage,
});

const phases = [
  { p: "HQ", where: "Visakhapatnam, Andhra Pradesh", note: "Founding city." },
  { p: "Phase 1", where: "Hyderabad, Telangana", note: "Live pilot." },
  { p: "Phase 2", where: "Vijayawada · Visakhapatnam", note: "Full AP & Telangana coverage." },
  { p: "Phase 3", where: "Chennai · Bengaluru", note: "South India expansion." },
  { p: "Phase 4", where: "Pan-India", note: "50+ cities." },
];

function AboutPage() {
  return (
    <>
      <section className="border-b border-border bg-brand-cream">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">About us</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold sm:text-6xl">
            Every naka has a story.
            <br />
            <span className="text-gradient-sunrise">We're rewriting them.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Existing platforms serve the educated, urban, English-speaking top 30% of the services
            market. DayStart is building for the other 70% — the uneducated, semi-urban and rural
            daily labour segment no one else serves at scale.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-8">
            <Target className="h-8 w-8 text-brand-red" />
            <h2 className="mt-4 font-display text-3xl font-bold">Our mission</h2>
            <p className="mt-3 text-muted-foreground">
              Turn India's most-exploited labour market into its most reliable. Give every worker
              guaranteed work, fair pay, and a digital identity that follows them for life.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-8">
            <Heart className="h-8 w-8 text-brand-red" />
            <h2 className="mt-4 font-display text-3xl font-bold">Our promise</h2>
            <p className="mt-3 text-muted-foreground">
              We <strong>employ</strong> workers, we don't rent them. No 30–50% contractor cut. No
              delayed wages. No "sorry, no work today." Every morning starts with an opportunity.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-brand-black py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">Rollout</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">From Hyderabad to pan-India</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {phases.map((ph) => (
              <div key={ph.p} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="wordmark text-2xl text-brand-red">{ph.p}</p>
                <div className="mt-3 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 flex-none text-white/70" />
                  <span className="font-semibold">{ph.where}</span>
                </div>
                <p className="mt-2 text-xs text-white/60">{ph.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
          Unit economics
        </p>
        <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Built to work at scale</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: "₹599", v: "Average booking value" },
            { k: "33%", v: "Gross margin per booking" },
            { k: "200/day", v: "Booking target — Month 6" },
            { k: "₹4.3 Cr", v: "Projected ARR at run-rate" },
          ].map((s) => (
            <div key={s.v} className="rounded-2xl border border-border bg-card p-6">
              <p className="wordmark text-4xl text-brand-red">{s.k}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-cream py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Rocket className="mx-auto h-10 w-10 text-brand-red" />
          <h2 className="mt-4 text-4xl font-bold sm:text-5xl">Founded by Siva Kumar Gulla</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            DayStart is headquartered in Visakhapatnam, Andhra Pradesh — building for India's
            informal economy from within it.
          </p>
        </div>
      </section>
    </>
  );
}

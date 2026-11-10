import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Search, Users } from "lucide-react";
import agriImg from "@/assets/service-agriculture.jpg";
import beautyImg from "@/assets/service-beauty.jpg";
import constructionImg from "@/assets/service-construction.jpg";
import driverImg from "@/assets/service-driver.jpg";
import { catalogQueryOptions, serviceIcon, useServiceCatalog } from "@/lib/services-catalog";
import { inr } from "@/lib/booking-catalog";

export const SERVICE_IMAGES: Record<string, string> = {
  agriculture: agriImg,
  beauty: beautyImg,
  construction: constructionImg,
  driver: driverImg,
};

export const Route = createFileRoute("/services/")({
  head: () => ({
    meta: [
      { title: "Services — DayStart | Agriculture & Construction" },
      {
        name: "description",
        content:
          "Browse DayStart services and sub-services: agriculture field work, construction labour and verified drivers. Transparent fixed prices.",
      },
      {
        property: "og:title",
        content: "DayStart Services — Agriculture & Construction",
      },
      {
        property: "og:description",
        content: "Four launch categories in Hyderabad with fixed pricing and verified workers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions),
  component: ServicesPage,
});

function ServicesPage() {
  const { services, isLoading, error, refetch } = useServiceCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    return services
      .filter((s) => (filter === "all" ? true : s.slug === filter))
      .map((s) => {
        if (!q) return { service: s, matchedSubs: s.subs };
        const serviceHit =
          s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
        const matchedSubs = s.subs.filter(
          (x) => x.name.toLowerCase().includes(q) || x.description.toLowerCase().includes(q),
        );
        if (!serviceHit && matchedSubs.length === 0) return null;
        return {
          service: s,
          matchedSubs: serviceHit && matchedSubs.length === 0 ? s.subs : matchedSubs,
        };
      })
      .filter(Boolean) as {
      service: (typeof services)[number];
      matchedSubs: (typeof services)[number]["subs"];
    }[];
  }, [services, q, filter]);

  return (
    <>
      <section className="border-b border-border bg-brand-cream">
        <div className="container-page py-14 sm:py-20">
          <p className="text-eyebrow text-brand-red">Launch services</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold sm:text-6xl">
            Four categories.
            <br />
            Every worker verified.
          </h1>
          <p className="text-lead mt-5 max-w-2xl text-muted-foreground">
            All prices are fixed — no bargaining, no hidden fees. Pay 30% at booking, 70% on
            completion. Cancel before a worker is assigned for a full refund.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <label className="relative block max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services or sub-services…"
                aria-label="Search services"
                className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-base outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/25"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={filter === "all" ? "chip chip-selected" : "chip"}
              >
                All services
              </button>
              {services.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setFilter(s.slug)}
                  className={filter === s.slug ? "chip chip-selected" : "chip"}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page section space-y-12 sm:space-y-16">
        {isLoading && (
          <div className="grid gap-10 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="skeleton aspect-[4/3] w-full rounded-3xl" />
                <div className="skeleton h-7 w-48 rounded-full" />
                <div className="skeleton h-4 w-full rounded-full" />
                <div className="skeleton h-4 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-brand-red" />
            <h2 className="mt-3 text-xl font-semibold">Services couldn&apos;t be loaded</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-5 inline-flex h-11 items-center rounded-full bg-brand-red px-6 font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && results.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">No services match your search</h2>
            <p className="mt-2 text-muted-foreground">
              Try a different word, or clear the search to see all four categories.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="mt-5 inline-flex h-11 items-center rounded-full border border-border px-6 font-semibold"
            >
              Clear search
            </button>
          </div>
        )}

        {!isLoading &&
          !error &&
          results.map(({ service: s, matchedSubs }, i) => {
            const Icon = serviceIcon(s.icon);
            const reverse = i % 2 === 1;
            const img = SERVICE_IMAGES[s.slug];
            return (
              <article
                key={s.slug}
                id={s.slug}
                className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-10"
              >
                <div className={reverse ? "lg:order-2" : ""}>
                  {img && (
                    <div className="overflow-hidden rounded-3xl border border-border shadow-brand">
                      <img
                        src={img}
                        alt={`${s.name} workers on DayStart`}
                        loading="lazy"
                        width={1200}
                        height={900}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-sunrise text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-3xl font-bold sm:text-4xl">{s.name}</h2>
                  {s.startingPrice != null && (
                    <p className="wordmark mt-2 text-2xl text-brand-red sm:text-3xl">
                      From {inr(s.startingPrice)}
                    </p>
                  )}
                  <p className="mt-3 text-muted-foreground">{s.description}</p>
                  <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                    {s.eta && (
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-brand-red" /> Typical arrival {s.eta}
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-brand-red" />{" "}
                      {s.multiWorker ? "1–20 workers per booking" : "1 worker per booking"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-red" /> Aadhaar-verified worker ·
                      3.0+ rating
                    </li>
                  </ul>
                  <div className="mt-6">
                    <h3 className="text-eyebrow text-brand-black">Sub-services</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {matchedSubs.map((sub) => (
                        <Link
                          key={sub.id}
                          to="/services/$slug"
                          params={{ slug: s.slug }}
                          hash={sub.slug}
                          className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-brand-red"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <Link
                    to="/services/$slug"
                    params={{ slug: s.slug }}
                    className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-brand-red px-6 text-base font-semibold text-white shadow-brand"
                  >
                    View {s.name} services
                  </Link>
                </div>
              </article>
            );
          })}
        {!isLoading && !error && services.length === 0 && !q && (
          <p className="text-center text-muted-foreground">
            No services are available right now. Please check back soon.
          </p>
        )}
      </section>
    </>
  );
}

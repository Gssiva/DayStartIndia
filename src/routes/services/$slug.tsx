import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock } from "lucide-react";
import { catalogQueryOptions, serviceIcon, setPendingSelection } from "@/lib/services-catalog";
import { inr } from "@/lib/booking-catalog";

export const Route = createFileRoute("/services/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(catalogQueryOptions);
    const service = data.services.find((s) => s.slug === params.slug);
    if (!service && !data.error) throw notFound();
    return { name: service?.name ?? "Service", description: service?.description ?? "" };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Service"} services — DayStart Hyderabad` },
      {
        name: "description",
        content: loaderData?.description || "Verified workers with fixed pricing on DayStart.",
      },
      { property: "og:title", content: `${loaderData?.name ?? "Service"} — DayStart` },
      {
        property: "og:description",
        content: loaderData?.description || "Verified workers with fixed pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ServiceDetail,
  notFoundComponent: () => (
    <div className="container-page section text-center">
      <h1 className="text-3xl font-bold">Service not found</h1>
      <Link to="/services" className="mt-6 inline-flex font-semibold text-brand-red">
        Back to services
      </Link>
    </div>
  ),
  errorComponent: () => (
    <div className="container-page section text-center">
      <h1 className="text-3xl font-bold">Couldn&apos;t load this service</h1>
      <Link to="/services" className="mt-6 inline-flex font-semibold text-brand-red">
        Back to services
      </Link>
    </div>
  ),
});

function ServiceDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(catalogQueryOptions);
  const navigate = useNavigate();
  const s = data.services.find((x) => x.slug === slug);
  if (!s) return <div className="container-page section">{data.error ?? "Service not found."}</div>;
  const Icon = serviceIcon(s.icon);

  return (
    <>
      <section className="border-b border-border bg-brand-cream">
        <div className="container-page py-12 sm:py-16">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-red"
          >
            <ArrowLeft className="h-4 w-4" /> All services
          </Link>
          <div className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-sunrise text-white">
            <Icon className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">{s.name}</h1>
          <p className="text-lead mt-4 max-w-2xl text-muted-foreground">{s.description}</p>
        </div>
      </section>
      <section className="container-page section">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {s.subs.map((sub) => {
            const SubIcon = serviceIcon(sub.icon);
            return (
              <article
                key={sub.id}
                id={sub.slug}
                className="flex flex-col rounded-3xl border border-border bg-card p-6"
              >
                <SubIcon className="h-6 w-6 text-brand-red" />
                <h2 className="mt-3 text-xl font-semibold">{sub.name}</h2>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{sub.description}</p>
                <p className="mt-4 text-2xl font-bold text-brand-red">
                  {inr(sub.price)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{sub.unit}</span>
                </p>
                {sub.duration && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> {sub.duration}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPendingSelection({
                      serviceId: s.id,
                      serviceSlug: s.slug,
                      serviceName: s.name,
                      subServiceId: sub.id,
                      subServiceSlug: sub.slug,
                      subServiceName: sub.name,
                      price: sub.price,
                      unit: sub.unit,
                    });
                    navigate({ to: "/book" });
                  }}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 font-semibold text-white"
                >
                  Book now
                </button>
              </article>
            );
          })}
        </div>
        {s.subs.length === 0 && (
          <p className="text-center text-muted-foreground">No options available right now.</p>
        )}
      </section>
    </>
  );
}

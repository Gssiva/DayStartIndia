import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Sprout,
  HardHat,
  Clock,
  Shield,
  MapPin,
  Star,
  ArrowRight,
  UserCheck,
  Users,
  Zap,
  IndianRupee,
  ChevronDown,
  BadgeCheck,
  Lock,
  Wallet,
  Loader2,
  LocateFixed,
} from "lucide-react";
import heroImg from "@/assets/hero-workers.jpg";
import { CountUp } from "@/components/motion";
import { ServicesCarousel, TestimonialCarousel } from "@/components/Carousels";
import agriImg from "@/assets/service-agriculture.jpg";
import constructionImg from "@/assets/service-construction.jpg";
import { useServerFn } from "@tanstack/react-start";
import { getServicesByLocation } from "@/lib/location-services.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "DayStart | Verified Daily Workers Across India",
      },
      {
        name: "description",
        content:
          "DayStart directly employs verified daily workers for agriculture and construction. Book trusted professionals in under 60 seconds with transparent pricing and live tracking.",
      },

      // Open Graph
      {
        property: "og:title",
        content: "DayStart | Verified Daily Workers Across India",
      },
      {
        property: "og:description",
        content:
          "Book verified daily workers in under 60 seconds. Fair wages, transparent pricing, live tracking, and no middlemen.",
      },
      {
        property: "og:site_name",
        content: "DayStart",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: "https://daystart.co.in/",
      },

      // Twitter
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: "DayStart | Verified Daily Workers Across India",
      },
      {
        name: "twitter:description",
        content:
          "Book verified daily workers in under 60 seconds with transparent pricing and live tracking.",
      },
    ],

    links: [
      {
        rel: "canonical",
        href: "https://daystart.co.in/",
      },
    ],

    scripts: [
      // Website Schema (helps Google identify the site name)
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "DayStart",
          alternateName: "DayStart",
          url: "https://daystart.co.in/",
        }),
      },

      // Organization Schema
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "DayStart",
          url: "https://daystart.co.in/",
        }),
      },

      // FAQ Schema
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.a,
            },
          })),
        }),
      },
    ],
  }),
  component: HomePage,
});

const stats = [
  { icon: Zap, to: 60, prefix: "<", suffix: "s", decimals: 0, v: "Auto-assignment" },
  { icon: MapPin, to: 10, prefix: "", suffix: " km", decimals: 0, v: "Search radius" },
  { icon: BadgeCheck, to: 100, prefix: "", suffix: "%", decimals: 0, v: "Aadhaar verified" },
  { icon: Star, to: 3, prefix: "", suffix: "+", decimals: 1, v: "Min. rating enforced" },
];

const features = [
  {
    icon: Zap,
    t: "Auto-assign engine",
    d: "GPS matches the nearest verified worker in under 60 seconds. No bargaining, no rejections.",
  },
  {
    icon: Shield,
    t: "Verified & insured",
    d: "Every worker Aadhaar-verified, background-checked, and rated. Below 3.0 stars? Auto-suspended.",
  },
  {
    icon: Wallet,
    t: "Fixed transparent pricing",
    d: "Pay 30% at booking, 70% on completion. No surge, no hidden fees, no middlemen.",
  },
  {
    icon: MapPin,
    t: "Live tracking",
    d: "See your worker's live location, ETA, name, photo and rating from booking to arrival.",
  },
  {
    icon: BadgeCheck,
    t: "Directly employed",
    d: "We employ workers — we don't rent them. Salary or per-job model, chosen at onboarding.",
  },
  {
    icon: Lock,
    t: "Cancellation & refund",
    d: "Full refund before a worker is assigned. Rated dispute resolution after.",
  },
];

const testimonials = [
  {
    name: "Rekha M.",
    role: "Home owner · Gachibowli",
    quote:
      "Needed two masons for a weekend repair. Verified workers arrived on time, fixed price, no haggling. This is what Hyderabad needed.",
    rating: 5,
  },
  {
    name: "Ramesh P.",
    role: "Farm owner · Shamshabad",
    quote:
      "Needed 8 workers for harvest. Booked the night before, all 8 showed up on time. No agent, no cut. Paid the workers directly through DayStart.",
    rating: 5,
  },
  {
    name: "Anjali K.",
    role: "Contractor · Kompally",
    quote:
      "Reliable masons on demand. My site never stalls now. Rating system means the worst workers are already filtered out for us.",
    rating: 5,
  },
];

const faqs = [
  {
    q: "How quickly is a worker assigned?",
    a: "Our GPS auto-assign engine finds the nearest verified worker in under 60 seconds. Agriculture and construction bookings are locked the moment you pay the 30% advance.",
  },
  {
    q: "Are DayStart workers available across India?",
    a: "DayStart is live in Hyderabad today with verified agriculture and construction workers, and we onboard more workers every day. We're growing city by city — register or book now and we'll reach your area soon.",
  },
  {
    q: "Are DayStart workers verified?",
    a: "Yes. Every worker completes Aadhaar identity verification, an in-person onboarding, and category training before their first job. Workers below a 3.0 star rating are automatically suspended.",
  },
  {
    q: "How is DayStart different from a marketplace like Urban Company?",
    a: "Urban Company serves urban premium customers with English-speaking freelancers. DayStart directly employs semi-urban and rural daily labour — no bidding, no rejection — and pays them fairly with a salary or per-job model they choose.",
  },
  {
    q: "What cities is DayStart live in?",
    a: "We are piloting in Hyderabad. Phase 2 rollout covers Vijayawada and Visakhapatnam, followed by Chennai and Bengaluru, before pan-India expansion.",
  },
  {
    q: "How do payments and refunds work?",
    a: "You pay a 30% advance at booking via UPI or card, and the remaining 70% on completion. If no worker can be assigned or you cancel before assignment, the advance is fully refunded within 3 business days.",
  },
  {
    q: "Can I book multiple workers at once?",
    a: "Yes. Agriculture and construction bookings support 1–20 workers per booking, assigned in parallel from the nearest verified pool.",
  },
];

function HomePage() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationCity, setLocationCity] = useState<string>("");
  const [locationArea, setLocationArea] = useState<string>("");
  const [services, setServices] = useState<
    {
      name: string;
      img: string;
      price: string;
      type: string;
      icon: React.ForwardRefExoticComponent<
        Omit<import("lucide-react").LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
      >;
      desc: string;
      slug: string;
    }[]
  >([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coverageMessage, setCoverageMessage] = useState<string | null>(null);
  const getServicesByLocationFn = useServerFn(getServicesByLocation);

  // Detect user location on mount
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });
          // Default to Hyderabad for now - in production, use reverse geocoding
          setLocationCity("Hyderabad");
          setLocationArea("Gachibowli");
        },
        () => {
          // Location permission denied - use default
          setLocationCity("Hyderabad");
          setLocationArea("Gachibowli");
        },
        { timeout: 8000 },
      );
    } else {
      setLocationCity("Hyderabad");
      setLocationArea("Gachibowli");
    }
  }, []);

  // Fetch services based on location
  useEffect(() => {
    if (locationCity) {
      loadServices();
    }
  }, [locationCity, locationArea, userLocation]);

  async function loadServices() {
    setLoadingServices(true);
    try {
      const result = await getServicesByLocationFn({
        data: {
          city: locationCity,
          area: locationArea,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
        },
      });

      if (result.covered) {
        // Map database services to carousel format
        const mappedServices = result.services.map(
          (s: {
            name: string;
            slug: string;
            startingPrice: number | null;
            subs: { unit?: string }[];
            description: string;
          }) => ({
            name: s.name,
            img: s.slug === "agriculture" ? agriImg : constructionImg,
            price: `₹${s.startingPrice || "From"} / ${s.subs[0]?.unit || "day"}`,
            type: "Scheduled",
            icon: s.slug === "agriculture" ? Sprout : HardHat,
            desc: s.description,
            slug: s.slug,
          }),
        );
        setServices(mappedServices);
        setCoverageMessage(null);
      } else {
        setServices([]);
        setCoverageMessage(result.message || "Services coming soon to your area");
      }
    } catch (err) {
      console.error("[homepage] Failed to load services:", err);
      setCoverageMessage("We couldn't load services right now. Please try again.");
    } finally {
      setLoadingServices(false);
    }
  }

  function handleDetectLocation() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });
          setLocationCity("Hyderabad");
          setLocationArea("Gachibowli");
        },
        () => {
          setLocationError("Could not detect your location. Please select manually.");
        },
        { timeout: 8000 },
      );
    }
  }

  return (
    <>
      {/* HERO — looping background video */}
      <section
        className="hero-section relative isolate flex min-h-[92vh] items-center overflow-hidden bg-slate-900 bg-cover bg-center text-white"
        style={{ backgroundImage: "url(/hero-poster.jpg)" }}
      >
        <video
          className="hero-video absolute inset-0 -z-20 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/hero-poster.jpg"
          aria-hidden
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
          <source src="/hero-bg.webm" type="video/webm" />
        </video>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(15,23,42,.86)_0%,rgba(15,23,42,.64)_50%,rgba(30,41,59,.42)_100%)]"
        />
        <div
          aria-hidden
          data-parallax="0.18"
          className="absolute -right-24 top-16 -z-10 h-96 w-96 rounded-full bg-brand-red/25 blur-3xl animate-aurora"
        />

        <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <span
              data-aos="fade-down"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 shadow-lg ring-1 ring-white/20 backdrop-blur"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
              Now live in Hyderabad · Onboarding workers daily
            </span>
            <h1
              data-aos="fade-up"
              data-aos-delay="100"
              className="mt-6 text-5xl font-bold leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
              Verified daily workers,
              <br />
              <span className="text-gradient-sunrise">booked in 60 seconds.</span>
            </h1>
            <p
              data-aos="fade-up"
              data-aos-delay="200"
              className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl"
            >
              DayStart directly employs verified daily workers and auto-assigns the nearest one to
              your booking. No middlemen. No bargaining. Just fair work — on time, every time.
            </p>
            <div
              data-aos="fade-up"
              data-aos-delay="300"
              className="mt-8 flex flex-wrap justify-center gap-3"
            >
              <Link
                to="/book"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-red px-7 text-base font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                Book a worker <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-7 text-base font-semibold text-white ring-1 ring-white/30 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/60">
              Fixed pricing · 30% advance · Full refund before assignment
            </p>
          </div>

          {/* Stat cards: icon in a circle + soft shadow */}
          <dl
            data-aos="zoom-in-up"
            data-aos-delay="400"
            className="relative z-10 mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.v}
                  className="flex items-center gap-4 rounded-2xl bg-white/15 p-5 shadow-[0_18px_50px_-18px_rgba(60,20,0,.6)] ring-1 ring-white/15 backdrop-blur-md transition-transform hover:-translate-y-1"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#c8001a] via-[#c8001a] to-[#dc2640] text-white shadow-[0_10px_24px_-6px_rgba(228,66,43,.8)] ring-4 ring-white/10">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <dt className="text-3xl font-bold tracking-tight text-white">
                      <CountUp
                        to={s.to}
                        prefix={s.prefix}
                        suffix={s.suffix}
                        decimals={s.decimals}
                      />
                    </dt>
                    <dd className="mt-0.5 text-sm text-white/70">{s.v}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
            Why DayStart
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            The daily labour platform India actually needed.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            We fixed the labour <em>naka</em> end-to-end — from discovery to payout.
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.t}
                data-aos="fade-up"
                data-aos-delay={(i % 3) * 100}
                className="group card-pro p-6"
              >
                <div className="icon-pro h-12 w-12">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* SERVICES */}
      <section className="bg-muted/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
                {locationCity ? `Services in ${locationCity}` : "Launch services"}
              </p>
              <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                Live services. Verified workers.
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                All prices fixed. All workers verified. Pay 30% at booking.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDetectLocation}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-red hover:underline"
              >
                <LocateFixed className="h-4 w-4" />
                Use my location
              </button>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-red hover:underline"
              >
                See all sub-services <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {loadingServices ? (
            <div className="mt-8 flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-red" />
              <span className="ml-3 text-muted-foreground">Loading services for your area...</span>
            </div>
          ) : coverageMessage ? (
            <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-2xl font-semibold">Services coming soon to your area</h3>
              <p className="mt-2 text-muted-foreground">{coverageMessage}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                We're expanding rapidly. Register your interest and we'll notify you when we launch
                in your area.
              </p>
              <Link to="/contact" className="btn-primary mt-6 inline-flex h-11 items-center gap-2">
                Notify me when available <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : services.length > 0 ? (
            <ServicesCarousel items={services} />
          ) : (
            <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No services available at this time.</p>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
            How it works
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            From booking to arrival — in under a minute.
          </h2>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {[
            {
              i: MapPin,
              t: "Set your location",
              d: "GPS or pick your area. Choose a verified service category.",
            },
            {
              i: Zap,
              t: "Book & pay 30%",
              d: "Fixed price. UPI or card. 30% advance holds your slot.",
            },
            {
              i: Users,
              t: "Nearest worker assigned",
              d: "Our engine dispatches in under 60 seconds — no bargaining.",
            },
            {
              i: Star,
              t: "Track, rate & relax",
              d: "Live map. Pay balance on completion. Rate 1–5 stars.",
            },
          ].map((step, idx) => {
            const Icon = step.i;
            return (
              <div key={step.t} className="relative" data-aos="fade-up" data-aos-delay={idx * 120}>
                <div className="card-pro relative h-full p-6">
                  <span className="absolute right-4 top-4 text-5xl font-bold leading-none text-slate-900/10">
                    0{idx + 1}
                  </span>
                  <div className="icon-pro h-12 w-12">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{step.t}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.d}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-red hover:underline"
          >
            See the full workflow <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      {/* WORKER PROMISE */}
      <section className="relative overflow-hidden bg-foreground text-background">
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <img
            src={heroImg}
            alt=""
            loading="lazy"
            data-parallax="0.1"
            className="absolute -top-[15%] left-0 h-[130%] w-full object-cover opacity-25 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/92 via-slate-900/85 to-slate-800/70" />
        </div>
        <div aria-hidden className="absolute inset-0 opacity-40">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-red/20 blur-3xl" />
          <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-brand-red/15 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div data-aos="fade-right">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
              Our worker promise
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              We <span className="text-brand-red">employ</span> workers —<br />
              we don't rent them.
            </h2>
            <p className="mt-4 max-w-lg text-lg text-background/80">
              DayStart is not a freelancer marketplace. Workers are directly employed, paid on time,
              and given a formal digital identity — a career, not a gig.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-red px-6 text-base font-semibold text-white shadow-brand transition-transform hover:-translate-y-0.5"
              >
                Create account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-background/25 px-6 text-base font-semibold text-background hover:bg-background/10"
              >
                Our mission
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2" data-aos="fade-left" data-aos-delay="150">
            {[
              {
                i: IndianRupee,
                t: "Fair, fixed pay",
                d: "Salary or per-job model — worker chooses at onboarding.",
              },
              { i: Shield, t: "No middlemen", d: "Zero deductions. Direct payout to workers." },
              {
                i: UserCheck,
                t: "Verified identity",
                d: "Aadhaar-verified profile builds a real digital work history.",
              },
              {
                i: Clock,
                t: "Auto-assigned jobs",
                d: "Nearest job pushed automatically — no bidding, no waiting.",
              },
            ].map((b) => {
              const Icon = b.i;
              return (
                <div
                  key={b.t}
                  className="rounded-2xl border border-background/10 bg-background/5 p-5 backdrop-blur transition-colors hover:bg-background/10"
                >
                  <Icon className="h-6 w-6 text-brand-red" />
                  <h3 className="mt-3 text-base font-semibold">{b.t}</h3>
                  <p className="mt-1 text-sm text-background/70">{b.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
            Loved by Hyderabad
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Customers switching from labour <em>nakas</em> and agents.
          </h2>
        </div>
        <TestimonialCarousel items={testimonials} bgs={[agriImg, constructionImg, heroImg]} />
      </section>

      {/* FAQ */}
      <section className="bg-muted/40 py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">FAQ</p>
            <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Everything you might ask.
            </h2>
          </div>
          <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
            {faqs.map((f, i) => (
              <FaqItem key={f.q} item={f} defaultOpen={i === 0} />
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Still have questions?{" "}
            <Link to="/contact" className="font-semibold text-brand-red hover:underline">
              Get in touch
            </Link>
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div
          data-aos="zoom-in"
          className="relative overflow-hidden rounded-3xl border border-border bg-foreground p-10 text-background shadow-xl sm:p-16"
        >
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-red/30 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-brand-red/15 blur-3xl"
          />
          <div className="relative max-w-2xl">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              A new day. A new you. A new beginning.
            </h2>
            <p className="mt-4 text-lg text-background/80">
              Book a verified worker in minutes, or join DayStart as one. Live in Hyderabad —
              rolling out across South India next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/book"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-red px-6 text-base font-semibold text-white shadow-brand transition-transform hover:-translate-y-0.5"
              >
                Book a worker <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-background/25 bg-background/5 px-6 text-base font-semibold text-background hover:bg-background/10"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function FaqItem({ item, defaultOpen }: { item: { q: string; a: string }; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-muted/60 sm:px-6"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-foreground sm:text-lg">{item.q}</span>
        <ChevronDown
          className={`h-5 w-5 flex-none text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:text-base">
          {item.a}
        </div>
      )}
    </div>
  );
}

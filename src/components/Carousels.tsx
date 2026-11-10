import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowLeft, ArrowRight, Quote, Star, type LucideIcon } from "lucide-react";

function useDots(api: ReturnType<typeof useEmblaCarousel>[1]) {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!api) return;
    const sync = () => {
      setIndex(api.selectedScrollSnap());
      setCount(api.scrollSnapList().length);
    };
    sync();
    api.on("select", sync).on("reInit", sync);
    return () => {
      api.off("select", sync).off("reInit", sync);
    };
  }, [api]);
  return { index, count };
}

function NavButton({
  dir,
  onClick,
  label,
}: {
  dir: "prev" | "next";
  onClick: () => void;
  label: string;
}) {
  const Icon = dir === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-red hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/* ---------------- Testimonials: autoplay, dots, arrows, swipe ---------------- */

export type Testimonial = { name: string; role: string; quote: string; rating: number };

export function TestimonialCarousel({ items, bgs }: { items: Testimonial[]; bgs: string[] }) {
  const [ref, api] = useEmblaCarousel({ loop: true, align: "center" }, [
    Autoplay({ delay: 5500, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);
  const { index, count } = useDots(api);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const prev = useCallback(() => api?.scrollPrev(), [api]);
  const next = useCallback(() => api?.scrollNext(), [api]);

  // Parallax: each card's background photo drifts slower than the card as it slides.
  const parallax = useCallback((e: NonNullable<typeof api>) => {
    const engine = e.internalEngine();
    const progress = e.scrollProgress();
    e.scrollSnapList().forEach((snap, i) => {
      let diff = snap - progress;
      if (engine.options.loop) {
        engine.slideLooper.loopPoints.forEach((lp) => {
          const target = lp.target();
          if (i === lp.index && target !== 0) {
            const sign = Math.sign(target);
            if (sign === -1) diff = snap - (1 + progress);
            if (sign === 1) diff = snap + (1 - progress);
          }
        });
      }
      const el = layers.current[i];
      if (el) el.style.transform = `translate3d(${diff * -50}%,0,0)`;
    });
  }, []);

  useEffect(() => {
    if (!api) return;
    parallax(api);
    api.on("reInit", parallax).on("scroll", parallax).on("slideFocus", parallax);
    return () => {
      api.off("reInit", parallax).off("scroll", parallax).off("slideFocus", parallax);
    };
  }, [api, parallax]);

  return (
    <div
      data-no-aos
      className="relative mx-auto mt-14 max-w-4xl"
      role="region"
      aria-roledescription="carousel"
      aria-label="Customer stories"
    >
      <div ref={ref} className="overflow-hidden px-6 py-10">
        <div className="flex">
          {items.map((t, i) => (
            <figure key={t.name} className="min-w-0 flex-[0_0_100%] px-2 sm:px-4">
              <div className="relative isolate flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-slate-200 p-8 text-slate-900 shadow-[0_16px_36px_-20px_rgba(15,23,42,.35)] sm:p-12">
                <div
                  ref={(el) => {
                    layers.current[i] = el;
                  }}
                  aria-hidden
                  className="absolute inset-y-0 -left-[30%] -z-20 w-[160%] will-change-transform"
                >
                  <img
                    src={bgs[i % bgs.length]}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-[0.18] mix-blend-multiply grayscale"
                  />
                </div>
                <div
                  aria-hidden
                  className="absolute inset-0 -z-10 bg-gradient-to-br from-white/95 via-slate-50/95 to-slate-100/90"
                />
                <Quote className="absolute right-8 top-8 h-14 w-14 text-brand-red/15" aria-hidden />
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, k) => (
                    <Star key={k} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 text-xl leading-relaxed text-slate-900 sm:text-2xl">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-3 border-t border-slate-200 pt-5">
                  <span className="flex h-12 w-12 icon-pro text-lg font-bold">
                    {t.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t.name}</span>
                    <span className="block text-xs text-slate-500">{t.role}</span>
                  </span>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-5">
        <NavButton dir="prev" onClick={prev} label="Previous story" />
        <div className="flex items-center gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to story ${i + 1}`}
              aria-current={i === index}
              onClick={() => api?.scrollTo(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-7 bg-gradient-to-r from-[#a80016] to-[#dc2640]" : "w-2 bg-border hover:bg-muted-foreground/40"}`}
            />
          ))}
        </div>
        <NavButton dir="next" onClick={next} label="Next story" />
      </div>
    </div>
  );
}

/* ---------------- Services: swipe carousel on phone/tablet, grid on desktop ---------------- */

export type ServiceCard = {
  name: string;
  img: string;
  price: string;
  type: string;
  icon: LucideIcon;
  desc: string;
  soon?: boolean;
};

export function ServicesCarousel({ items }: { items: ServiceCard[] }) {
  const [ref, api] = useEmblaCarousel({
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
    breakpoints: { "(min-width: 1024px)": { active: false } },
  });
  const { index, count } = useDots(api);

  return (
    <div
      data-no-aos
      className="mt-12 lg:mx-auto lg:max-w-4xl"
      role="region"
      aria-roledescription="carousel"
      aria-label="Services"
    >
      <div ref={ref} className="overflow-hidden">
        <div className="flex gap-5 lg:gap-5">
          {items.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} className="min-w-0 flex-[0_0_82%] sm:flex-[0_0_46%] lg:flex-1">
                <Link
                  to="/services"
                  className="group block h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={s.img}
                      alt={`${s.name} worker`}
                      loading="lazy"
                      width={1200}
                      height={900}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold shadow-sm">
                      <Icon className="h-3.5 w-3.5 text-brand-red" /> {s.type}
                    </div>
                    <div className="absolute bottom-3 left-3 text-white">
                      <p className="text-xs font-medium text-white/80">Starting</p>
                      <p className="text-lg font-bold">{s.price}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                    <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-red">
                      Book now{" "}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-5 lg:hidden">
        <NavButton dir="prev" onClick={() => api?.scrollPrev()} label="Previous service" />
        <div className="flex items-center gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to service ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-7 bg-brand-red" : "w-2 bg-border"}`}
            />
          ))}
        </div>
        <NavButton dir="next" onClick={() => api?.scrollNext()} label="Next service" />
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import AOS from "aos";

const AUTO_SELECTOR = "main h2, main h3, main .card-elevated, main figure, main [data-reveal]";

/**
 * One place for all page motion:
 *  - AOS (scroll reveal) — started AFTER the preloader finishes, refreshed on every route change
 *  - auto-tags below-the-fold headings/cards on inner pages so every page animates
 *  - scroll parallax for any element with data-parallax="0.15" (+ = slower, - = faster)
 *  - top scroll-progress bar
 * Everything respects prefers-reduced-motion.
 */
export function MotionProvider() {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let started = false;
    let parallaxEls: HTMLElement[] = [];
    let raf = 0;

    const autoTag = () => {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>(AUTO_SELECTOR).forEach((el, i) => {
        if (el.hasAttribute("data-aos") || el.closest("[data-no-aos]")) return;
        if (el.parentElement?.closest("[data-aos]")) return; // ancestor already animates
        if (el.getBoundingClientRect().top < vh * 0.9) return; // above the fold: no flash
        el.setAttribute("data-aos", "fade-up");
        el.setAttribute("data-aos-delay", String((i % 3) * 80));
      });
    };

    const collect = () => {
      parallaxEls = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    };

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (barRef.current)
        barRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      if (reduce) return;
      const mid = window.innerHeight / 2;
      for (const el of parallaxEls) {
        const p = el.parentElement;
        if (!p) continue;
        const r = p.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        const speed = parseFloat(el.dataset.parallax || "0.15");
        const y = -(r.top + r.height / 2 - mid) * speed;
        el.style.translate = `0 ${y.toFixed(1)}px`; // individual transform: composes with rotate/AOS
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const refresh = () => {
      autoTag();
      collect();
      if (started) requestAnimationFrame(() => AOS.refreshHard());
      update();
    };

    const start = () => {
      if (started) return;
      started = true;
      AOS.init({
        duration: 750,
        easing: "ease-out-cubic",
        once: true,
        offset: 70,
        disable: reduce,
      });
      refresh();
    };

    // Remove AOS' permanent transition/delay after the reveal so hover effects stay snappy.
    const onIn = (e: Event) => {
      const el = (e as CustomEvent<HTMLElement>).detail;
      if (!el?.removeAttribute) return;
      const delay = Number(el.getAttribute("data-aos-delay") || 0);
      window.setTimeout(
        () => {
          el.removeAttribute("data-aos");
          el.removeAttribute("data-aos-delay");
        },
        750 + delay + 120,
      );
    };

    // Never touch page DOM before React has hydrated (avoids hydration mismatches):
    // on first visit we wait for the preloader; on repeat visits we wait a beat.
    let timer = 0;
    if (window.__dsReady || document.documentElement.classList.contains("splash-skip")) {
      timer = window.setTimeout(start, 350);
    } else {
      window.addEventListener("daystart:ready", start, { once: true });
    }

    document.addEventListener("aos:in", onIn);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const unsub = router.subscribe("onResolved", () => {
      if (started) window.setTimeout(refresh, 60);
    });
    update();

    return () => {
      unsub();
      document.removeEventListener("aos:in", onIn);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("daystart:ready", start);
      window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [router]);

  return <div ref={barRef} aria-hidden className="ds-progress" />;
}

/** Animated number. Server renders the final value (works without JS). */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1600,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / duration);
          setVal(to * (1 - Math.pow(1 - k, 3)));
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

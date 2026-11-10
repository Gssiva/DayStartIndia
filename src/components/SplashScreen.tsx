import { useEffect, useRef, useState } from "react";
import { Logo, LOGO_SRC } from "./Logo";

const MIN_MS = 1500; // preloader fades out after ~1.5s
const MAX_MS = 3500; // never block the site longer than this
const SEEN_KEY = "ds-splash-seen";

declare global {
  interface Window {
    __dsReady?: boolean;
  }
}

function loadImage(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
    if (img.complete) resolve();
  });
}

/**
 * Real preloader: progress reflects what is ACTUALLY loading (logo, fonts,
 * window "load" event, above-the-fold images). Shown once per browser session.
 * SSR-safe: it is in the server HTML, hidden instantly by an inline <head>
 * script (see __root.tsx) on repeat visits, and a CSS failsafe removes it even
 * if JavaScript never runs.
 */
export function SplashScreen() {
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const finish = () => {
      window.__dsReady = true;
      window.dispatchEvent(new Event("daystart:ready"));
    };

    if (root.classList.contains("splash-skip")) {
      setShow(false);
      finish();
      return;
    }

    root.style.overflow = "hidden";
    // performance.now() is measured from navigation start, so slow hydration counts toward the minimum time
    const start = 0;
    if (barRef.current) barRef.current.style.animation = "none"; // hand the bar over from CSS creep to real progress
    let done = 0;
    const total = 4;
    let target = 0;
    let shown = 0;
    let raf = 0;
    let finished = false;

    const tick = (n: number) => {
      done = n;
      target = Math.round((done / total) * 100);
    };
    const mark = () => tick(done + 1);

    const tasks = [
      loadImage(LOGO_SRC).then(mark),
      (document.fonts?.ready ?? Promise.resolve()).then(mark, mark),
      new Promise<void>((r) =>
        document.readyState === "complete"
          ? r()
          : window.addEventListener("load", () => r(), { once: true }),
      ).then(mark),
      // only images that are actually visible on first paint (never lazy/offscreen ones)
      Promise.all(
        Array.from(document.querySelectorAll<HTMLImageElement>("main img"))
          .filter((i) => i.loading !== "lazy" && i.getBoundingClientRect().top < window.innerHeight)
          .slice(0, 6)
          .map((i) =>
            i.complete
              ? Promise.resolve()
              : new Promise<void>((r) => {
                  i.onload = i.onerror = () => r();
                }),
          ),
      ).then(mark),
    ];

    const leave = () => {
      if (finished) return;
      finished = true;
      target = 100;
      setLeaving(true);
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* private mode */
      }
      window.setTimeout(() => {
        root.style.overflow = "";
        setShow(false);
        finish();
      }, 550);
    };

    const loop = () => {
      const elapsed = performance.now() - start;
      // ease displayed number toward real progress; never faster than the min-time curve
      const cap = Math.min(100, Math.max(15, (elapsed / MIN_MS) * 100));
      shown += (Math.min(target, cap) - shown) * 0.2;
      const rounded = Math.min(100, Math.round(shown));
      setPct(rounded);
      if (barRef.current) barRef.current.style.transform = `scaleX(${shown / 100})`;
      if (!finished && ((done >= total && elapsed >= MIN_MS && rounded >= 99) || elapsed >= MAX_MS))
        leave();
      if (!finished || shown < 99.5) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    void Promise.all(tasks);

    return () => {
      cancelAnimationFrame(raf);
      root.style.overflow = "";
    };
  }, []);

  if (!show) return null;

  return (
    <div
      id="ds-splash"
      role="status"
      aria-live="polite"
      aria-label="DayStart is loading"
      className={`ds-splash ${leaving ? "ds-splash--leaving" : ""}`}
    >
      <div className="ds-splash__glow" aria-hidden />
      <div className="ds-splash__inner">
        <div className="ds-splash__logo">
          <span className="ds-splash__ring" aria-hidden />
          <Logo
            size={160}
            priority
            className="h-28 w-28 rounded-full object-cover sm:h-36 sm:w-36"
          />
        </div>
        <p className="wordmark mt-6 text-3xl leading-none">
          <span>Day</span>
          <span className="text-brand-red">Start</span>
        </p>
        <div className="ds-splash__track" aria-hidden>
          <div ref={barRef} className="ds-splash__bar" />
        </div>
        <p className="ds-splash__pct" aria-hidden>
          {pct === null ? "" : `${pct}%`}
        </p>
        <p className="mt-2 text-sm font-medium tracking-wide text-muted-foreground">
          Turning every morning into new opportunity
        </p>
      </div>
    </div>
  );
}

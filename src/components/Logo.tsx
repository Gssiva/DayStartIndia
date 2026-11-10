import { useCallback, useState } from "react";

/**
 * The logo is served from /public so it works on ANY host (Vercel, Netlify,
 * Cloudflare, localhost).
 */
export const LOGO_SRC = "/logo.png";
export const LOGO_PRIMARY_SRC = LOGO_SRC;

type LogoProps = {
  className?: string;
  size?: number;
  alt?: string;
  /** Render eagerly + high priority (navbar, splash, hero). Default: true. */
  priority?: boolean;
};

export function Logo({ className = "", size = 40, alt = "DayStart", priority = true }: LogoProps) {
  const [failed, setFailed] = useState(false);

  // If the <img> errored BEFORE React hydrated, onError never fires. This ref
  // callback checks the already-finished state so the SVG fallback still kicks in.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <svg
        role="img"
        aria-label={alt}
        viewBox="0 0 120 40"
        width={size * 3}
        height={size}
        className={className}
      >
        <text
          x="0"
          y="30"
          fontFamily="'Baloo 2', 'Outfit', sans-serif"
          fontWeight="800"
          fontSize="30"
          fill="currentColor"
        >
          Day
        </text>
        <text
          x="55"
          y="30"
          fontFamily="'Baloo 2', 'Outfit', sans-serif"
          fontWeight="800"
          fontSize="30"
          fill="var(--brand-red)"
        >
          Start
        </text>
      </svg>
    );
  }

  return (
    <img
      ref={ref}
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

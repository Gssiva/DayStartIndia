import { Link } from "@tanstack/react-router";
import {
  MapPin,
  Mail,
  Phone,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  ArrowUp,
  ArrowRight,
} from "lucide-react";
import { Logo } from "./Logo";

const columns = [
  {
    title: "Services",
    links: [
      { to: "/services", label: "Agriculture" },
      { to: "/services", label: "Construction" },
      { to: "/services", label: "All services" },
    ],
  },
  {
    title: "Platform",
    links: [
      { to: "/book", label: "Book a worker" },
      { to: "/bookings", label: "My bookings" },
      { to: "/how-it-works", label: "How it works" },
      { to: "/login", label: "Log in" },
      { to: "/register", label: "Join" },
    ],
  },

  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" },
      { to: "/coming-soon", label: "Careers" },
      { to: "/coming-soon", label: "Press" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/coming-soon", label: "Privacy policy" },
      { to: "/coming-soon", label: "Terms of service" },
      { to: "/coming-soon", label: "Refund policy" },
      { to: "/coming-soon", label: "Worker charter" },
    ],
  },
] as const;

function scrollTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-muted/40">
      <div className="container-page pb-10 pt-16">
        {/* Newsletter */}
        <div className="card-elevated mb-14 flex flex-col gap-4 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <p className="text-eyebrow">Stay in the loop</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">
              Product updates, worker stories, and city launches.
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              One short email a month. Unsubscribe anytime.
            </p>
          </div>
          <form className="flex w-full max-w-md gap-2" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              placeholder="you@company.com"
              className="h-11 w-full rounded-full border border-input bg-background px-4 text-sm shadow-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-red px-5 text-sm font-semibold text-white shadow-brand transition-transform hover:-translate-y-0.5"
            >
              Subscribe <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2">
              <Logo className="h-9 w-9 object-contain" size={36} />
              <span className="wordmark text-2xl">
                <span className="text-foreground">Day</span>
                <span className="text-brand-red">Start</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              A technology-enabled daily labour employment platform for India. Verified workers,
              fair wages, transparent pricing.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-red" aria-hidden="true" /> Visakhapatnam,
                Andhra Pradesh
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-red" aria-hidden="true" />
                <a href="mailto:info@daystart.co.in" className="hover:text-foreground">
                  info@daystart.co.in
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-red" aria-hidden="true" />
                <a href="mailto:hr@daystart.co.in" className="hover:text-foreground">
                  hr@daystart.co.in
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-red" aria-hidden="true" />
                <a href="mailto:gsk@daystart.co.in" className="hover:text-foreground">
                  gsk@daystart.co.in
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand-red" aria-hidden="true" />
                <a href="tel:+919032078142" className="hover:text-foreground">
                  +91 90320 78142
                </a>
              </li>
            </ul>

            <div className="mt-6 flex gap-2">
              {[
                { icon: Twitter, label: "Twitter" },
                { icon: Linkedin, label: "LinkedIn" },
                { icon: Instagram, label: "Instagram" },
                { icon: Facebook, label: "Facebook" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={`DayStart on ${label}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-brand-red hover:text-brand-red"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} DayStart Pvt.ltd. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <p className="italic">A new day. A new you. A new beginning.</p>
            <button
              type="button"
              onClick={scrollTop}
              aria-label="Back to top"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:border-brand-red hover:text-brand-red"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

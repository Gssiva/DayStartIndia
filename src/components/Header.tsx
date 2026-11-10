import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CalendarCheck, LogOut, Menu, User as UserIcon, X } from "lucide-react";
import { Logo } from "./Logo";
import { signOutSecurely, useSession } from "@/lib/auth-session";

const guestNav = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

const memberNav = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/bookings", label: "Bookings" },
  { to: "/profile", label: "Profile" },
  { to: "/notifications", label: "Notifications" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();

  const nav = user ? memberNav : guestNav;

  async function handleSignOut() {
    await signOutSecurely();
    navigate({ to: "/", replace: true });
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 ${
        scrolled
          ? "border-b border-border/80 bg-background/85 backdrop-blur-lg shadow-sm"
          : "border-b border-transparent bg-background/60 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="DayStart home">
          <Logo className="h-9 w-9 object-contain sm:h-10 sm:w-10" size={40} priority />
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {nav.slice(1).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "text-foreground font-semibold bg-muted" }}
              activeOptions={{ exact: true }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <button
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-foreground/70 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-3.5 py-2 text-sm font-medium text-foreground/70 hover:text-foreground"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-full px-3.5 py-2 text-sm font-medium text-foreground/70 hover:text-foreground"
              >
                Register
              </Link>
            </>
          )}
          <Link
            to="/book"
            className="inline-flex h-10 items-center rounded-full bg-brand-red px-5 text-sm font-semibold text-white shadow-brand transition-transform hover:-translate-y-0.5"
          >
            Book a Customer
          </Link>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 hover:bg-muted"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="flex flex-col p-3" aria-label="Mobile">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
                activeProps={{ className: "text-foreground font-semibold bg-muted" }}
                activeOptions={{ exact: true }}
              >
                {n.label}
              </Link>
            ))}
            {user ? (
              <button
                onClick={() => {
                  setOpen(false);
                  void handleSignOut();
                }}
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
                >
                  <UserIcon className="h-4 w-4" aria-hidden="true" /> Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden="true" /> Sign up
                </Link>
              </>
            )}
            <Link
              to="/book"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-red px-5 text-sm font-semibold text-white shadow-brand"
            >
              <Bell className="h-4 w-4" aria-hidden="true" /> Book a worker
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

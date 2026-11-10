import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CalendarCheck, LogOut, Mail, MapPin, Phone, User as UserIcon } from "lucide-react";
import { customerInfo, formatPhone, signOutSecurely, useSession } from "@/lib/auth-session";
import {
  getBookings,
  getSavedAddresses,
  type Booking,
  type BookingAddress,
} from "@/lib/booking-store";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — DayStart" },
      {
        name: "description",
        content: "Manage your DayStart account, saved addresses, bookings and session settings.",
      },
      { property: "og:title", content: "Your profile — DayStart" },
      {
        property: "og:description",
        content: "Your DayStart account, saved addresses and bookings.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useSession();
  const info = customerInfo(user);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [addresses, setAddresses] = useState<BookingAddress[]>([]);

  useEffect(() => {
    getBookings().then(setBookings);
    setAddresses(getSavedAddresses());
  }, []);

  async function handleSignOut() {
    await signOutSecurely();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="container-page section">
      <p className="text-eyebrow">Account</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Your profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Account details, saved addresses and quick links to your activity.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card-elevated p-6 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
              <UserIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{info.name ?? "DayStart customer"}</p>
              <p className="text-xs text-muted-foreground">Customer account</p>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            {info.email && (
              <li className="flex items-center gap-2 break-all">
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" /> {info.email}
              </li>
            )}
            {info.phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatPhone(info.phone)}
              </li>
            )}
          </ul>

          <div className="mt-5 grid gap-2">
            <Link to="/bookings" className="chip justify-start">
              <CalendarCheck className="h-4 w-4" /> My bookings ({bookings.length})
            </Link>
            <Link to="/notifications" className="chip justify-start">
              <Bell className="h-4 w-4" /> Notifications
            </Link>
          </div>

          <button
            onClick={() => void handleSignOut()}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold hover:bg-muted"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
          </button>
        </div>

        <div className="card-elevated p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">Saved addresses</h2>
          {addresses.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No saved addresses yet — they are stored automatically when you complete a booking.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {addresses.map((a) => (
                <li key={a.line1} className="rounded-2xl border border-border p-4">
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-brand-red" aria-hidden="true" />{" "}
                    {a.label || "Address"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.line1}</p>
                  {a.landmark && (
                    <p className="text-xs text-muted-foreground">Landmark: {a.landmark}</p>
                  )}
                  {a.phone && <p className="text-xs text-muted-foreground">Contact: {a.phone}</p>}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 border-t border-border pt-5">
            <h2 className="text-lg font-semibold">Recent bookings</h2>
            {bookings.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                You haven&apos;t booked yet.{" "}
                <Link to="/book" className="font-semibold text-brand-red hover:underline">
                  Book a worker
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {bookings.slice(0, 4).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-muted-foreground">
                      {b.id} · {b.timing === "immediate" ? "Immediate" : `${b.date} · ${b.slot}`}
                    </span>
                    <Link to="/bookings/$id" params={{ id: b.id }} className="chip">
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

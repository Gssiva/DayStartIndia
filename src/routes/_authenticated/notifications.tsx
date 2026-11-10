import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CalendarDays } from "lucide-react";
import { getBookings, STATUS_META, type Booking } from "@/lib/booking-store";
import { findService, findSub } from "@/lib/booking-catalog";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — DayStart" },
      {
        name: "description",
        content:
          "Booking updates, worker assignments and payment alerts for your DayStart account.",
      },
      { property: "og:title", content: "Notifications — DayStart" },
      {
        property: "og:description",
        content: "Your DayStart booking and payment alerts in one feed.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  useEffect(() => {
    getBookings().then(setBookings);
  }, []);

  return (
    <div className="container-page section">
      <p className="text-eyebrow">Account</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Notifications</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Updates about your bookings, assigned workers and payments.
      </p>

      {bookings.length === 0 ? (
        <div className="card-elevated mt-8 p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Nothing here yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Book a worker and we&apos;ll keep you posted at every step.
          </p>
          <Link to="/book" className="btn-primary mt-6 h-11">
            Book a worker
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {bookings.map((b) => {
            const meta = STATUS_META[b.status];
            return (
              <li
                key={b.id}
                className="card-elevated flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div className="min-w-0">
                  <span className={meta.badge}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                  </span>
                  <p className="mt-2 font-semibold">
                    {findService(b.serviceId)?.name} · {findSub(b.serviceId, b.subId)?.name}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {b.timing === "immediate" ? "Immediate" : `${b.date} · ${b.slot}`} · {b.id}
                  </p>
                </div>
                <Link to="/bookings/$id" params={{ id: b.id }} className="chip">
                  View booking
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

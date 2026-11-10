import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Filter, MapPin, Search, Users } from "lucide-react";
import { findService, findSub, inr } from "@/lib/booking-catalog";
import {
  cancelBooking,
  getBookings,
  STATUS_META,
  type Booking,
  type BookingStatus,
} from "@/lib/booking-store";

export const Route = createFileRoute("/_authenticated/bookings/")({
  head: () => ({
    meta: [
      { title: "My bookings — DayStart" },
      {
        name: "description",
        content:
          "Track, filter and manage every DayStart worker booking — invoices, rebooking and cancellations in one place.",
      },
      { property: "og:title", content: "My bookings — DayStart" },
      {
        property: "og:description",
        content: "All your DayStart worker bookings, statuses and invoices in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingsPage,
});

const STATUS_FILTERS: (BookingStatus | "all")[] = [
  "all",
  "searching",
  "assigned",
  "on_the_way",
  "started",
  "completed",
  "cancelled",
];

function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [serviceId, setServiceId] = useState("all");

  useEffect(() => {
    getBookings().then(setBookings);
  }, []);

  const filtered = useMemo(
    () =>
      bookings.filter((b) => {
        if (status !== "all" && b.status !== status) return false;
        if (serviceId !== "all" && b.serviceId !== serviceId) return false;
        const hay =
          `${b.id} ${b.serviceId} ${b.subId} ${b.worker.name} ${b.area} ${b.city}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      }),
    [bookings, q, status, serviceId],
  );

  async function cancel(id: string) {
    try {
      await cancelBooking(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Cancellation failed.");
    }
    setBookings(await getBookings());
  }

  return (
    <div className="container-page section">
      <p className="text-eyebrow">Account</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">My bookings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Search, filter, download invoices, rebook or cancel.
      </p>

      <div className="card-elevated mt-8 flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-2 rounded-full border border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by booking ID, worker, service or area"
            className="h-11 w-full bg-transparent text-sm outline-none"
            aria-label="Search bookings"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Status
          </span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={status === s ? "chip chip-selected" : "chip"}
            >
              {s === "all" ? "All" : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Service</span>
          {["all", "agriculture", "beauty", "construction", "driver"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setServiceId(s)}
              className={serviceId === s ? "chip chip-selected" : "chip"}
            >
              {s === "all" ? "All" : findService(s)?.name}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-elevated mt-8 p-10 text-center">
          <h2 className="text-lg font-semibold">No bookings yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your DayStart bookings will show up here.
          </p>
          <Link to="/book" className="btn-primary mt-6 h-11">
            Book a worker
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {filtered.map((b) => {
            const svc = findService(b.serviceId);
            const sub = findSub(b.serviceId, b.subId);
            const meta = STATUS_META[b.status];
            return (
              <li key={b.id} className="card-elevated p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={meta.badge}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{b.id}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">
                      {svc?.name} · {sub?.name}
                    </h3>
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <li className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {b.timing === "immediate" ? "Immediate" : `${b.date} · ${b.slot}`}
                      </li>
                      <li className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> {b.workers} worker
                        {b.workers > 1 ? "s" : ""} · {b.worker.name}
                      </li>
                      <li className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> {b.area}, {b.city}
                      </li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{inr(b.payment.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      Advance {inr(b.payment.advance)} paid
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Link to="/bookings/$id" params={{ id: b.id }} className="chip">
                    View details
                  </Link>
                  <Link to="/bookings/$id" params={{ id: b.id }} className="chip">
                    Invoice
                  </Link>
                  <Link to="/book" className="chip">
                    Rebook
                  </Link>
                  {b.status !== "completed" && b.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() => cancel(b.id)}
                      className="chip text-brand-red"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

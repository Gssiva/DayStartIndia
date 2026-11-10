import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Loader2,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Smartphone,
  Wallet,
  Landmark,
  Zap,
} from "lucide-react";
import {
  DICT,
  LANGUAGES,
  SERVICES,
  SERVICE_AREAS,
  TIME_SLOTS,
  findService,
  findSub,
  inr,
  priceBreakdown,
  type LangCode,
} from "@/lib/booking-catalog";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createBooking } from "@/lib/bookings.functions";
import { clearPendingSelection, getPendingSelection } from "@/lib/services-catalog";
import {
  clearDraft,
  getDraft,
  getLanguage,
  getSavedAddresses,
  saveAddress,
  saveDraft,
  setLanguage,
  type BookingAddress,
} from "@/lib/booking-store";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "Book a verified worker in 60 seconds — DayStart" },
      {
        name: "description",
        content:
          "Book verified agriculture, beauty, construction and driver workers on DayStart. Transparent pricing, 30% advance, instant worker assignment.",
      },
      { property: "og:title", content: "Book a verified worker — DayStart" },
      {
        property: "og:description",
        content:
          "Pick a service, choose a time, pay 30% advance. A verified DayStart worker is assigned instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookPage,
});

type Draft = {
  step: number;
  language: LangCode;
  city: string;
  area: string;
  coords: { lat: number; lng: number } | null;
  serviceId: string | null;
  subId: string | null;
  workers: number;
  timing: "immediate" | "scheduled";
  date: string | null;
  slot: string | null;
  address: BookingAddress;
  method: string;
};

const emptyAddress: BookingAddress = {
  label: "Home",
  line1: "",
  landmark: "",
  instructions: "",
  phone: "",
  coords: null,
};

const initialDraft: Draft = {
  step: 1,
  language: "en",
  city: "",
  area: "",
  coords: null,
  serviceId: null,
  subId: null,
  workers: 1,
  timing: "immediate",
  date: null,
  slot: null,
  address: emptyAddress,
  method: "upi",
};

const TOTAL_STEPS = 10;

function BookPage() {
  const navigate = useNavigate();
  const createBookingFn = useServerFn(createBooking);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [hydrated, setHydrated] = useState(false);
  const [locating, setLocating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<BookingAddress[]>([]);

  useEffect(() => {
    const stored = getDraft<Draft | null>(null);
    const lang = getLanguage();
    const base: Draft = {
      ...initialDraft,
      ...(stored ?? {}),
      ...(lang && !stored ? { language: lang, step: 2 } : {}),
    };
    const pending = getPendingSelection();
    if (pending && findService(pending.serviceSlug)) {
      const hasSub = !!findSub(pending.serviceSlug, pending.subServiceSlug);
      base.serviceId = pending.serviceSlug;
      base.subId = hasSub ? pending.subServiceSlug : null;
      if (base.step > 2) base.step = hasSub ? 5 : 4;
      clearPendingSelection();
    }
    setDraft(base);
    setSavedAddresses(getSavedAddresses());
    setHydrated(true);
  }, []);

  // Pre-fill the contact number from the customer's account (they can still change it).
  useEffect(() => {
    if (!hydrated) return;
    void supabase.auth.getUser().then(({ data }) => {
      const phone = (data.user?.user_metadata as { phone?: string } | undefined)?.phone;
      if (!phone) return;
      setDraft((d) =>
        d.address.phone
          ? d
          : { ...d, address: { ...d.address, phone: phone.replace(/\D/g, "").slice(-10) } },
      );
    });
  }, [hydrated]);

  useEffect(() => {
    if (hydrated && !bookingId) saveDraft(draft);
  }, [draft, hydrated, bookingId]);

  const service = findService(draft.serviceId);
  const sub = findSub(draft.serviceId, draft.subId);
  const totals = useMemo(
    () => priceBreakdown(sub?.price ?? 0, service?.multiWorker ? draft.workers : 1),
    [sub, service, draft.workers],
  );
  const t = DICT[draft.language];

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const go = (step: number) => set({ step: Math.min(TOTAL_STEPS, Math.max(1, step)) });

  function detectLocation() {
    setLocating(true);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          city: draft.city || SERVICE_AREAS[0]!.city,
          area: draft.area || SERVICE_AREAS[0]!.areas[0]!,
        });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  async function confirmPayment() {
    setPaying(true);
    try {
      const saved = await createBookingFn({
        data: {
          language: draft.language,
          city: draft.city,
          area: draft.area,
          serviceSlug: draft.serviceId!,
          subSlug: draft.subId!,
          workers: service?.multiWorker ? draft.workers : 1,
          timing: draft.timing,
          date: draft.date,
          slot: draft.slot,
          method: draft.method,
          address: { ...draft.address, coords: draft.coords },
        },
      });
      saveAddress(draft.address);
      clearDraft();
      setBookingId(saved.id);
      setAssigning(true);
      go(10);
      window.setTimeout(() => setAssigning(false), 2500);
    } catch (e) {
      alert(e instanceof Error ? e.message : "We couldn't save your booking. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  const canContinue = (() => {
    switch (draft.step) {
      case 1:
        return !!draft.language;
      case 2:
        return !!draft.city && !!draft.area;
      case 3:
        return !!draft.serviceId;
      case 4:
        return !!draft.subId;
      case 5:
        return draft.workers >= 1;
      case 6:
        return draft.timing === "immediate" || (!!draft.date && !!draft.slot);
      case 7:
        return (
          draft.address.line1.trim().length > 4 &&
          /^[6-9]\d{9}$/.test(draft.address.phone.replace(/\D/g, ""))
        );
      case 8:
        return true;
      default:
        return true;
    }
  })();

  if (!hydrated) {
    return (
      <div className="container-page section min-h-[calc(100dvh-4rem)]">
        <div className="skeleton h-8 w-56 rounded-full" />
        <div className="skeleton mt-6 h-64 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-muted/20 bg-grid-soft">
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          {draft.step < 10 && (
            <>
              <p className="text-eyebrow">Booking</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>

              <div className="mt-6 flex items-center gap-3">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={draft.step}
                  aria-valuemin={1}
                  aria-valuemax={TOTAL_STEPS}
                  aria-label={`Step ${draft.step} of ${TOTAL_STEPS}`}
                >
                  <div
                    className="h-full rounded-full bg-brand-red transition-all duration-500"
                    style={{ width: `${(draft.step / TOTAL_STEPS) * 100}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  Step {draft.step} of {TOTAL_STEPS}
                </span>
              </div>
            </>
          )}

          <div key={draft.step} className="animate-in-up card-elevated mt-6 p-5 sm:p-8">
            {draft.step === 1 && (
              <Section title={t.language} hint="You can change this later.">
                <div className="grid gap-3 sm:grid-cols-3">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setLanguage(l.code);
                        set({ language: l.code });
                      }}
                      className={optionClass(draft.language === l.code)}
                    >
                      <span className="text-lg font-semibold">{l.native}</span>
                      <span className="text-xs text-muted-foreground">{l.label}</span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {draft.step === 2 && (
              <Section
                title={t.location}
                hint="We currently serve 3 cities across Andhra Pradesh and Telangana."
              >
                <button
                  type="button"
                  onClick={detectLocation}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted"
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LocateFixed className="h-4 w-4 text-brand-red" />
                  )}
                  Use my current location
                </button>
                {draft.coords && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                    <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-brand-red" /> Pin dropped at{" "}
                      {draft.coords.lat.toFixed(4)}, {draft.coords.lng.toFixed(4)}
                    </div>
                    <div className="bg-radial-glow h-28 w-full" aria-hidden="true" />
                  </div>
                )}

                <div className="mt-6 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-semibold">City</p>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_AREAS.map((c) => (
                        <button
                          key={c.city}
                          type="button"
                          onClick={() => set({ city: c.city, area: "" })}
                          className={draft.city === c.city ? "chip chip-selected" : "chip"}
                        >
                          {c.city}
                        </button>
                      ))}
                    </div>
                  </div>
                  {draft.city && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">Area</p>
                      <div className="flex flex-wrap gap-2">
                        {SERVICE_AREAS.find((c) => c.city === draft.city)!.areas.map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => set({ area: a })}
                            className={draft.area === a ? "chip chip-selected" : "chip"}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {draft.area && (
                    <p className="badge badge-success">
                      <Check className="h-3.5 w-3.5" /> Service available in {draft.area}
                    </p>
                  )}
                </div>
              </Section>
            )}

            {draft.step === 3 && (
              <Section title={t.service} hint="Verified, background-checked DayStart employees.">
                <div className="grid gap-4 sm:grid-cols-2">
                  {SERVICES.map((s) => {
                    const Icon = s.icon;
                    const selected = draft.serviceId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => set({ serviceId: s.id, subId: null })}
                        className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                          selected
                            ? "border-brand-red ring-2 ring-brand-red/30"
                            : "border-border bg-card"
                        }`}
                      >
                        <div
                          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.accent}`}
                        />
                        <div className="relative">
                          {s.popular && <span className="badge badge-brand mb-3">Popular</span>}
                          <Icon className="h-9 w-9 text-brand-red transition-transform duration-200 group-hover:scale-110" />
                          <h3 className="mt-3 text-lg font-semibold">{s.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
                          <div className="mt-4 flex items-center justify-between text-sm">
                            <span className="font-semibold">From {inr(s.startingPrice)}</span>
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" /> {s.eta}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {draft.step === 4 && service && (
              <Section title={t.sub} hint={`${service.name} sub-services`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {service.subs.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => set({ subId: s.id })}
                        className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                          draft.subId === s.id
                            ? "border-brand-red ring-2 ring-brand-red/30"
                            : "border-border bg-card"
                        }`}
                      >
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Icon className="h-5 w-5 text-brand-red" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {inr(s.price)} · {s.unit}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {draft.step === 5 && (
              <Section
                title={t.workers}
                hint={
                  service?.multiWorker
                    ? "Add as many workers as your site needs."
                    : "This service is delivered by a single specialist."
                }
              >
                {service?.multiWorker ? (
                  <div className="flex flex-col items-center gap-6 py-4">
                    <div className="flex items-center gap-6">
                      <CounterButton
                        onClick={() => set({ workers: Math.max(1, draft.workers - 1) })}
                        label="Decrease workers"
                      >
                        <Minus className="h-5 w-5" />
                      </CounterButton>
                      <span className="w-20 text-center text-5xl font-bold tabular-nums">
                        {draft.workers}
                      </span>
                      <CounterButton
                        onClick={() => set({ workers: Math.min(20, draft.workers + 1) })}
                        label="Increase workers"
                      >
                        <Plus className="h-5 w-5" />
                      </CounterButton>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[1, 2, 5, 10, 20].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => set({ workers: n })}
                          className={draft.workers === n ? "chip chip-selected" : "chip"}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-lg font-semibold">
                      {inr(totals.base)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        before fees & taxes
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
                    <p className="font-semibold">1 specialist</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sub?.name} is a single-worker service.
                    </p>
                  </div>
                )}
              </Section>
            )}

            {draft.step === 6 && (
              <Section title={t.when} hint="Immediate bookings are assigned within minutes.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => set({ timing: "immediate" })}
                    className={optionClass(draft.timing === "immediate")}
                  >
                    <Zap className="h-5 w-5 text-brand-red" />
                    <span className="font-semibold">Immediate</span>
                    <span className="text-xs text-muted-foreground">
                      ETA {service?.eta ?? "45–60 min"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => set({ timing: "scheduled" })}
                    className={optionClass(draft.timing === "scheduled")}
                  >
                    <Clock className="h-5 w-5 text-brand-red" />
                    <span className="font-semibold">Scheduled</span>
                    <span className="text-xs text-muted-foreground">Choose date & slot</span>
                  </button>
                </div>

                {draft.timing === "scheduled" && (
                  <div className="mt-6 space-y-5">
                    <div>
                      <p className="mb-2 text-sm font-semibold">Date</p>
                      <div className="flex flex-wrap gap-2">
                        {nextDays(7).map((d) => (
                          <button
                            key={d.iso}
                            type="button"
                            onClick={() => set({ date: d.iso, slot: null })}
                            className={`rounded-2xl border px-4 py-2.5 text-center transition-colors ${
                              draft.date === d.iso
                                ? "border-brand-red bg-brand-red text-white"
                                : "border-border bg-card hover:bg-muted"
                            }`}
                          >
                            <span className="block text-xs opacity-80">{d.dow}</span>
                            <span className="block text-lg font-semibold leading-tight">
                              {d.day}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {draft.date && (
                      <div>
                        <p className="mb-2 text-sm font-semibold">Time slot</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {TIME_SLOTS.map((s, i) => {
                            const disabled = isSlotDisabled(draft.date!, i);
                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={disabled}
                                onClick={() => set({ slot: s })}
                                className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                                  draft.slot === s
                                    ? "border-brand-red bg-brand-red font-semibold text-white"
                                    : disabled
                                      ? "cursor-not-allowed border-border bg-muted/50 text-muted-foreground/50 line-through"
                                      : "border-border bg-card hover:bg-muted"
                                }`}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Section>
            )}

            {draft.step === 7 && (
              <Section title={t.address} hint="Our worker uses this to reach you.">
                {savedAddresses.length > 0 && (
                  <div className="mb-5">
                    <p className="mb-2 text-sm font-semibold">Saved addresses</p>
                    <div className="flex flex-wrap gap-2">
                      {savedAddresses.map((a) => (
                        <button
                          key={a.line1}
                          type="button"
                          onClick={() => set({ address: a })}
                          className="chip"
                        >
                          <MapPin className="h-3.5 w-3.5 text-brand-red" /> {a.label} ·{" "}
                          {a.line1.slice(0, 24)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {["Home", "Work", "Other"].map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => set({ address: { ...draft.address, label: l } })}
                        className={draft.address.label === l ? "chip chip-selected" : "chip"}
                      >
                        {l}
                      </button>
                    ))}
                    <button type="button" onClick={detectLocation} className="chip">
                      <LocateFixed className="h-3.5 w-3.5 text-brand-red" /> Use current location
                    </button>
                  </div>
                  <Field label="Full address">
                    <input
                      className="fld"
                      value={draft.address.line1}
                      onChange={(e) =>
                        set({ address: { ...draft.address, line1: e.target.value } })
                      }
                      placeholder="House / flat, street, area"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Landmark">
                      <input
                        className="fld"
                        value={draft.address.landmark}
                        onChange={(e) =>
                          set({ address: { ...draft.address, landmark: e.target.value } })
                        }
                        placeholder="Near…"
                      />
                    </Field>
                    <Field label="Phone number">
                      <input
                        className="fld"
                        inputMode="numeric"
                        value={draft.address.phone}
                        onChange={(e) =>
                          set({
                            address: {
                              ...draft.address,
                              phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                            },
                          })
                        }
                        placeholder="10-digit mobile"
                      />
                    </Field>
                  </div>
                  <Field label="Instructions for the worker (optional)">
                    <textarea
                      rows={3}
                      className="fld"
                      value={draft.address.instructions}
                      onChange={(e) =>
                        set({ address: { ...draft.address, instructions: e.target.value } })
                      }
                      placeholder="Gate code, parking, who to ask for…"
                    />
                  </Field>
                </div>
              </Section>
            )}

            {draft.step === 8 && (
              <Section title={t.summary} hint="Tap any row to edit.">
                <dl className="divide-y divide-border rounded-2xl border border-border">
                  <SummaryRow label="Service" value={service?.name ?? "—"} onEdit={() => go(3)} />
                  <SummaryRow label="Sub-service" value={sub?.name ?? "—"} onEdit={() => go(4)} />
                  <SummaryRow
                    label="Workers"
                    value={String(service?.multiWorker ? draft.workers : 1)}
                    onEdit={() => go(5)}
                  />
                  <SummaryRow
                    label="When"
                    value={
                      draft.timing === "immediate"
                        ? `Immediate · ETA ${service?.eta}`
                        : `${draft.date} · ${draft.slot}`
                    }
                    onEdit={() => go(6)}
                  />
                  <SummaryRow
                    label="Address"
                    value={`${draft.address.label} · ${draft.address.line1}, ${draft.area}, ${draft.city}`}
                    onEdit={() => go(7)}
                  />
                </dl>

                <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-5">
                  <PriceRow
                    label={`${sub?.name ?? "Service"} × ${service?.multiWorker ? draft.workers : 1}`}
                    value={inr(totals.base)}
                  />
                  <PriceRow label="Platform fee" value={inr(totals.platformFee)} />
                  <PriceRow label="GST (5%)" value={inr(totals.taxes)} />
                  <div className="mt-3 border-t border-border pt-3">
                    <PriceRow label="Total" value={inr(totals.total)} bold />
                    <PriceRow label="Advance now (30%)" value={inr(totals.advance)} />
                    <PriceRow label="After completion (70%)" value={inr(totals.remaining)} />
                  </div>
                </div>
              </Section>
            )}

            {draft.step === 9 && (
              <Section
                title={t.payment}
                hint={`Pay ${inr(totals.advance)} now, ${inr(totals.remaining)} after the work is completed.`}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { id: "upi", label: "UPI", desc: "GPay, PhonePe, Paytm", icon: Smartphone },
                    { id: "card", label: "Card", desc: "Credit / debit", icon: CreditCard },
                    {
                      id: "netbanking",
                      label: "Net banking",
                      desc: "All major banks",
                      icon: Landmark,
                    },
                    { id: "wallet", label: "Wallet", desc: "DayStart balance", icon: Wallet },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => set({ method: m.id })}
                        className={optionClass(draft.method === m.id)}
                      >
                        <Icon className="h-5 w-5 text-brand-red" />
                        <span className="font-semibold">{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={confirmPayment}
                  disabled={paying}
                  className="btn-primary mt-6 h-12 w-full justify-center disabled:opacity-70"
                >
                  {paying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing payment…
                    </>
                  ) : (
                    <>Pay {inr(totals.advance)} advance</>
                  )}
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Demo payment simulation — no real money is charged.
                </p>
              </Section>
            )}

            {draft.step === 10 && bookingId && (
              <div className="py-4 text-center">
                <div className="animate-in-up mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-11 w-11 text-emerald-600" />
                </div>
                <h1 className="mt-5 text-3xl font-bold tracking-tight">{t.done}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Booking ID <span className="font-semibold text-foreground">{bookingId}</span>
                </p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
                  {assigning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-brand-red" /> Searching for a
                      verified worker…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" /> Worker assigned · ETA{" "}
                      {service?.eta ?? "45–60 min"}
                    </>
                  )}
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to="/bookings/$id" params={{ id: bookingId }} className="btn-primary h-11">
                    Track booking <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/bookings/$id"
                    params={{ id: bookingId }}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
                  >
                    <Download className="h-4 w-4" /> Download invoice
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/" })}
                    className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
                  >
                    Back to home
                  </button>
                </div>
              </div>
            )}
          </div>

          {draft.step < 9 && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => go(draft.step - 1)}
                disabled={draft.step === 1}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
              <div className="flex items-center gap-3">
                {draft.step >= 4 && sub && (
                  <span className="hidden text-sm font-semibold sm:inline">
                    {inr(totals.total)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => go(draft.step + 1)}
                  disabled={!canContinue}
                  className="btn-primary h-11 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.next} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {draft.step === 9 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => go(8)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .fld{display:block;width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.7rem 0.9rem;font-size:0.95rem;outline:none;transition:border-color .15s,box-shadow .15s}
        .fld:focus{border-color:var(--brand-red);box-shadow:0 0 0 3px oklch(0.55 0.22 27 / 0.2)}
      `}</style>
    </div>
  );
}

function optionClass(selected: boolean) {
  return `flex flex-col items-start gap-1 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
    selected ? "border-brand-red ring-2 ring-brand-red/30" : "border-border bg-card"
  }`;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function CounterButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-brand-red hover:text-brand-red"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-sm font-semibold text-brand-red hover:underline"
      >
        Edit
      </button>
    </div>
  );
}

function PriceRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-1 text-sm ${bold ? "font-semibold" : ""}`}
    >
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function nextDays(count: number) {
  const out: { iso: string; dow: string; day: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      dow: d.toLocaleDateString("en-IN", { weekday: "short" }),
      day: String(d.getDate()),
    });
  }
  return out;
}

function isSlotDisabled(iso: string, index: number) {
  const today = new Date().toISOString().slice(0, 10);
  if (iso !== today) return index === 6 && false;
  const startHour = 6 + index * 2;
  return new Date().getHours() >= startHour;
}

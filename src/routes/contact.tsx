import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CONTACT_TOPICS, sendContactMessage, type ContactTopic } from "@/lib/contact.functions";
import { customerInfo, useSession } from "@/lib/auth-session";
import { SERVICES } from "@/lib/booking-catalog";
import { Mail, MapPin, Phone, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact DayStart — Booking help and enquiries" },
      {
        name: "description",
        content:
          "Questions about booking a verified worker? Reach the DayStart team in Visakhapatnam and Hyderabad.",
      },
      { property: "og:title", content: "Contact DayStart" },
      {
        property: "og:description",
        content: "Reach the DayStart team — booking enquiries, support and business requirements.",
      },
    ],
  }),
  component: ContactPage,
});

type FormState = {
  name: string;
  phone: string;
  email: string;
  website: string;
  topic: ContactTopic;
  service: string;
  message: string;
};

const initial: FormState = {
  name: "",
  phone: "",
  email: "",
  website: "",
  topic: "booking",
  service: SERVICES[0]?.name ?? "Agriculture",
  message: "",
};

function ContactPage() {
  const [form, setForm] = useState<FormState>(initial);
  const [sent, setSent] = useState(false);
  const { user } = useSession();

  // Logged-in customers get their details pre-filled (they can still edit them).
  useEffect(() => {
    if (!user) return;
    const info = customerInfo(user);
    setForm((f) => ({
      ...f,
      name: f.name || info.name || "",
      email: f.email || info.email || "",
      phone: f.phone || info.phone || "",
    }));
  }, [user]);

  const send = useServerFn(sendContactMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await send({ data: form });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="border-b border-border bg-brand-cream">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">Contact</p>
          <h1 className="mt-3 text-5xl font-bold sm:text-6xl">Let's talk.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Questions about a booking, need help, or have a bulk requirement? Send us a message.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <ContactCard icon={MapPin} title="Headquarters" body={"Visakhapatnam,\nAndhra Pradesh"} />
          <ContactCard icon={Phone} title="Phone" body="+91 90320 78142" href="tel:+919032078142" />
          <div className="rounded-2xl border border-border bg-card p-6">
            <Mail className="h-6 w-6 text-brand-red" />
            <h3 className="mt-3 font-display text-lg font-bold">Email</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {[
                { addr: "info@daystart.co.in", note: "General enquiries" },
                { addr: "gsk@daystart.co.in", note: "Business & partnerships" },
              ].map((e) => (
                <li key={e.addr}>
                  <a href={`mailto:${e.addr}`} className="font-semibold hover:text-brand-red">
                    {e.addr}
                  </a>
                  <span className="block text-xs text-muted-foreground">{e.note}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-bold">Support hours</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Monday – Saturday · 07:00 – 21:00 IST
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
            {sent ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-brand-red" />
                <h2 className="mt-4 font-display text-3xl font-bold">
                  Thanks, {form.name || "friend"}!
                </h2>
                <p className="mt-3 text-muted-foreground">
                  We've sent your enquiry to our team. We will call you on{" "}
                  <strong>+91 {form.phone}</strong> within 2 working hours.
                </p>
                <button
                  onClick={() => {
                    setForm({ ...initial, name: form.name, email: form.email, phone: form.phone });
                    setSent(false);
                  }}
                  className="mt-6 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold hover:bg-accent"
                >
                  Send another enquiry
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <h2 className="font-display text-2xl font-bold">Send us an enquiry</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      autoComplete="name"
                      className="input"
                      placeholder="Your name"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      required
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
                      }
                      className="input"
                      placeholder="10-digit mobile number"
                    />
                  </Field>
                </div>

                <Field label="Email">
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input"
                    placeholder="you@example.com"
                  />
                </Field>
                {/* honeypot: hidden from people, bots fill it */}
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  name="website"
                />

                <Field label="What is this about?">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(CONTACT_TOPICS) as ContactTopic[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, topic: t })}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                          form.topic === t
                            ? "border-brand-red bg-brand-red text-white"
                            : "border-border bg-card hover:bg-accent"
                        }`}
                      >
                        {CONTACT_TOPICS[t]}
                      </button>
                    ))}
                  </div>
                </Field>

                {form.topic === "booking" && (
                  <Field label="Service you need">
                    <select
                      value={form.service}
                      onChange={(e) => setForm({ ...form, service: e.target.value })}
                      className="input"
                    >
                      {SERVICES.map((svc) => (
                        <option key={svc.id}>{svc.name}</option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Message">
                  <textarea
                    required
                    minLength={10}
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="input"
                    placeholder="Tell us about your requirement — date, location, worker count…"
                  />
                </Field>

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-red text-base font-semibold text-white shadow-brand disabled:opacity-60 sm:w-auto sm:px-8"
                >
                  {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {sending ? "Sending…" : "Send enquiry"}
                </button>
                <p className="text-xs text-muted-foreground">
                  By submitting you agree to receive a follow-up call/SMS from DayStart.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <style>{`
        .input {
          display: block;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input:focus {
          border-color: var(--brand-red);
          box-shadow: 0 0 0 3px oklch(0.55 0.22 27 / 0.2);
        }
      `}</style>
    </>
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

function ContactCard({
  icon: Icon,
  title,
  body,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <Icon className="h-6 w-6 text-brand-red" />
      <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
      {href ? (
        <a href={href} className="mt-1 block text-sm font-semibold hover:text-brand-red">
          {body}
        </a>
      ) : (
        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{body}</p>
      )}
    </div>
  );
}

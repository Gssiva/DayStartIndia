import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  LifeBuoy,
  Mail,
  MapPin,
  Phone,
  Star,
  UserRound,
  Camera,
  Upload,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { findService, findSub, inr } from "@/lib/booking-catalog";
import {
  STATUS_FLOW,
  STATUS_META,
  getBooking,
  advanceBooking,
  rateBooking,
  type Booking,
} from "@/lib/booking-store";
import { useServerFn } from "@tanstack/react-start";
import { uploadEvidencePhoto, getBookingEvidence } from "@/lib/evidence-upload.functions";
import { openDispute, getDisputeDetails } from "@/lib/dispute.functions";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Booking ${params.id} — DayStart` },
      {
        name: "description",
        content: `Track DayStart booking ${params.id}: worker details, live timeline, payment breakdown and invoice.`,
      },
      { property: "og:title", content: `Booking ${params.id} — DayStart` },
      {
        property: "og:description",
        content:
          "Live status timeline, assigned worker details and invoice for your DayStart booking.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingDetailPage,
});

function BookingDetailPage() {
  const { id } = Route.useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [evidence, setEvidence] = useState<
    { id: string; evidence_type: string; file_path: string; file_url?: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [dispute, setDispute] = useState<{ id: string; reason: string; created_at: string } | null>(
    null,
  );

  const uploadEvidenceFn = useServerFn(uploadEvidencePhoto);
  const getEvidenceFn = useServerFn(getBookingEvidence);
  const openDisputeFn = useServerFn(openDispute);
  const getDisputeFn = useServerFn(getDisputeDetails);

  const loadDispute = async () => {
    try {
      const result = await getDisputeFn({ data: { bookingId: id } });
      setDispute(result.dispute);
    } catch (err) {
      // No dispute exists
      setDispute(null);
    }
  };

  const loadEvidence = async () => {
    try {
      const result = await getEvidenceFn({ data: { bookingId: id } });
      setEvidence(result.evidence || []);
    } catch (err) {
      console.error("Failed to load evidence:", err);
    }
  };

  useEffect(() => {
    getBooking(id)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoaded(true));

    // Load evidence for this booking
    loadEvidence();

    // Load dispute details
    loadDispute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, evidenceType: string) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          await uploadEvidenceFn({
            data: {
              bookingId: id,
              evidenceType,
              fileBase64: base64,
              fileName: file.name,
            },
          });
          await loadEvidence();
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  async function handleOpenDispute() {
    if (!disputeReason.trim() || disputeReason.length < 10) {
      alert("Please provide a detailed reason (at least 10 characters).");
      return;
    }

    setDisputeSubmitting(true);
    try {
      await openDisputeFn({
        data: {
          bookingId: id,
          reason: disputeReason,
        },
      });
      await loadDispute();
      setShowDisputeForm(false);
      setDisputeReason("");
      alert("Dispute opened successfully. Our team will review it within 2 business days.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to open dispute");
    } finally {
      setDisputeSubmitting(false);
    }
  }

  async function advance() {
    if (!booking) return;
    const i = STATUS_FLOW.indexOf(booking.status);
    if (i < 0 || i === STATUS_FLOW.length - 1) return;
    const { status } = await advanceBooking(booking.id);
    setBooking({ ...booking, status });
  }

  async function rate(n: number) {
    if (!booking) return;
    try {
      await rateBooking(booking.id, n);
      setBooking({ ...booking, rating: n });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Rating failed.");
    }
  }

  function downloadInvoice() {
    if (!booking || typeof window === "undefined") return;
    const svc = findService(booking.serviceId);
    const sub = findSub(booking.serviceId, booking.subId);
    const lines = [
      "DayStart Pvt. Ltd. — Tax Invoice",
      "Visakhapatnam, Andhra Pradesh · info@daystart.co.in · +91 90320 78142",
      "",
      `Invoice for booking: ${booking.id}`,
      `Date: ${new Date(booking.createdAt).toLocaleString("en-IN")}`,
      `Service: ${svc?.name} — ${sub?.name}`,
      `Workers: ${booking.workers}`,
      `Address: ${booking.address.line1}, ${booking.area}, ${booking.city}`,
      "",
      `Service charges: ${inr(booking.payment.base)}`,
      `Platform fee: ${inr(booking.payment.platformFee)}`,
      `GST (5%): ${inr(booking.payment.taxes)}`,
      `Total: ${inr(booking.payment.total)}`,
      `Advance paid (30%): ${inr(booking.payment.advance)}`,
      `Balance due (70%): ${inr(booking.payment.remaining)}`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${booking.id}-invoice.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!loaded) {
    return (
      <div className="container-page section">
        <div className="skeleton h-8 w-52 rounded-full" />
        <div className="skeleton mt-6 h-72 w-full rounded-3xl" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container-page section text-center">
        <h1 className="text-2xl font-semibold">Booking not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This booking ID doesn't exist on this device.
        </p>
        <Link to="/bookings" className="btn-primary mt-6 h-11">
          Back to my bookings
        </Link>
      </div>
    );
  }

  const svc = findService(booking.serviceId);
  const sub = findSub(booking.serviceId, booking.subId);
  const meta = STATUS_META[booking.status];
  const currentIndex = STATUS_FLOW.indexOf(booking.status);

  return (
    <div className="container-page section">
      <Link
        to="/bookings"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> My bookings
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow">Booking {booking.id}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {svc?.name} · {sub?.name}
          </h1>
          <span className={`${meta.badge} mt-3`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
        </div>
        <button
          type="button"
          onClick={downloadInvoice}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
        >
          <Download className="h-4 w-4" /> Invoice
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Status timeline">
            <ol className="relative space-y-5 pl-6">
              <span
                className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-border"
                aria-hidden="true"
              />
              {STATUS_FLOW.map((s, i) => {
                const done = i <= currentIndex;
                const m = STATUS_META[s];
                return (
                  <li key={s} className="relative">
                    <span
                      className={`absolute -left-6 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background ${
                        done ? m.dot : "bg-muted"
                      }`}
                    >
                      {done && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <p className={`text-sm font-semibold ${done ? "" : "text-muted-foreground"}`}>
                      {m.label}
                    </p>
                    {i === currentIndex && booking.status !== "completed" && (
                      <button type="button" onClick={advance} className="chip mt-2">
                        Simulate next update
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title="Worker information">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <UserRound className="h-7 w-7 text-brand-red" />
              </span>
              <div>
                <p className="font-semibold">{booking.worker.name}</p>
                <p className="text-sm text-muted-foreground">
                  ★ {booking.worker.rating} · {booking.worker.jobs} jobs completed · Verified
                  DayStart employee
                </p>
                <a
                  href={`tel:+919032078142`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" /> +91 90320 78142
                </a>
              </div>
            </div>
          </Card>

          <Card title="Location">
            <p className="text-sm">
              {booking.address.label} · {booking.address.line1}
            </p>
            <p className="text-sm text-muted-foreground">
              {booking.address.landmark && `${booking.address.landmark} · `}
              {booking.area}, {booking.city}
            </p>
            {booking.address.instructions && (
              <p className="mt-2 text-sm text-muted-foreground">
                Note: {booking.address.instructions}
              </p>
            )}
            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-brand-red" />
                {booking.address.coords
                  ? `${booking.address.coords.lat.toFixed(4)}, ${booking.address.coords.lng.toFixed(4)}`
                  : "Pin set from selected area"}
              </div>
              <div className="bg-radial-glow h-40 w-full" aria-hidden="true" />
            </div>
          </Card>

          <Card title="Rate your experience">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => rate(n)}
                  aria-label={`Rate ${n} stars`}
                >
                  <Star
                    className={`h-7 w-7 ${(booking.rating ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
            {booking.rating && (
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks for rating {booking.rating}/5.
              </p>
            )}
          </Card>

          <Card title="Work evidence">
            <p className="text-sm text-muted-foreground">
              Upload photos before, during, or after the work for documentation.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">
                <Camera className="h-4 w-4" />
                Before
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "before")}
                  disabled={uploading}
                />
              </label>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">
                <Camera className="h-4 w-4" />
                During
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "during")}
                  disabled={uploading}
                />
              </label>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">
                <Camera className="h-4 w-4" />
                After
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "after")}
                  disabled={uploading}
                />
              </label>
            </div>

            {uploading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading photo...
              </div>
            )}

            {uploadError && (
              <p className="mt-2 text-sm font-medium text-brand-red">{uploadError}</p>
            )}

            {evidence.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {evidence.map((evid) => (
                  <div
                    key={evid.id}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={evid.file_url || ""}
                      alt={`Evidence: ${evid.evidence_type}`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white capitalize">
                      {evid.evidence_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Report a problem">
            {dispute ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">Dispute under review</p>
                    <p className="mt-1 text-sm text-amber-700">
                      Your dispute was opened on {new Date(dispute.created_at).toLocaleDateString()}
                      . Our team will review it within 2 business days.
                    </p>
                    <p className="mt-2 text-sm text-amber-600">Reason: {dispute.reason}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  If you have any issues with this booking, you can open a dispute. Worker earnings
                  will be held until resolved.
                </p>

                {!showDisputeForm ? (
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(true)}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-brand-red px-4 text-sm font-semibold text-brand-red hover:bg-brand-red/10"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Open a dispute
                  </button>
                ) : (
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold">
                        Describe the problem
                      </span>
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Please describe the issue in detail (minimum 10 characters)..."
                        rows={4}
                        className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleOpenDispute}
                        disabled={disputeSubmitting}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-red px-4 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {disputeSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Submit dispute
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDisputeForm(false);
                          setDisputeReason("");
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Payment">
            <Row label="Service charges" value={inr(booking.payment.base)} />
            <Row label="Platform fee" value={inr(booking.payment.platformFee)} />
            <Row label="GST (5%)" value={inr(booking.payment.taxes)} />
            <div className="mt-3 border-t border-border pt-3">
              <Row label="Total" value={inr(booking.payment.total)} bold />
              <Row label="Advance paid" value={inr(booking.payment.advance)} />
              <Row label="Balance due" value={inr(booking.payment.remaining)} />
            </div>
            <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
              Paid via {booking.payment.method}
            </p>
          </Card>

          <Card title="Support">
            <p className="text-sm text-muted-foreground">
              Need help with this booking? Our team responds within 2 working hours.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="tel:+919032078142"
                  className="inline-flex items-center gap-2 font-semibold hover:text-brand-red"
                >
                  <Phone className="h-4 w-4 text-brand-red" /> +91 90320 78142
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@daystart.co.in"
                  className="inline-flex items-center gap-2 font-semibold hover:text-brand-red"
                >
                  <Mail className="h-4 w-4 text-brand-red" /> info@daystart.co.in
                </a>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 font-semibold hover:text-brand-red"
                >
                  <LifeBuoy className="h-4 w-4 text-brand-red" /> Help &amp; support
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-elevated p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-1 text-sm ${bold ? "font-semibold" : ""}`}
    >
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

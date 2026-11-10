import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/coming-soon")({
  head: () => ({
    meta: [
      { title: "Coming Soon — DayStart" },
      {
        name: "description",
        content: "This page is under development. Check back soon for updates.",
      },
    ],
  }),
  component: ComingSoonPage,
});

function ComingSoonPage() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center border-b border-border bg-brand-cream">
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <Clock className="mx-auto h-16 w-16 text-brand-red" />
        <h1 className="mt-6 text-4xl font-bold sm:text-5xl">Coming Soon</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          This page is under development. We're working hard to bring you this feature.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          In the meantime, feel free to explore our other pages or contact us for any questions.
        </p>
      </div>
    </section>
  );
}

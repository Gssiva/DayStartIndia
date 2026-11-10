import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/for-workers")({
  beforeLoad: () => {
    throw redirect({ to: "/about" });
  },
  component: () => null,
});

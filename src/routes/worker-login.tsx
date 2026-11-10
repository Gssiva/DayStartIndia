import { createFileRoute, redirect } from "@tanstack/react-router";

// Workers no longer have a portal; old links go to the customer login.
export const Route = createFileRoute("/worker-login")({
  beforeLoad: () => {
    throw redirect({ to: "/login", search: { redirect: undefined } });
  },
  component: () => null,
});

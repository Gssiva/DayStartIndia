import { createFileRoute, redirect } from "@tanstack/react-router";

// Worker registration was removed; old links go to customer sign-up.
export const Route = createFileRoute("/register-worker")({
  beforeLoad: () => {
    throw redirect({ to: "/register", search: { redirect: undefined } });
  },
  component: () => null,
});

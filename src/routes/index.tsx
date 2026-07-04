import { createFileRoute, redirect } from "@tanstack/react-router";

// Route entry — the auth gate redirects to /auth if unsigned, otherwise
// the library route (_authenticated/index) renders.
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Client-side session check happens on _authenticated; index route just
    // redirects to /library which is under _authenticated.
    throw redirect({ to: "/library" });
  },
});

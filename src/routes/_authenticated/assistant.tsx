import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Study Assistant — Scholar" },
      { name: "description", content: "Chat with your AI tutor about any topic." },
    ],
  }),
  component: () => <Outlet />,
});

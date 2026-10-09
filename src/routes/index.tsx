import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MULIKA — Staff console" },
      { name: "description", content: "MULIKA staff console for managing financed phones, customers and payments." },
      { property: "og:title", content: "MULIKA — Staff console" },
      { property: "og:description", content: "Manage financed phones, customers and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});

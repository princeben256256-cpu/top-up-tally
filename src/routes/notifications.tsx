import { createFileRoute } from "@tanstack/react-router";
import { MoreVertical } from "lucide-react";
import { AppShell, AppHeader } from "../components/AppShell";
import { account, notifications } from "../lib/billing";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — PrepaidPay" },
      { name: "description", content: "Payment reminders and account alerts for your prepaid phone plan." },
      { property: "og:title", content: "Notifications — PrepaidPay" },
      { property: "og:description", content: "Payment reminders and account alerts for your prepaid phone plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  return (
    <AppShell>
      <AppHeader title="Notifications" right={<MoreVertical className="h-5 w-5" />} />

      <ul className="divide-y divide-border">
        {notifications.map((n) => (
          <li key={n.id} className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-foreground truncate">{n.title}</h2>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{n.date}</span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground leading-snug">{n.body}</p>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-center text-[11px] text-muted-foreground">
        {account.brand} ver. {account.version}, user: {account.user}
      </p>
    </AppShell>
  );
}

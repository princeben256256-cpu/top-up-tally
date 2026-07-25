import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { account, formatUGX } from "../lib/billing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrepaidPay — Manage your phone plan" },
      { name: "description", content: "Track balance, due dates and pay your prepaid phone bill in seconds." },
      { property: "og:title", content: "PrepaidPay — Manage your phone plan" },
      { property: "og:description", content: "Track balance, due dates and pay your prepaid phone bill in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const pct = Math.round((account.totalPaid / account.total) * 100);
  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pt-6 pb-5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold tracking-tight">{account.brand}</span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand rotate-45" />
        </div>
        <button className="text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-5 w-5" />
        </button>
      </header>

      <section className="mx-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground text-center">
          Good job! You have no outstanding payments.
        </p>

        <div className="mt-5">
          <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-[color:var(--progress)] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-between text-xs">
          <div>
            <div className="text-muted-foreground">TOTAL PAID</div>
            <div className="mt-1 font-medium">{formatUGX(account.totalPaid)}</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">TOTAL BALANCE</div>
            <div className="mt-1 font-medium">{formatUGX(account.totalBalance)}</div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border px-4 py-3 flex items-center gap-2 text-sm">
          <span className="inline-block h-4 w-4 rounded-sm border border-muted-foreground" />
          <span className="text-muted-foreground">Next due date</span>
          <span className="ml-auto font-medium">{account.nextPaymentDue}</span>
        </div>

        <Link
          to="/payments"
          className="mt-5 block text-center rounded-full bg-brand text-brand-foreground font-semibold tracking-wide py-3.5 shadow-sm active:scale-[0.99] transition"
        >
          PAY NOW
        </Link>
      </section>

      <p className="mt-10 text-center text-[11px] text-muted-foreground">
        {account.brand} ver. {account.version}, user: {account.user}
      </p>
    </AppShell>
  );
}

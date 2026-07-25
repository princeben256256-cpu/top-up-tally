import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, AppHeader } from "../components/AppShell";
import { account, formatUGX } from "../lib/billing";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Payments — PrepaidPay" },
      { name: "description", content: "Choose a payment option or enter a custom amount to top up your prepaid plan." },
      { property: "og:title", content: "Payments — PrepaidPay" },
      { property: "og:description", content: "Choose a payment option or enter a custom amount to top up your prepaid plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Payments,
});

const OPTIONS = [
  { key: "1d", label: "1 day", amount: 2800 },
  { key: "1w", label: "1 week", amount: 20468 },
  { key: "1m", label: "1 month", amount: 82000 },
  { key: "full", label: "Full", amount: account.totalBalance },
] as const;

function Payments() {
  const [selected, setSelected] = useState<(typeof OPTIONS)[number]["key"]>("1w");
  const [amount, setAmount] = useState<string>(String(OPTIONS[1].amount));

  const numericAmount = useMemo(() => Number(amount.replace(/[^0-9]/g, "")) || 0, [amount]);

  const rows: Array<[string, string]> = [
    ["Issued date", account.issuedDate],
    ["Final due date", account.finalDueDate],
    ["Next payment due", account.nextPaymentDue],
    ["Days past due", String(account.daysPastDue)],
    ["Total past due", formatUGX(account.totalPastDue)],
    ["Total paid", formatUGX(account.totalPaid)],
    ["Total", formatUGX(account.total)],
  ];

  return (
    <AppShell>
      <AppHeader title="Payments" />

      <section className="px-5 pt-5">
        <dl className="divide-y divide-border/60 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 flex items-center gap-3 px-5">
        <div className="h-px flex-1 bg-border" />
        <p className="text-xs text-muted-foreground">Choose a payment option or enter amount</p>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="mt-4 px-5 flex gap-2 justify-center flex-wrap">
        {OPTIONS.map((o) => {
          const active = selected === o.key;
          return (
            <button
              key={o.key}
              onClick={() => {
                setSelected(o.key);
                setAmount(String(o.amount));
              }}
              className={`px-4 py-1.5 rounded-full text-sm border transition ${
                active
                  ? "bg-brand-soft border-brand/40 text-foreground"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Unlocked till: <span className="text-foreground">{account.unlockedTill}</span>
      </p>

      <div className="mt-4 px-5">
        <div className="relative rounded-full border border-border bg-card px-4 pt-3.5 pb-2">
          <label className="absolute -top-2 left-5 bg-card px-1 text-[11px] text-muted-foreground">
            Enter amount
          </label>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full bg-transparent outline-none text-base"
          />
        </div>
      </div>

      <div className="mt-6 px-5">
        <button className="w-full rounded-full bg-brand text-brand-foreground font-semibold tracking-wider py-4 shadow-sm active:scale-[0.99] transition">
          PAY {formatUGX(numericAmount)}
        </button>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        {account.brand} ver. {account.version}, user: {account.user}
      </p>
    </AppShell>
  );
}

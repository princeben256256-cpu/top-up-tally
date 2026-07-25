import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Lock, ShieldCheck } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { lookupDevice } from "../lib/devices.functions";
import { formatDate, formatMoney, daysRemaining } from "../lib/lock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrepaidPay — Check your phone payment plan" },
      {
        name: "description",
        content:
          "Enter your IMEI or phone number to see your balance, next due date and whether your device is unlocked.",
      },
      { property: "og:title", content: "PrepaidPay — Check your phone payment plan" },
      {
        property: "og:description",
        content: "Check your device balance, due date and lock status in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const lookup = useServerFn(lookupDevice);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "empty" | "found">("idle");
  const [device, setDevice] = useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const result = await lookup({ data: { query } });
      if (!result) {
        setDevice(null);
        setState("empty");
      } else {
        setDevice(result);
        setState("found");
      }
    } catch {
      setState("empty");
    }
  }

  return (
    <AppShell>
      <header className="px-5 pt-8 pb-5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold tracking-tight">PrepaidPay</span>
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-sm bg-brand" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold leading-tight">
          Check your device payment plan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the IMEI or the phone number your device was registered with.
        </p>
      </header>

      <form onSubmit={onSubmit} className="px-5">
        <div className="flex items-center gap-2 rounded-full border border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="IMEI or phone number"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          className="mt-3 w-full rounded-full bg-brand py-3.5 font-semibold tracking-wide text-brand-foreground transition active:scale-[0.99]"
        >
          {state === "loading" ? "CHECKING…" : "CHECK STATUS"}
        </button>
      </form>

      {state === "empty" && (
        <p className="mt-6 px-5 text-center text-sm text-muted-foreground">
          No device found for that IMEI or phone number.
        </p>
      )}

      {state === "found" && device && (
        <section className="mx-5 mt-6 rounded-2xl border border-border p-5">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
              device.locked
                ? "bg-destructive/10 text-destructive"
                : "bg-brand-soft text-foreground"
            }`}
          >
            {device.locked ? <Lock className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {device.locked ? "Device locked" : "Device unlocked"}
          </div>

          <h2 className="mt-3 text-lg font-semibold">{device.customer_name}</h2>
          <p className="text-xs text-muted-foreground">
            {device.device_model || "Device"} · IMEI {device.imei}
          </p>

          <dl className="mt-4 divide-y divide-border/60 text-sm">
            <Row k="Outstanding balance" v={formatMoney(device.balance)} />
            <Row k="Total paid" v={formatMoney(device.amount_paid)} />
            <Row k="Daily rate" v={formatMoney(device.daily_rate)} />
            <Row k="Unlocked until" v={formatDate(device.paid_until)} />
            <Row
              k="Days remaining"
              v={String(Math.max(0, daysRemaining(device.paid_until)))}
            />
          </dl>

          <p className="mt-4 text-xs text-muted-foreground">
            {device.lock_message ||
              (device.locked
                ? "Make a payment at any agent to restore access to your phone."
                : "Keep paying on time to keep your phone unlocked.")}
          </p>
        </section>
      )}
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

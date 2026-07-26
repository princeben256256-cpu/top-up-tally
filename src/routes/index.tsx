import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { lookupDevice } from "../lib/devices.functions";
import { startMobileMoneyPayment, checkMobileMoneyPayment } from "../lib/payments.functions";
import { formatDate, formatMoney, daysRemaining } from "../lib/lock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrepaidPay — Check your phone payment plan" },
      {
        name: "description",
        content:
          "Enter your IMEI or phone number to see your balance, next due date and pay by mobile money to unlock your device.",
      },
      { property: "og:title", content: "PrepaidPay — Check your phone payment plan" },
      {
        property: "og:description",
        content: "Check your balance, next due date and pay by mobile money to keep your phone unlocked.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const lookup = useServerFn(lookupDevice);
  const startPay = useServerFn(startMobileMoneyPayment);
  const checkPay = useServerFn(checkMobileMoneyPayment);

  const [query, setQuery] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "empty" | "found">("idle");
  const [device, setDevice] = useState<any>(null);

  const [amount, setAmount] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [pending, setPending] = useState<null | { external_id: string }>(null);
  const [payStatus, setPayStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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
        setPayPhone(result.phone_number ?? "");
        setAmount(String(Math.min(Number(result.balance) || 0, Number(result.daily_rate) * 7)));
        setState("found");
      }
    } catch {
      setState("empty");
    }
  }

  async function refresh(deviceId: string) {
    const fresh = await lookup({ data: { query: device?.imei ?? query } });
    if (fresh) setDevice(fresh);
    void deviceId;
  }

  function startPolling(externalId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks += 1;
      try {
        const r: any = await checkPay({ data: { external_id: externalId } });
        if (r?.status === "successful") {
          clearInterval(pollRef.current!);
          setPending(null);
          setPayStatus("Payment received — your device is being unlocked.");
          toast.success("Payment received");
          await refresh(device.id);
        } else if (r?.status === "failed") {
          clearInterval(pollRef.current!);
          setPending(null);
          setPayStatus(r?.message || "Payment failed or was cancelled.");
        }
      } catch {
        /* keep polling */
      }
      if (ticks > 40) {
        clearInterval(pollRef.current!);
        setPending(null);
        setPayStatus("Still waiting for confirmation. Refresh in a moment.");
      }
    }, 4000);
  }

  async function onPay(e: React.FormEvent) {
    e.preventDefault();
    if (!device) return;
    setPayStatus(null);
    try {
      const r: any = await startPay({
        data: { device_id: device.id, amount: Number(amount), phone: payPhone },
      });
      if (r.status === "successful") {
        setPayStatus("Payment received — your device is being unlocked.");
        await refresh(device.id);
        return;
      }
      if (r.status === "failed") {
        setPayStatus(r.message || "Payment request failed.");
        return;
      }
      setPending({ external_id: r.external_id });
      setPayStatus("Check your phone and approve the mobile money prompt.");
      startPolling(r.external_id);
    } catch (err) {
      setPayStatus((err as Error).message);
    }
  }

  const presets = device
    ? [
        { label: "1 day", value: Number(device.daily_rate) },
        { label: "1 week", value: Number(device.daily_rate) * 7 },
        { label: "1 month", value: Number(device.daily_rate) * 30 },
        { label: "Full", value: Number(device.balance) },
      ].filter((p) => p.value > 0)
    : [];

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
        <>
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
                  ? "Make a payment to restore access to your phone."
                  : "Keep paying on time to keep your phone unlocked.")}
            </p>
          </section>

          <section className="mx-5 mt-4 rounded-2xl border border-border p-5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Smartphone className="h-4 w-4" /> Pay with mobile money
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setAmount(String(Math.round(p.value)))}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    Number(amount) === Math.round(p.value)
                      ? "border-brand bg-brand-soft"
                      : "border-border"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <form onSubmit={onPay} className="mt-3 space-y-2">
              <input
                type="tel"
                required
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                placeholder="Mobile money number e.g. 0770123456"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none"
              />
              <input
                type="number"
                min={500}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (UGX)"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!!pending}
                className="w-full rounded-full bg-brand py-3.5 font-semibold tracking-wide text-brand-foreground disabled:opacity-60"
              >
                {pending ? "WAITING FOR APPROVAL…" : `PAY ${formatMoney(Number(amount) || 0)}`}
              </button>
            </form>

            {payStatus && <p className="mt-3 text-xs text-muted-foreground">{payStatus}</p>}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Payments are processed by iotec Pay. Days are added automatically once approved.
            </p>
          </section>
        </>
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

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Lock, ShieldCheck, Smartphone, Wallet, CalendarDays, BadgeDollarSign } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { lookupDevice } from "../lib/devices.functions";
import { startMobileMoneyPayment, checkMobileMoneyPayment } from "../lib/payments.functions";
import { formatDate, formatMoney, daysRemaining } from "../lib/lock";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "My Device — PrepaidPay customer console" },
      {
        name: "description",
        content:
          "Enter your IMEI or phone number to see your balance, next due date and pay by mobile money to unlock your device.",
      },
      { property: "og:title", content: "My Device — PrepaidPay customer console" },
      {
        property: "og:description",
        content: "Check your balance, next due date and pay by mobile money to keep your phone unlocked.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerConsole,
});

const LAST_QUERY = "prepaidpay:last-query";

function CustomerConsole() {
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

  const total = Number(device?.total_price) || 0;
  const paid = Number(device?.amount_paid) || 0;
  const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <AppShell>
      <section className="px-5 pt-6 pb-2">
        <h1 className="font-display text-2xl font-semibold leading-tight">
          Check your device payment plan
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter the IMEI or the phone number your device was registered with.
        </p>
      </section>

      <form onSubmit={onSubmit} className="px-5 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3.5 focus-within:border-ring">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="IMEI or phone number"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          className="mt-3 w-full rounded-xl bg-navy py-3.5 font-display text-sm font-semibold tracking-wide text-white transition active:scale-[0.99]"
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
          <section className="mx-5 mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <div className={`px-5 py-4 ${device.locked ? "bg-destructive" : "bg-navy"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  {device.locked ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  <span className="font-display text-sm font-semibold">
                    {device.locked ? "Device locked" : "Device unlocked"}
                  </span>
                </div>
                {!device.locked && (
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white">
                    {Math.max(0, daysRemaining(device.paid_until))} days left
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold text-white">{device.customer_name}</h2>
              <p className="text-xs text-white/70">
                {device.device_model || "Device"} · IMEI {device.imei}
              </p>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Payoff progress</span>
                <span className="font-display text-sm font-semibold">{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <MiniStat icon={<BadgeDollarSign className="h-3.5 w-3.5" />} label="Balance" value={formatMoney(device.balance)} />
                <MiniStat icon={<Wallet className="h-3.5 w-3.5" />} label="Total paid" value={formatMoney(device.amount_paid)} />
                <MiniStat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Paid until" value={formatDate(device.paid_until)} />
              </div>

              <p className="mt-4 rounded-lg bg-secondary px-3 py-2.5 text-xs text-secondary-foreground">
                {device.lock_message ||
                  (device.locked
                    ? "Make a payment to restore access to your phone."
                    : "Keep paying on time to keep your phone unlocked.")}
              </p>
            </div>
          </section>

          <section className="mx-5 mt-4 rounded-2xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold">
              <Smartphone className="h-4 w-4 text-brand" /> Pay with mobile money
            </h3>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setAmount(String(Math.round(p.value)))}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                    Number(amount) === Math.round(p.value)
                      ? "border-brand bg-brand-soft text-navy"
                      : "border-border text-muted-foreground"
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
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
              />
              <input
                type="number"
                min={500}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (UGX)"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
              />
              <button
                type="submit"
                disabled={!!pending}
                className="w-full rounded-xl bg-brand py-3.5 font-display text-sm font-semibold tracking-wide text-brand-foreground disabled:opacity-60"
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

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 truncate font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

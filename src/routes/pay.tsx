import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Lock, ShieldCheck, Smartphone, Wallet, CalendarDays, BadgeDollarSign, RefreshCw } from "lucide-react";
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
  const [state, setState] = useState<"idle" | "loading" | "empty" | "instock" | "error" | "found">("idle");
  const [device, setDevice] = useState<any>(null);

  const [amount, setAmount] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [pending, setPending] = useState<null | { external_id: string }>(null);
  const [payStatus, setPayStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function load(q: string) {
    const clean = q.replace(/\s+/g, "");
    if (clean.length < 6) {
      setState("empty");
      return;
    }
    setState("loading");
    try {
      const result: any = await lookup({ data: { query: clean } });
      if (!result) {
        setDevice(null);
        setState("empty");
      } else if (result.in_stock) {
        setDevice(null);
        setState("instock");
      } else {
        setDevice(result);
        window.localStorage.setItem(LAST_QUERY, result.imei ?? clean);
        setPayPhone(result.phone_number ?? "");
        setAmount(String(Math.min(Number(result.balance) || 0, Number(result.daily_rate) || 0)));
        setState("found");
      }
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    const fromApp = new URLSearchParams(window.location.search).get("imei");
    const saved = fromApp || window.localStorage.getItem(LAST_QUERY);
    if (saved) {
      setQuery(saved);
      void load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await load(query);
  }

  async function refresh(deviceId: string) {
    try {
      const fresh: any = await lookup({ data: { query: device?.imei ?? query } });
      if (fresh && !fresh.in_stock) setDevice(fresh);
      setLastChecked(new Date());
    } catch {
      /* ignore */
    }
    void deviceId;
  }

  // Automatic check every 20 seconds while the page is open.
  useEffect(() => {
    if (state !== "found" || !device?.imei) return;
    const t = setInterval(() => void refresh(device.id), 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, device?.imei]);

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
  const overdueDays = device
    ? Math.max(0, Math.ceil((Date.now() - new Date(device.paid_until).getTime()) / 86400000))
    : 0;

  return (
    <AppShell>
      {state === "found" && device ? (
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="text-xs text-muted-foreground">
            {lastChecked ? `Updated ${lastChecked.toLocaleTimeString()}` : "My phone"}
          </span>
          <button
            type="button"
            onClick={async () => {
              setRefreshing(true);
              await refresh(device.id);
              setRefreshing(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Checking…" : "Refresh"}
          </button>
        </div>
      ) : (<>
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
      </>)}

      {state === "empty" && (
        <Notice
          title="We couldn't find that phone"
          body="Check the number and try again. Use IMEI 1 (dial *#06#) or the phone number the shop registered for you, with no spaces."
        />
      )}
      {state === "instock" && (
        <Notice
          title="This phone hasn't been given to a customer yet"
          body="The shop still needs to add your name and phone number to this device. Please ask the agent who sold you the phone."
        />
      )}
      {state === "error" && (
        <Notice
          title="Something went wrong"
          body="We couldn't check right now. Check your internet and tap CHECK STATUS again."
        />
      )}

      {state === "idle" && (
        <section className="mx-5 mt-6 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-sm font-semibold">How it works</h3>
          <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
            {[
              "Type your phone's IMEI (dial *#06#) or your registered number.",
              "See your balance, days left and payment history.",
              "Pay 1 day, 1 week, 1 month or the full balance with mobile money.",
              "Your phone unlocks by itself within a few minutes.",
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-xs font-semibold text-navy">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
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
                  <LockCountdown paidUntil={device.paid_until} paidOff={device.balance <= 0} />
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

              {overdueDays > 0 && Number(device.balance) > 0 && (
                <div className="mt-4 rounded-xl border border-destructive bg-destructive/10 p-3">
                  <p className="font-display text-sm font-semibold text-destructive">
                    {overdueDays} {overdueDays === 1 ? "day" : "days"} not paid
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pay {formatMoney(Math.min(overdueDays * Number(device.daily_rate), Number(device.balance)))} to clear the missed days.
                  </p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                <MiniStat icon={<BadgeDollarSign className="h-3.5 w-3.5" />} label="Balance" value={formatMoney(device.balance)} />
                <MiniStat icon={<Wallet className="h-3.5 w-3.5" />} label="Total paid" value={formatMoney(device.amount_paid)} />
                <MiniStat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Paid until" value={formatDate(device.paid_until)} />
                <MiniStat icon={<BadgeDollarSign className="h-3.5 w-3.5" />} label="Phone price" value={formatMoney(device.total_price)} />
                <MiniStat icon={<Wallet className="h-3.5 w-3.5" />} label="Deposit" value={formatMoney(device.deposit_paid)} />
                <MiniStat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Per day" value={formatMoney(device.daily_rate)} />
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
      <p className="mt-1 break-words font-display text-[13px] font-semibold leading-tight">{value}</p>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-5 mt-6 rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </section>
  );
}

function LockCountdown({ paidUntil, paidOff }: { paidUntil: string; paidOff: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  let text = "Fully paid";
  if (!paidOff) {
    const mins = Math.max(0, Math.floor((new Date(paidUntil).getTime() - now) / 60_000));
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    text = `Locks in ${d > 0 ? `${d}d ` : ""}${h}h ${m}m`;
  }
  return (
    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white">
      {text}
    </span>
  );
}

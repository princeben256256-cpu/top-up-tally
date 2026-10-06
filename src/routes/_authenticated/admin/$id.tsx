import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, Unlock, RotateCcw, Smartphone, Trash2, QrCode, Banknote, Send } from "lucide-react";
import { toast } from "sonner";
import { getDevice, recordPayment, setLock, getMyRole, deleteDevice, assignCustomer, getAgentSettings } from "@/lib/devices.functions";
import { QRCodeSVG } from "qrcode.react";
import { getCustomerKyc } from "@/lib/kyc.functions";
import { requestPaymentFromCustomer } from "@/lib/payments.functions";
import { balanceOf, daysRemaining, formatDate, formatMoney, isLocked } from "@/lib/lock";


export const Route = createFileRoute("/_authenticated/admin/$id")({
  head: () => ({
    meta: [
      { title: "Device details — PrepaidPay staff console" },
      { name: "description", content: "View a financed device, record payments and lock or unlock it remotely." },
      { property: "og:title", content: "Device details — PrepaidPay" },
      { property: "og:description", content: "View a financed device, record payments and lock or unlock it remotely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeviceDetail,
});

function DeviceDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchDevice = useServerFn(getDevice);
  const pay = useServerFn(recordPayment);
  const lock = useServerFn(setLock);
  const roleFn = useServerFn(getMyRole);
  const removeDevice = useServerFn(deleteDevice);
  const requestPay = useServerFn(requestPaymentFromCustomer);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mobile_money");
  const [promptAmount, setPromptAmount] = useState("");
  const [promptPhone, setPromptPhone] = useState("");

  const { data: roleData } = useQuery({ queryKey: ["my-role"], queryFn: () => roleFn({}) });
  const isAdmin = roleData?.role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["device", id],
    queryFn: () => fetchDevice({ data: { id } }),
  });

  const promptMutation = useMutation({
    mutationFn: () =>
      requestPay({
        data: {
          device_id: id,
          amount: Number(promptAmount),
          phone: promptPhone || (data as any)?.device?.phone_number || "",
        },
      }),
    onSuccess: (r: any) => {
      toast.success(
        r.status === "successful"
          ? "Payment received"
          : "Prompt sent — ask the customer to approve it",
      );
      setPromptAmount("");
      qc.invalidateQueries({ queryKey: ["device", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeDevice({ data: { id } }),
    onSuccess: () => {
      toast.success("Device deleted");
      qc.invalidateQueries({ queryKey: ["devices"] });
      navigate({ to: "/admin" });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const payMutation = useMutation({
    mutationFn: () =>
      pay({ data: { device_id: id, amount: Number(amount), method: method as any } }),
    onSuccess: (r: any) => {
      toast.success(`Payment recorded · +${r.days_added} days`);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["device", id] });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lockMutation = useMutation({
    mutationFn: (mode: "auto" | "locked" | "unlocked") =>
      lock({ data: { device_id: id, lock_override: mode } }),
    onSuccess: () => {
      toast.success("Lock state updated");
      qc.invalidateQueries({ queryKey: ["device", id] });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  const d: any = data.device;
  const locked = isLocked(d);
  const total = Number(d.total_price) || 0;
  const paid = Number(d.amount_paid) || 0;
  const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className={`${locked ? "bg-destructive" : "bg-navy-deep"} text-white`}>
        <div className="mx-auto w-full max-w-3xl px-5 py-5">
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> All devices
          </Link>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-semibold">
                {d.customer_name || "In stock — no customer yet"}
              </h1>
              <p className="mt-0.5 truncate text-xs text-white/70">
                {d.phone_number ? `${d.phone_number} · ` : ""}{d.device_model || "Unknown model"} · IMEI {d.imei}{d.imei2 ? ` / ${d.imei2}` : ""}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${locked ? "bg-white/15 text-white" : "bg-white/15 text-white"}`}>
              {locked ? "LOCKED" : `UNLOCKED · ${Math.max(0, daysRemaining(d.paid_until))}d`}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between text-xs text-white/70">
              <span>Payoff progress</span>
              <span className="font-display font-semibold text-white">{progress}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-6">
        {!d.customer_name && (
          <Link to="/admin/register/$id" params={{ id }} className="mb-4 block rounded-xl border-2 border-brand/40 bg-card p-4 text-center">
            <p className="font-display text-sm font-semibold">Sell this phone — register customer</p>
            <p className="mt-1 text-xs text-muted-foreground">Photos, National ID scans, guarantor and signature</p>
          </Link>
        )}
        {d.customer_name && <KycPanel id={id} />}

        <div className="grid gap-2 grid-cols-3">
          <Stat label="Balance" value={formatMoney(balanceOf(d))} />
          <Stat label="Paid" value={formatMoney(d.amount_paid)} />
          <Stat label="Daily rate" value={formatMoney(d.daily_rate)} />
        </div>

        <div className="mt-3 rounded-xl border border-border bg-card p-4 text-sm">
          <Row k="Total price" v={formatMoney(d.total_price)} />
          <Row k="Paid until" v={formatDate(d.paid_until)} />
          <Row k="Lock mode" v={d.lock_override} />
          <Row k="Enrolled" v={d.enrolled_at ? formatDate(d.enrolled_at) : "Not yet enrolled"} />
          <Row k="Last seen" v={d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never"} />
        </div>

        {isAdmin ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={() => lockMutation.mutate("locked")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold"
            >
              <Lock className="h-3.5 w-3.5" /> Force lock
            </button>
            <button
              onClick={() => lockMutation.mutate("unlocked")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold"
            >
              <Unlock className="h-3.5 w-3.5" /> Force unlock
            </button>
            <button
              onClick={() => lockMutation.mutate("auto")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Automatic
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this device and its payment history?")) deleteMutation.mutate();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-card px-3 py-2.5 text-xs font-semibold text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Lock controls and device deletion are limited to admins.
          </p>
        )}

        <section className="mt-5 rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold">
            <Send className="h-4 w-4 text-brand" /> Request mobile money payment
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sends an iotec prompt to the customer's phone. Days are added automatically on approval.
          </p>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              promptMutation.mutate();
            }}
          >
            <input
              type="tel"
              value={promptPhone}
              onChange={(e) => setPromptPhone(e.target.value)}
              placeholder={d.phone_number || "Customer phone"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <input
              type="number"
              min={500}
              required
              value={promptAmount}
              onChange={(e) => setPromptAmount(e.target.value)}
              placeholder="Amount"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={promptMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {promptMutation.isPending ? "Sending…" : "Send prompt"}
            </button>
          </form>
        </section>


        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold">
            <Banknote className="h-4 w-4 text-brand" /> Record a payment
          </h2>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              payMutation.mutate();
            }}
          >
            <input
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="mobile_money">Mobile money</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
            </select>
            <button
              type="submit"
              disabled={payMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Record
            </button>
          </form>
        </section>

        <SetupQr device={d} />

        <section className="mt-5">
          <h2 className="font-display text-sm font-semibold">Payment history</h2>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {data.payments.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">No payments yet.</li>
            )}
            {data.payments.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-display font-semibold">{formatMoney(p.amount)}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {p.method.replace("_", " ")} · +{p.days_added} days
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-base font-semibold">{value}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function AssignCustomer({ id }: { id: string }) {
  const fn = useServerFn(assignCustomer);
  const qc = useQueryClient();
  const [f, setF] = useState({ customer_name: "", phone_number: "", deposit_paid: "" });
  const m = useMutation({
    mutationFn: () => fn({ data: { device_id: id, ...f, deposit_paid: Number(f.deposit_paid || 0) } }),
    onSuccess: (r: any) => {
      toast.success(`Customer added · ${r.days_added} days unlocked`);
      qc.invalidateQueries({ queryKey: ["device", id] });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="mb-4 grid gap-2 rounded-xl border-2 border-brand/40 bg-card p-4 sm:grid-cols-3"
    >
      <p className="font-display text-sm font-semibold sm:col-span-3">Sell this phone to a customer</p>
      <input required placeholder="Customer name" value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
      <input required type="tel" placeholder="Customer phone" value={f.phone_number} onChange={(e) => setF({ ...f, phone_number: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
      <input type="number" min={0} placeholder="Deposit paid" value={f.deposit_paid} onChange={(e) => setF({ ...f, deposit_paid: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
      <button disabled={m.isPending} className="rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-3">
        {m.isPending ? "Saving…" : "Save customer"}
      </button>
    </form>
  );
}

function SetupQr({ device }: { device: any }) {
  const fn = useServerFn(getAgentSettings);
  const { data } = useQuery({ queryKey: ["agent-settings"], queryFn: () => fn({}) });
  const ready = !!data?.agent_apk_url && !!data?.agent_checksum;
  const payload = ready
    ? JSON.stringify({
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "app.prepaidpay.agent/.AgentAdminReceiver",
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": data!.agent_apk_url,
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM": data!.agent_checksum,
        "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
        "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
        "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
          imei: device.imei,
          secret: device.enrollment_secret,
        },
      })
    : "";
  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold">
        <QrCode className="h-4 w-4 text-brand" /> Setup QR for this phone
      </h2>
      {ready ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Factory-reset the phone, tap the welcome screen 6 times, connect to Wi‑Fi and scan this. The phone installs
            the lock app and enrolls itself — nothing to type.
          </p>
          <div className="mt-3 inline-block rounded-xl border border-border bg-white p-3">
            <QRCodeSVG value={payload} size={260} level="M" />
          </div>
          <p className="mt-2 text-xs font-medium text-destructive">Keep this QR private — it is this phone's key.</p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          An admin must first fill in "Lock app setup" on the device list page.
        </p>
      )}
    </section>
  );
}

function KycPanel({ id }: { id: string }) {
  const fn = useServerFn(getCustomerKyc);
  const { data: k } = useQuery({ queryKey: ["kyc", id], queryFn: () => fn({ data: { device_id: id } }) });
  if (!k) return null;
  const u = (k as any).urls as Record<string, string | null>;
  const pics: [string, string][] = [
    ["customer_photo", "Customer"], ["id_front", "ID front"], ["id_back", "ID back"],
    ["guarantor_photo", "Guarantor"], ["guarantor_id_front", "G. ID front"], ["guarantor_id_back", "G. ID back"], ["signature", "Signature"],
  ];
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 text-sm">
      <h2 className="font-display text-sm font-semibold">Customer file</h2>
      <Row k="Name" v={k.full_name} />
      <Row k="NIN" v={k.nin} />
      <Row k="Account (main phone)" v={k.primary_phone} />
      <Row k="Second phone" v={k.alt_phone} />
      <Row k="Address" v={k.address} />
      <Row k="Guarantor" v={`${k.guarantor_name} (${k.guarantor_relationship})`} />
      <Row k="Guarantor NIN" v={k.guarantor_nin} />
      <Row k="Guarantor phone" v={k.guarantor_phone} />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {pics.map(([key, label]) => u[key] ? (
          <a key={key} href={u[key]!} target="_blank" rel="noreferrer" className="text-center text-[10px] text-muted-foreground">
            <img src={u[key]!} alt={label} className="h-16 w-full rounded border border-border bg-white object-cover" />
            {label}
          </a>
        ) : null)}
      </div>
    </section>
  );
}

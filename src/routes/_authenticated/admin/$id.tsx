import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, Unlock, RotateCcw, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getDevice, recordPayment, setLock, getMyRole, deleteDevice } from "@/lib/devices.functions";
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> All devices
        </Link>

        <h1 className="mt-4 text-xl font-semibold">{d.customer_name}</h1>
        <p className="text-sm text-muted-foreground">
          {d.phone_number} · {d.device_model || "Unknown model"} · IMEI {d.imei}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Balance" value={formatMoney(balanceOf(d))} />
          <Stat label="Paid" value={formatMoney(d.amount_paid)} />
          <Stat
            label="Status"
            value={locked ? "Locked" : `Unlocked · ${Math.max(0, daysRemaining(d.paid_until))}d`}
          />
        </div>

        <div className="mt-3 rounded-xl border border-border p-4 text-sm">
          <Row k="Total price" v={formatMoney(d.total_price)} />
          <Row k="Daily rate" v={formatMoney(d.daily_rate)} />
          <Row k="Paid until" v={formatDate(d.paid_until)} />
          <Row k="Lock mode" v={d.lock_override} />
          <Row k="Enrolled" v={d.enrolled_at ? formatDate(d.enrolled_at) : "Not yet enrolled"} />
          <Row k="Last seen" v={d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never"} />
        </div>

        {isAdmin ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => lockMutation.mutate("locked")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <Lock className="h-4 w-4" /> Force lock
            </button>
            <button
              onClick={() => lockMutation.mutate("unlocked")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <Unlock className="h-4 w-4" /> Force unlock
            </button>
            <button
              onClick={() => lockMutation.mutate("auto")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <RotateCcw className="h-4 w-4" /> Automatic
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this device and its payment history?")) deleteMutation.mutate();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Lock controls and device deletion are limited to admins.
          </p>
        )}

        <section className="mt-6 rounded-xl border border-border p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Smartphone className="h-4 w-4" /> Request mobile money payment
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sends an iotec prompt to the customer's phone. Days are added automatically on approval.
          </p>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              promptMutation.mutate();
            }}
          >
            <input
              type="tel"
              value={promptPhone}
              onChange={(e) => setPromptPhone(e.target.value)}
              placeholder={d.phone_number}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
            />
            <input
              type="number"
              min={500}
              required
              value={promptAmount}
              onChange={(e) => setPromptAmount(e.target.value)}
              placeholder="Amount"
              className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={promptMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {promptMutation.isPending ? "Sending…" : "Send prompt"}
            </button>
          </form>
        </section>


        <section className="mt-6 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Record a payment</h2>
          <form
            className="mt-3 flex flex-wrap gap-2"
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
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
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
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Record
            </button>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Enrollment</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter these in the device agent app during setup on the customer's phone.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs">
{`IMEI:   ${d.imei}
Secret: ${d.enrollment_secret}
API:    POST /api/public/device/heartbeat`}
          </pre>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Payment history</h2>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {data.payments.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">No payments yet.</li>
            )}
            {data.payments.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{formatMoney(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
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
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listDevices, createDevice, getMyRole } from "@/lib/devices.functions";
import { isLocked, balanceOf, formatMoney, daysRemaining } from "@/lib/lock";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Staff console — PrepaidPay device financing" },
      { name: "description", content: "Register financed phones by IMEI, record payments and control device lock state." },
      { property: "og:title", content: "Staff console — PrepaidPay" },
      { property: "og:description", content: "Register financed phones by IMEI, record payments and control device lock state." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHome,
});

const emptyForm = {
  customer_name: "",
  phone_number: "",
  imei: "",
  device_model: "",
  total_price: "",
  deposit_paid: "",
  daily_rate: "2800",
};

function AdminHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchDevices = useServerFn(listDevices);
  const addDevice = useServerFn(createDevice);
  const roleFn = useServerFn(getMyRole);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: roleData } = useQuery({ queryKey: ["my-role"], queryFn: () => roleFn({}) });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: () => fetchDevices({}),
  });


  const mutation = useMutation({
    mutationFn: () =>
      addDevice({
        data: {
          customer_name: form.customer_name,
          phone_number: form.phone_number,
          imei: form.imei,
          device_model: form.device_model || undefined,
          total_price: Number(form.total_price || 0),
          deposit_paid: Number(form.deposit_paid || 0),
          daily_rate: Number(form.daily_rate || 0),
        },
      }),
    onSuccess: () => {
      toast.success("Device registered");
      setForm(emptyForm);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = devices.filter((d: any) =>
    [d.customer_name, d.phone_number, d.imei].join(" ").toLowerCase().includes(search.toLowerCase()),
  );

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Device console</h1>
            <p className="text-sm text-muted-foreground">
              {devices.length} registered devices ·{" "}
              <span className="capitalize">{roleData?.role ?? "…"}</span>
            </p>

          </div>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>

        <div className="mt-6 flex gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone or IMEI"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Register
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"
          >
            {[
              ["customer_name", "Customer name", "text"],
              ["phone_number", "Phone number", "tel"],
              ["imei", "IMEI (14–17 digits)", "text"],
              ["device_model", "Device model", "text"],
              ["total_price", "Total price", "number"],
              ["deposit_paid", "Deposit paid", "number"],
              ["daily_rate", "Daily rate", "number"],
            ].map(([key, label, type]) => (
              <label key={key} className="text-xs text-muted-foreground">
                {label}
                <input
                  type={type}
                  required={key !== "device_model"}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                />
              </label>
            ))}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {mutation.isPending ? "Saving…" : "Register device"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 divide-y divide-border rounded-xl border border-border">
          {isLoading && <p className="p-5 text-sm text-muted-foreground">Loading devices…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">No devices yet.</p>
          )}
          {filtered.map((d: any) => {
            const locked = isLocked(d);
            return (
              <button
                key={d.id}
                onClick={() => navigate({ to: "/admin/$id", params: { id: d.id } })}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.customer_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.phone_number} · IMEI {d.imei}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatMoney(balanceOf(d))}</p>
                  <p
                    className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${
                      locked ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {locked ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                    {locked ? "Locked" : `${Math.max(0, daysRemaining(d.paid_until))}d left`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

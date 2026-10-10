import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldCheck, Lock, Smartphone, Wallet, Package, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listDevices, createDevice, getMyRole, getAgentSettings, saveAgentSettings } from "@/lib/devices.functions";
import { isLocked, balanceOf, formatMoney, daysRemaining } from "@/lib/lock";
import { AgentsPanel } from "@/components/AgentsPanel";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Staff console — MULIKA device financing" },
      { name: "description", content: "Register financed phones by IMEI, record payments and control device lock state." },
      { property: "og:title", content: "Staff console — MULIKA" },
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
  imei2: "",
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
  const [folder, setFolder] = useState<"all" | "unseen">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [dualSim, setDualSim] = useState(true);

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
          imei2: dualSim ? form.imei2 : "",
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

  const unseen = (d: any) => {
    if (!d.customer_name) return false;
    const t = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0;
    return Date.now() - t > 48 * 3600 * 1000;
  };
  const unseenCount = devices.filter(unseen).length;
  const filtered = devices.filter((d: any) => folder === "all" || unseen(d)).filter((d: any) =>
    [d.customer_name, d.phone_number, d.imei, d.imei2].join(" ").toLowerCase().includes(search.toLowerCase()),
  );

  const lockedCount = devices.filter((d: any) => isLocked(d)).length;
  const stockCount = devices.filter((d: any) => !d.customer_name).length;
  const collected = devices.reduce((s: number, d: any) => s + (Number(d.amount_paid) || 0), 0);
  const outstanding = devices.reduce((s: number, d: any) => s + Math.max(0, balanceOf(d)), 0);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy-deep text-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand">
                <ShieldCheck className="h-5 w-5 text-brand-foreground" />
              </span>
              <div>
                <h1 className="font-display text-lg font-semibold leading-none">MULIKA Console</h1>
                <p className="mt-1 text-[11px] capitalize text-white/60">{roleData?.role ?? "…"} account</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeadStat icon={<Smartphone className="h-4 w-4" />} label="Devices" value={String(devices.length)} />
            <HeadStat icon={<Lock className="h-4 w-4" />} label="Locked" value={String(lockedCount)} tone={lockedCount > 0 ? "warn" : "ok"} />
            <HeadStat icon={<Package className="h-4 w-4" />} label="In stock" value={String(stockCount)} />
            <HeadStat icon={<Wallet className="h-4 w-4" />} label="Collected" value={formatMoney(collected)} />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Outstanding balance</p>
            <p className="font-display text-xl font-semibold">{formatMoney(outstanding)}</p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Register phone
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
          >
            <p className="font-display text-sm font-semibold sm:col-span-2">New device</p>
            <div className="flex gap-2 sm:col-span-2">
              {[["Dual SIM (2 IMEIs)", true], ["Single SIM (1 IMEI)", false]].map(([l, v]) => (
                <button key={String(v)} type="button" onClick={() => setDualSim(v as boolean)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${dualSim === v ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground"}`}>
                  {l as string}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">Dial *#06# on the phone. Each IMEI must be exactly 15 digits.</p>
            {[
              ["imei", dualSim ? "IMEI 1 (15 digits)" : "IMEI (15 digits)", "text"],
              ...(dualSim ? [["imei2", "IMEI 2 (15 digits)", "text"]] : []),
              ["customer_name", "Customer name (leave empty to stock)", "text"],
              ["phone_number", "Customer phone (leave empty to stock)", "tel"],
              ["device_model", "Device model", "text"],
              ["total_price", "Total price", "number"],
              ["deposit_paid", "Deposit paid", "number"],
              ["daily_rate", "Daily rate", "number"],
            ].map(([key, label, type]) => (
              <label key={key} className="text-xs font-medium text-muted-foreground">
                {label}
                <input
                  type={type}
                  {...(key.startsWith("imei") ? { inputMode: "numeric" as const, pattern: "[0-9]{15}", maxLength: 15, title: "Exactly 15 digits" } : {})}
                  required={!["device_model", "customer_name", "phone_number", "deposit_paid"].includes(key)}
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

        {roleData?.role === "admin" && <AgentSetup />}
        {roleData?.role === "admin" && <AgentsPanel />}
        {roleData?.role === "none" && (
          <p className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-destructive">
            This account has no access. Ask the admin to add you as an agent.
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => setFolder("all")}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${folder === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          >
            All phones ({devices.length})
          </button>
          <button
            onClick={() => setFolder("unseen")}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${folder === "unseen" ? "border-destructive bg-destructive text-destructive-foreground" : unseenCount ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-card"}`}
          >
            Not seen 48h ({unseenCount})
          </button>
        </div>
        {folder === "unseen" && (
          <p className="mt-2 text-xs text-muted-foreground">
            These customer phones have not checked in for 48 hours or more. They may be switched off, reset or flashed — call the customer and guarantor.
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or IMEI"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
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
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-accent/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                      locked ? "bg-destructive/10 text-destructive" : "bg-success-soft text-success"
                    }`}
                  >
                    {locked ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {d.customer_name || <span className="text-brand">In stock · {d.device_model || "phone"}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.phone_number ? `${d.phone_number} · ` : ""}IMEI {d.imei}
                      {unseen(d) && ` · last seen ${d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "never"}`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-sm font-semibold">{formatMoney(balanceOf(d))}</p>
                  <p className={`mt-0.5 text-[11px] font-medium ${locked ? "text-destructive" : "text-muted-foreground"}`}>
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

function HeadStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl bg-white/8 px-3.5 py-3 ring-1 ring-white/10">
      <p className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide ${
        tone === "warn" ? "text-red-300" : "text-white/60"
      }`}>
        {icon} {label}
      </p>
      <p className="mt-1 truncate font-display text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function AgentSetup() {
  const getFn = useServerFn(getAgentSettings);
  const saveFn = useServerFn(saveAgentSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["agent-settings"], queryFn: () => getFn({}) });
  const [url, setUrl] = useState<string | null>(null);
  const [sum, setSum] = useState<string | null>(null);
  const [frp, setFrp] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { agent_apk_url: url ?? data?.agent_apk_url ?? "", agent_checksum: sum ?? data?.agent_checksum ?? "", frp_account_id: frp ?? data?.frp_account_id ?? "" } }),
    onSuccess: () => {
      toast.success("Lock app saved — every phone now gets a setup QR");
      qc.invalidateQueries({ queryKey: ["agent-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ready = !!data?.agent_apk_url && !!data?.agent_checksum;
  return (
    <details className="mt-4 rounded-xl border border-border bg-card p-4" open={!ready}>
      <summary className="cursor-pointer font-display text-sm font-semibold">
        Lock app setup (one time){" "}
        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ready ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
          {ready ? "ready" : "needed"}
        </span>
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Paste the download link of the lock app and the code from checksum.txt. You only do this once.
      </p>
      <form
        className="mt-3 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <input
          required
          type="url"
          placeholder="https://…/app-release.apk"
          value={url ?? data?.agent_apk_url ?? ""}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <input
          required
          placeholder="Checksum (letters after PACKAGE_CHECKSUM=)"
          value={sum ?? data?.agent_checksum ?? ""}
          onChange={(e) => setSum(e.target.value.replace(/^PACKAGE_CHECKSUM=/, ""))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <label className="mt-1 text-xs font-semibold">Shop Google account number (reset protection)</label>
        <input
          inputMode="numeric"
          placeholder="Leave empty unless tested"
          value={frp ?? data?.frp_account_id ?? ""}
          onChange={(e) => setFrp(e.target.value.replace(/\D/g, ""))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <p className="text-[11px] text-muted-foreground">
          Digits only, never the email. A wrong value makes a reset phone refuse every Google
          account. Keep this empty until it has been tested on a spare phone.
        </p>
        <button
          disabled={save.isPending}
          className="rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Save
        </button>
      </form>
    </details>
  );
}

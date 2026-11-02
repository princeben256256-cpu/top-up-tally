import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setSimProtection } from "@/lib/devices.functions";

type Policy = {
  enabled: boolean; expected_hash: string | null; revision: string;
  reported_hashes: unknown; reported_state: string | null; reported_at: string | null;
  current: boolean; released: boolean;
};

export function SimProtectionPanel({ id, policy, isAdmin }: { id: string; policy: Policy | null; isAdmin: boolean }) {
  const save = useServerFn(setSimProtection);
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const hashes = Array.isArray(policy?.reported_hashes) ? policy.reported_hashes.filter((h): h is string => typeof h === "string") : [];
  const age = Date.now() - Date.parse(policy?.reported_at ?? "");
  const readable = age >= 0 && age <= 120_000 && !["unreadable", "not_owner"].includes(policy?.reported_state ?? "");
  const chosen = hashes.length === 1 ? hashes[0] : selected;
  const mutation = useMutation({
    mutationFn: (hash: string | null) => {
      if (!policy) throw new Error("Waiting for the updated lock app to report");
      return save({ data: { device_id: id, hash, revision: policy.revision } });
    },
    onSuccess: () => {
      toast.success("SIM instruction saved — wait for the phone's next report");
      qc.invalidateQueries({ queryKey: ["device", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const labels: Record<string, string> = {
    matched: "Registered SIM present — phone reported", missing: "Registered SIM not detected — phone reported",
    unreadable: "SIM identity unavailable — protection not verified", not_owner: "Device owner inactive — protection unavailable",
    off: "SIM restriction off — phone reported",
  };
  return (
    <section aria-label="Registered SIM protection" className="mt-4 border-y border-border py-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-brand" /> Registered SIM protection</h2>
      <p className="mt-2 text-sm font-medium">{policy?.enabled ? policy.released ? "Paused — fully paid or staff unlock" : "ON requested" : "OFF requested"}</p>
      <p className="mt-2 text-sm text-muted-foreground">{!policy ? "Not verified — waiting for lock app 1.5 or newer" : !policy.current ? "Waiting for a fresh phone report" : labels[policy.reported_state ?? ""] ?? "Not verified"}</p>
      {policy?.expected_hash && <p className="mt-2 break-all text-xs text-muted-foreground">Registered SIM fingerprint: …{policy.expected_hash.slice(-8)}</p>}
      {isAdmin && policy && (
        <div className="mt-3 space-y-3">
          {hashes.length > 1 && <div>
            <label htmlFor="sim-choice" className="mb-1 block text-xs font-medium">Customer SIM fingerprint</label>
            <select id="sim-choice" value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-sm">
              <option value="">Choose the customer's SIM</option>
              {hashes.map((hash) => <option key={hash} value={hash}>SIM fingerprint …{hash.slice(-8)}</option>)}
            </select>
          </div>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!readable || !chosen || !hashes.includes(chosen) || mutation.isPending || policy.released} onClick={() => {
              if (confirm("Confirm this is the customer's registered SIM. For dual SIM, insert only the customer's SIM first to identify it. Ordinary use will be restricted if it is removed; payment and emergency access remain available. Approve this SIM?")) mutation.mutate(chosen);
            }}><ShieldCheck /> {policy.enabled ? "Approve replacement SIM" : "Approve SIM and enable"}</Button>
            <Button size="sm" variant="outline" disabled={!policy.enabled || mutation.isPending} onClick={() => mutation.mutate(null)}><ShieldOff /> Disable SIM restriction</Button>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">The approved SIM can use either slot; a second SIM is allowed. Full payment or staff force-unlock pauses this restriction. Reports do not prove physical locking or protection after a reset.</p>
    </section>
  );
}
import { z } from "zod";

export const resetReportSchema = z.object({
  state: z.enum(["accepted", "cleared", "unsupported", "not_owner", "invalid_account", "failed", "mismatch"]),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  android_sdk: z.number().int().min(24).max(100),
  device_owner: z.boolean(),
  settings_reset_blocked: z.boolean(),
});
export type ResetReport = z.infer<typeof resetReportSchema>;

// Bind readback to the precise shop account and paid state, without reporting the account ID.
export async function resetRevision(enabled: boolean, account: string, fullyPaid: boolean) {
  const input = JSON.stringify([enabled, enabled ? account : "", fullyPaid]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isCurrentResetReport(report: { revision: string; received_at: string } | null, revision: string, now = Date.now()) {
  if (!report || report.revision !== revision) return false;
  const age = now - Date.parse(report.received_at);
  return Number.isFinite(age) && age >= 0 && age <= 120_000;
}
import { z } from "zod";

export const simHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const simReportSchema = z.object({
  hashes: z.array(simHashSchema).max(4),
  state: z.enum(["off", "matched", "missing", "unreadable", "not_owner"]),
  revision: z.string().uuid().nullable(),
});
export type SimReport = z.infer<typeof simReportSchema>;

export function assertSimApproval(isAdmin: boolean, hash: string | null, report: {
  reported_hashes: unknown; reported_at: string | null; reported_state: string | null;
} | null, now = Date.now()) {
  if (!isAdmin) throw new Error("Only admins can change registered SIM protection");
  if (hash === null) return;
  const age = now - Date.parse(report?.reported_at ?? "");
  if (!report || !Number.isFinite(age) || age < 0 || age > 120_000 ||
      ["unreadable", "not_owner"].includes(report.reported_state ?? "") ||
      !Array.isArray(report.reported_hashes) || !report.reported_hashes.includes(hash)) {
    throw new Error("Keep the phone online with the customer's SIM inserted and wait for a fresh readable SIM report");
  }
}

export function simReportCurrent(report: { reported_at: string | null; reported_revision: string | null; revision: string }, now = Date.now()) {
  const age = now - Date.parse(report.reported_at ?? "");
  return report.reported_revision === report.revision && Number.isFinite(age) && age >= 0 && age <= 120_000;
}
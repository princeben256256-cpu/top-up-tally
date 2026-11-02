import { describe, expect, it } from "vitest";
import { assertSimApproval, simReportCurrent, simReportSchema } from "./sim-protection";

describe("registered SIM protection", () => {
  const hash = "a".repeat(64);
  const now = Date.parse("2026-11-02T12:00:00Z");
  const report = { reported_hashes: [hash], reported_at: "2026-11-02T11:59:30Z", reported_state: "off" };
  it("allows only admins to approve or disable binding", () => {
    expect(() => assertSimApproval(false, hash, report, now)).toThrow("Only admins");
    expect(() => assertSimApproval(false, null, null, now)).toThrow("Only admins");
    expect(() => assertSimApproval(true, hash, report, now)).not.toThrow();
  });
  it("never approves an unobserved replacement SIM", () => {
    expect(() => assertSimApproval(true, "b".repeat(64), report, now)).toThrow();
  });
  it("rejects unreadable and stale observations", () => {
    expect(() => assertSimApproval(true, hash, { ...report, reported_state: "unreadable" }, now)).toThrow();
    expect(() => assertSimApproval(true, hash, report, now + 120_000)).toThrow();
  });
  it("invalidates reported enforcement after an approval change", () => {
    expect(simReportCurrent({ reported_at: report.reported_at, reported_revision: "old", revision: "new" }, now)).toBe(false);
  });
  it("accepts dual SIM observations without accepting raw SIM serials", () => {
    expect(simReportSchema.safeParse({ hashes: [hash, "b".repeat(64)], state: "matched", revision: null }).success).toBe(true);
    expect(simReportSchema.safeParse({ hashes: ["8901234567890123456"], state: "matched", revision: null }).success).toBe(false);
  });
});
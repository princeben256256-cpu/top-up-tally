import { describe, expect, it } from "vitest";
import { isCurrentResetReport, resetReportSchema, resetRevision } from "./reset-report";

describe("Gmail policy reporting safeguards", () => {
  it("invalidates acceptance when the shop account changes", async () => {
    expect(await resetRevision(true, "109240451316663629369", false)).not.toBe(await resetRevision(true, "123456789012345678901", false));
  });
  it("invalidates acceptance when reset protection is switched off", async () => {
    expect(await resetRevision(true, "109240451316663629369", false)).not.toBe(await resetRevision(false, "109240451316663629369", false));
  });
  it("invalidates acceptance when the phone becomes fully paid", async () => {
    expect(await resetRevision(true, "109240451316663629369", false)).not.toBe(await resetRevision(true, "109240451316663629369", true));
  });
  it("rejects stale or mismatched reports", () => {
    const report = { revision: "a", received_at: "2026-10-31T01:00:00Z" };
    expect(isCurrentResetReport(report, "a", Date.parse("2026-10-31T01:02:01Z"))).toBe(false);
    expect(isCurrentResetReport(report, "b", Date.parse("2026-10-31T01:01:00Z"))).toBe(false);
    expect(isCurrentResetReport(report, "a", Date.parse("2026-10-31T01:01:00Z"))).toBe(true);
  });
  it("never accepts an invented hardware-protected status", () => {
    expect(resetReportSchema.safeParse({ state: "protected", revision: "a".repeat(64), android_sdk: 35, device_owner: true, settings_reset_blocked: true }).success).toBe(false);
  });
});
import { resetReportSchema as schemaV14 } from "./reset-report";
describe("lock app 1.4 report fields", () => {
  const base = { state: "accepted", revision: "a".repeat(64), android_sdk: 33, device_owner: true, settings_reset_blocked: true };
  it("still accepts reports from older lock apps without version", () => {
    expect(schemaV14.safeParse(base).success).toBe(true);
  });
  it("keeps version and Gmail-support flags from new lock apps", () => {
    const r = schemaV14.parse({ ...base, app_version: 6, frp_supported: false, dev_options_on: true });
    expect(r.app_version).toBe(6);
    expect(r.frp_supported).toBe(false);
  });
});

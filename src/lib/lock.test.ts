import { describe, expect, it } from "vitest";
import { isLocked, lockDeadline, lockSchedule } from "./lock";

const now = new Date("2026-10-24T05:57:00Z");
const phone = { total_price: 400000, amount_paid: 64000, paid_until: "2026-10-23T08:15:12.914Z", lock_override: "auto" };

describe("cached lock deadline and countdown", () => {
  it("force unlock clears the deadline even when payment has expired", () => {
    const unlocked = { ...phone, lock_override: "unlocked" };
    expect(lockDeadline(unlocked)).toBeNull();
    expect(lockSchedule(unlocked, now).kind).toBe("unlocked");
    expect(isLocked(unlocked, now)).toBe(false);
  });
  it("fully paid phones have no automatic lock deadline", () => {
    const paid = { ...phone, amount_paid: 400000 };
    expect(lockDeadline(paid)).toBeNull();
    expect(lockSchedule(paid, now).kind).toBe("paid");
    expect(isLocked(paid, now)).toBe(false);
  });
  it("automatic locks become due at the exact cached deadline", () => {
    expect(lockDeadline(phone)).toBe(phone.paid_until);
    const deadline = new Date(phone.paid_until);
    expect(isLocked(phone, deadline)).toBe(true);
    expect(lockSchedule(phone, deadline).kind).toBe("due");
  });
  it("force lock remains requested regardless of a future payment date", () => {
    const forced = { ...phone, paid_until: "2026-10-30T05:57:00Z", lock_override: "locked" };
    expect(isLocked(forced, now)).toBe(true);
    expect(lockSchedule(forced, now).kind).toBe("locked");
    expect(lockDeadline(forced)).toBeNull();
  });
  it("a future deadline displays hours and minutes without premature zero", () => {
    expect(lockSchedule({ ...phone, paid_until: "2026-10-24T07:02:30Z" }, now)).toEqual({ kind: "countdown", minutes: 66 });
    expect(lockSchedule({ ...phone, paid_until: "2026-10-24T05:57:30Z" }, now)).toEqual({ kind: "countdown", minutes: 1 });
  });
  it("expired time is due rather than a zero-minute countdown", () => {
    expect(lockSchedule(phone, now).kind).toBe("due");
  });
});
export type LockOverride = "auto" | "locked" | "unlocked";

export type DeviceLockInput = {
  total_price: number;
  amount_paid: number;
  paid_until: string;
  lock_override: string;
};

export function balanceOf(d: { total_price: number; amount_paid: number }) {
  return Math.max(0, Number(d.total_price) - Number(d.amount_paid));
}

export function isLocked(d: DeviceLockInput, now = new Date()) {
  if (d.lock_override === "locked") return true;
  if (d.lock_override === "unlocked") return false;
  if (balanceOf(d) <= 0) return false;
  return new Date(d.paid_until).getTime() <= now.getTime();
}

/** A cleared deadline must never display a countdown or create an offline lock. */
export function lockDeadline(d: DeviceLockInput): string | null {
  return d.lock_override === "auto" && balanceOf(d) > 0 ? d.paid_until : null;
}

export function lockSchedule(d: DeviceLockInput, now = new Date()) {
  if (d.lock_override === "locked") return { kind: "locked" as const, minutes: 0 };
  if (d.lock_override === "unlocked") return { kind: "unlocked" as const, minutes: 0 };
  if (balanceOf(d) <= 0) return { kind: "paid" as const, minutes: 0 };
  const deadline = lockDeadline(d);
  const remaining = deadline ? new Date(deadline).getTime() - now.getTime() : NaN;
  if (!Number.isFinite(remaining)) return { kind: "unknown" as const, minutes: 0 };
  if (remaining <= 0) return { kind: "due" as const, minutes: 0 };
  return { kind: "countdown" as const, minutes: Math.ceil(remaining / 60_000) };
}

export function daysRemaining(paidUntil: string, now = new Date()) {
  const ms = new Date(paidUntil).getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}

export function daysForAmount(amount: number, dailyRate: number) {
  if (!dailyRate || dailyRate <= 0) return 0;
  return Math.floor(amount / dailyRate);
}

export function addDays(from: Date, days: number) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatMoney(n: number, currency = "UGX") {
  return `${currency} ${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

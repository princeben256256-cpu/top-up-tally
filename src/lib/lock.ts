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
  return new Date(d.paid_until).getTime() < now.getTime();
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

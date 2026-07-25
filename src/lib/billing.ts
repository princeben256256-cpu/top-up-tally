export const account = {
  user: "750818860",
  version: "prod-1.0.5",
  brand: "PrepaidPay",
  totalPaid: 392465,
  totalBalance: 1267630 - 392465,
  total: 1267630,
  issuedDate: "8 May 2026",
  finalDueDate: "3 May 2027",
  nextPaymentDue: "26 July 2026",
  daysPastDue: -1,
  totalPastDue: 0,
  unlockedTill: "2 August 2026",
  currency: "UGX",
};

export const notifications = [
  {
    id: "1",
    title: "5 Days Late – Unlock your phone",
    body: "Dear Kagiri, your loan account is under review. You are now 5 days overdue. Repay UGX 18,648 to restore access.",
    date: "16 May 19:29",
    unread: true,
  },
];

export function formatUGX(n: number) {
  return `UGX ${n.toLocaleString("en-US")}`;
}

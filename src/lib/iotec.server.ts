import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, daysForAmount, balanceOf } from "./lock";

const ID_BASE = process.env.IOTEC_ID_URL || "https://id.iotec.io";
const PAY_BASE = process.env.IOTEC_PAY_URL || "https://pay.iotec.io";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const clientId = process.env.IOTEC_CLIENT_ID;
  const clientSecret = process.env.IOTEC_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("iotec credentials are not configured");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "profile",
  });

  const res = await fetch(`${ID_BASE}/connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[iotec] token failed [${res.status}]: ${text}`);
    throw new Error("Payment provider authentication failed");
  }
  const json = JSON.parse(text) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function payFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${PAY_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[iotec] ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Payment provider error [${res.status}]: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("256")) return digits;
  if (digits.startsWith("0")) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  return digits;
}

/** iotec status strings mapped to our own states. */
function mapStatus(status: string | undefined) {
  const s = (status || "").toLowerCase();
  if (["success", "successful", "completed"].includes(s)) return "successful";
  if (["failed", "cancelled", "canceled", "expired", "rejected"].includes(s)) return "failed";
  return "pending";
}

/** Starts a mobile money collection for a device and stores the intent. */
export async function startCollection(input: {
  device_id: string;
  amount: number;
  phone: string;
  initiated_by?: string | null;
}) {
  const { data: device, error } = await supabaseAdmin
    .from("devices")
    .select("id, customer_name, imei, total_price, amount_paid")
    .eq("id", input.device_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!device) throw new Error("Device not found");

  const payer = normalizePhone(input.phone);
  if (payer.length < 12) throw new Error("Enter a valid mobile money number");

  const externalId = `pp-${device.id.slice(0, 8)}-${Date.now()}`;

  const { error: insErr } = await supabaseAdmin.from("payment_intents").insert({
    device_id: device.id,
    external_id: externalId,
    amount: input.amount,
    payer_phone: payer,
    status: "pending",
    initiated_by: input.initiated_by ?? null,
  });
  if (insErr) throw new Error(insErr.message);

  try {
    const result = await payFetch("/api/collections/collect", {
      method: "POST",
      body: JSON.stringify({
        category: "MobileMoney",
        currency: "UGX",
        walletId: process.env.IOTEC_WALLET_ID,
        externalId,
        payer,
        amount: input.amount,
        payerNote: `PrepaidPay ${device.imei}`,
        payeeNote: `Device payment - ${device.customer_name}`,
        channel: "Web",
        transactionChargesCategory: "ChargeWallet",
      }),
    });

    const status = mapStatus(result?.status);
    await supabaseAdmin
      .from("payment_intents")
      .update({
        iotec_id: result?.id ?? null,
        status,
        status_message: result?.statusMessage ?? null,
      })
      .eq("external_id", externalId);

    if (status === "successful") await applySuccessfulIntent(externalId);

    return { external_id: externalId, status, message: result?.statusMessage ?? null };
  } catch (e) {
    await supabaseAdmin
      .from("payment_intents")
      .update({ status: "failed", status_message: (e as Error).message.slice(0, 300) })
      .eq("external_id", externalId);
    throw e;
  }
}

/** Polls iotec for the latest state of an intent and applies it when paid. */
export async function refreshIntent(externalId: string) {
  const { data: intent, error } = await supabaseAdmin
    .from("payment_intents")
    .select("id, external_id, iotec_id, status, amount, device_id, applied, status_message")
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!intent) return null;

  if (intent.status === "pending") {
    try {
      const result = intent.iotec_id
        ? await payFetch(`/api/collections/status/${intent.iotec_id}`)
        : await payFetch(`/api/collections/external-id/${encodeURIComponent(externalId)}`);
      const status = mapStatus(result?.status);
      if (status !== intent.status) {
        await supabaseAdmin
          .from("payment_intents")
          .update({ status, status_message: result?.statusMessage ?? null })
          .eq("id", intent.id);
        intent.status = status;
        intent.status_message = result?.statusMessage ?? null;
      }
    } catch (e) {
      console.error("[iotec] status check failed", (e as Error).message);
    }
  }

  if (intent.status === "successful" && !intent.applied) {
    await applySuccessfulIntent(externalId);
  }

  const { data: device } = await supabaseAdmin
    .from("devices")
    .select("total_price, amount_paid, paid_until, lock_override")
    .eq("id", intent.device_id)
    .maybeSingle();

  return {
    external_id: externalId,
    status: intent.status,
    message: intent.status_message,
    amount: Number(intent.amount),
    balance: device ? balanceOf(device as never) : null,
    paid_until: device?.paid_until ?? null,
  };
}

/** Credits a successful collection to the device exactly once. */
export async function applySuccessfulIntent(externalId: string) {
  const { data: intent } = await supabaseAdmin
    .from("payment_intents")
    .select("id, device_id, amount, applied, initiated_by")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!intent || intent.applied) return;

  // Claim the intent first so concurrent callback + poll cannot double-credit.
  const { data: claimed } = await supabaseAdmin
    .from("payment_intents")
    .update({ applied: true, status: "successful" })
    .eq("id", intent.id)
    .eq("applied", false)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: device } = await supabaseAdmin
    .from("devices")
    .select("id, daily_rate, amount_paid, paid_until")
    .eq("id", intent.device_id)
    .maybeSingle();
  if (!device) return;

  const amount = Number(intent.amount);
  const days = daysForAmount(amount, Number(device.daily_rate));
  const base = new Date(Math.max(new Date(device.paid_until).getTime(), Date.now()));
  const nextPaidUntil = addDays(base, days);

  await supabaseAdmin.from("payments").insert({
    device_id: device.id,
    amount,
    method: "iotec",
    note: `iotec ${externalId}`,
    days_added: days,
    recorded_by: intent.initiated_by ?? null,
  });

  await supabaseAdmin
    .from("devices")
    .update({
      amount_paid: Number(device.amount_paid) + amount,
      paid_until: nextPaidUntil.toISOString(),
      lock_override: "auto",
    })
    .eq("id", device.id);
}

/** Handles an iotec webhook payload. */
export async function handleIotecCallback(payload: Record<string, any>) {
  const externalId: string | undefined = payload.externalId ?? payload.external_id;
  if (!externalId) return { ok: false, reason: "missing_external_id" };

  const status = mapStatus(payload.status);
  await supabaseAdmin
    .from("payment_intents")
    .update({
      status,
      status_message: payload.statusMessage ?? payload.status_message ?? null,
      iotec_id: payload.id ?? null,
    })
    .eq("external_id", externalId);

  if (status === "successful") await applySuccessfulIntent(externalId);
  return { ok: true, status };
}

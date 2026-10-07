import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, daysForAmount, isLocked, balanceOf } from "./lock";

type AnyClient = { from: (t: string) => any };

const DEVICE_PUBLIC_COLUMNS =
  "id, imei, imei2, phone_number, customer_name, device_model, total_price, deposit_paid, daily_rate, amount_paid, paid_until, lock_override, lock_message, enrolled_at, last_seen_at, created_at";

export async function listDevicesFor(client: AnyClient) {
  const { data, error } = await client
    .from("devices")
    .select(DEVICE_PUBLIC_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDeviceFor(client: AnyClient, id: string) {
  const { data, error } = await client
    .from("devices")
    .select(`${DEVICE_PUBLIC_COLUMNS}, enrollment_secret`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Device not found");

  const { data: payments, error: pErr } = await client
    .from("payments")
    .select("id, amount, method, note, days_added, created_at")
    .eq("device_id", id)
    .order("created_at", { ascending: false });
  if (pErr) throw new Error(pErr.message);

  return { device: data, payments: payments ?? [] };
}

export async function createDeviceFor(
  client: AnyClient,
  userId: string,
  input: {
    imei: string;
    imei2?: string;
    phone_number?: string;
    customer_name?: string;
    device_model?: string;
    total_price: number;
    deposit_paid: number;
    daily_rate: number;
  },
) {
  const imei2 = (input.imei2 ?? "").trim() || null;
  if (imei2 && imei2 === input.imei.trim()) throw new Error("IMEI 1 and IMEI 2 cannot be the same");
  // deposit reduces balance but buys no days
  const days = 0;
  const { data, error } = await client
    .from("devices")
    .insert({
      imei: input.imei.trim(),
      imei2,
      phone_number: (input.phone_number ?? "").trim(),
      customer_name: (input.customer_name ?? "").trim(),
      device_model: input.device_model?.trim() || null,
      total_price: input.total_price,
      deposit_paid: input.deposit_paid,
      daily_rate: input.daily_rate,
      amount_paid: input.deposit_paid,
      paid_until: addDays(new Date(), days).toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A phone with that IMEI is already registered");
    throw new Error(error.message);
  }
  return data;
}

export async function recordPaymentFor(
  client: AnyClient,
  userId: string,
  input: { device_id: string; amount: number; method: string; note?: string },
) {
  const { data: device, error } = await client
    .from("devices")
    .select("id, daily_rate, amount_paid, paid_until, total_price")
    .eq("id", input.device_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!device) throw new Error("Device not found");

  const days = daysForAmount(input.amount, Number(device.daily_rate));
  const base = new Date(
    Math.max(new Date(device.paid_until).getTime(), Date.now()),
  );
  const nextPaidUntil = addDays(base, days);
  const nextAmountPaid = Number(device.amount_paid) + input.amount;

  const { error: payErr } = await client.from("payments").insert({
    device_id: input.device_id,
    amount: input.amount,
    method: input.method,
    note: input.note?.trim() || null,
    days_added: days,
    recorded_by: userId,
  });
  if (payErr) throw new Error(payErr.message);

  const { error: updErr } = await client
    .from("devices")
    .update({
      amount_paid: nextAmountPaid,
      paid_until: nextPaidUntil.toISOString(),
      lock_override: "auto",
    })
    .eq("id", input.device_id);
  if (updErr) throw new Error(updErr.message);

  return { days_added: days, paid_until: nextPaidUntil.toISOString() };
}

/** Hand an in-stock phone to a customer: deposit starts their paid time from today. */
export async function assignCustomerFor(
  client: AnyClient,
  input: { device_id: string; customer_name: string; phone_number: string; deposit_paid: number },
) {
  const { data: device, error } = await client
    .from("devices")
    .select("id, daily_rate, customer_name")
    .eq("id", input.device_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!device) throw new Error("Device not found");
  if (device.customer_name) throw new Error("This phone already has a customer");
  const days = 0; // deposit buys no days
  const { error: updErr } = await client
    .from("devices")
    .update({
      customer_name: input.customer_name.trim(),
      phone_number: input.phone_number.trim(),
      deposit_paid: input.deposit_paid,
      amount_paid: input.deposit_paid,
      paid_until: addDays(new Date(), days).toISOString(),
      lock_override: "auto",
    })
    .eq("id", input.device_id);
  if (updErr) throw new Error(updErr.message);
  return { days_added: days };
}

export async function setLockFor(
  client: AnyClient,
  input: { device_id: string; lock_override: string; lock_message?: string },
) {
  const { error } = await client
    .from("devices")
    .update({
      lock_override: input.lock_override,
      lock_message: input.lock_message?.trim() || null,
    })
    .eq("id", input.device_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

function normalizeQuery(q: string) {
  return q.replace(/[^0-9a-zA-Z+]/g, "");
}

/** Public customer lookup by IMEI or phone number — no PII beyond their own record. */
export async function lookupDevicePublic(query: string) {
  const q = normalizeQuery(query);
  if (q.length < 6) return null;
  // in-stock phones (no customer yet) are never shown publicly

  const { data, error } = await supabaseAdmin
    .from("devices")
    .select(
      "id, imei, phone_number, customer_name, device_model, total_price, deposit_paid, daily_rate, amount_paid, paid_until, lock_override, lock_message",
    )
    .or(`imei.eq.${q},imei2.eq.${q},phone_number.eq.${q}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // phone still in the shop (no customer yet): say so, but reveal nothing else
  if (!data.customer_name) return { in_stock: true as const };

  return {
    ...data,
    balance: balanceOf(data as any),
    locked: isLocked(data as any),
  };
}

/** Device-agent heartbeat: authenticates with IMEI + enrollment secret. */
export async function deviceHeartbeat(imei: string, secret: string) {
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select(
      "id, imei, customer_name, total_price, amount_paid, paid_until, lock_override, lock_message, enrollment_secret, enrolled_at",
    )
    .eq("imei", imei)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.enrollment_secret !== secret) return null;

  await supabaseAdmin
    .from("devices")
    .update({
      last_seen_at: new Date().toISOString(),
      enrolled_at: data.enrolled_at ?? new Date().toISOString(),
    })
    .eq("id", data.id);

  const locked = isLocked(data as any);
  const { data: settings } = await supabaseAdmin
    .from("app_settings").select("frp_account_id").eq("id", 1).maybeSingle();
  const balance = balanceOf(data as any);
  return {
    frp_account_id: (settings as any)?.frp_account_id ?? "",
    fully_paid: Number(data.total_price) > 0 && balance <= 0,
    device_id: data.id,
    customer_name: data.customer_name,
    locked,
    balance: balanceOf(data as any),
    paid_until: data.paid_until,
    message:
      data.lock_message ??
      (locked
        ? "Your device is locked. Please make a payment to continue using it."
        : "Device active."),
  };
}

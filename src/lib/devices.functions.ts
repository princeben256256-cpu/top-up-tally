import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ id: z.string().uuid() });

const createSchema = z.object({
  imei: z.string().trim().regex(/^[0-9]{14,17}$/, "IMEI must be 14–17 digits"),
  phone_number: z.string().trim().min(7).max(20),
  customer_name: z.string().trim().min(2).max(100),
  device_model: z.string().trim().max(80).optional(),
  total_price: z.number().min(0).max(100_000_000),
  deposit_paid: z.number().min(0).max(100_000_000),
  daily_rate: z.number().min(1).max(10_000_000),
});

const paymentSchema = z.object({
  device_id: z.string().uuid(),
  amount: z.number().min(1).max(100_000_000),
  method: z.enum(["cash", "mobile_money", "bank", "card"]),
  note: z.string().trim().max(200).optional(),
});

const lockSchema = z.object({
  device_id: z.string().uuid(),
  lock_override: z.enum(["auto", "locked", "unlocked"]),
  lock_message: z.string().trim().max(200).optional(),
});

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listDevicesFor } = await import("./devices.server");
    return listDevicesFor(context.supabase as never);
  });

export const getDevice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { getDeviceFor } = await import("./devices.server");
    return getDeviceFor(context.supabase as never, data.id);
  });

export const createDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { createDeviceFor } = await import("./devices.server");
    return createDeviceFor(context.supabase as never, context.userId, data);
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paymentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { recordPaymentFor } = await import("./devices.server");
    return recordPaymentFor(context.supabase as never, context.userId, data);
  });

export const setLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lockSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { setLockFor } = await import("./devices.server");
    return setLockFor(context.supabase as never, data);
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devices").delete().eq("id", data.id);
    if (error) throw new Error("Only admins can delete devices");
    return { ok: true };
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { role: (data?.role as string) ?? "agent" };
  });

export const lookupDevice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(6).max(30) }).parse(d))
  .handler(async ({ data }) => {
    const { lookupDevicePublic } = await import("./devices.server");
    return lookupDevicePublic(data.query);
  });


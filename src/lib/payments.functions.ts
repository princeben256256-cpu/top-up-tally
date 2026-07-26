import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const startSchema = z.object({
  device_id: z.string().uuid(),
  amount: z.number().int().min(500).max(20_000_000),
  phone: z.string().trim().min(9).max(15),
});

const statusSchema = z.object({ external_id: z.string().trim().min(6).max(80) });

/** Customer-initiated mobile money collection (public). */
export const startMobileMoneyPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => startSchema.parse(d))
  .handler(async ({ data }) => {
    const { startCollection } = await import("./iotec.server");
    return startCollection(data);
  });

/** Poll the state of a collection (public — external id is unguessable). */
export const checkMobileMoneyPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data }) => {
    const { refreshIntent } = await import("./iotec.server");
    return refreshIntent(data.external_id);
  });

/** Staff-initiated collection prompt on the customer's phone. */
export const requestPaymentFromCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => startSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { startCollection } = await import("./iotec.server");
    return startCollection({ ...data, initiated_by: context.userId });
  });

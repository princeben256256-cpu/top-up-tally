import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const img = z.string().startsWith("data:image/").max(3_000_000);
const phone = z.string().trim().regex(/^(0|256|\+256)?7[0-9]{8}$/, "Use a Ugandan number like 0772123456");
const nin = z.string().trim().toUpperCase().regex(/^C[MF][A-Z0-9]{12}$/, "NIN is 14 characters, starts with CM or CF");

async function requireStaff(context: any) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Staff only");
}

const normPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.startsWith("256") ? `0${d.slice(3)}` : d;
};

export const verifyIdPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: img, side: z.enum(["front", "back"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { checkIdImage } = await import("./kyc.server");
    return checkIdImage(data.image, data.side);
  });

const registerSchema = z.object({
  device_id: z.string().uuid(),
  full_name: z.string().trim().min(3).max(100),
  nin,
  primary_phone: phone,
  alt_phone: phone,
  address: z.string().trim().min(3).max(200),
  occupation: z.string().trim().max(100).default(""),
  guarantor_name: z.string().trim().min(3).max(100),
  guarantor_nin: nin,
  guarantor_phone: phone,
  guarantor_relationship: z.string().trim().min(2).max(50),
  guarantor_address: z.string().trim().min(3).max(200),
  deposit_paid: z.number().min(0).max(100_000_000),
  images: z.object({
    customer_photo: img,
    id_front: img,
    id_back: img,
    guarantor_photo: img,
    guarantor_id_front: img,
    guarantor_id_back: img,
    signature: img,
  }),
});

export const registerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registerSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const p1 = normPhone(data.primary_phone);
    const p2 = normPhone(data.alt_phone);
    if (p1 === p2) throw new Error("Second number must be different from the main number");
    const { registerCustomer: run } = await import("./kyc.server");
    return run(context.userId, {
      ...data,
      primary_phone: p1,
      alt_phone: p2,
      guarantor_phone: normPhone(data.guarantor_phone),
      occupation: data.occupation ?? "",
    });
  });

export const getCustomerKyc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ device_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { getKyc } = await import("./kyc.server");
    return getKyc(data.device_id);
  });

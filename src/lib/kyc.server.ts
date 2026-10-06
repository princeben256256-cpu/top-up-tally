import { addDays } from "./lock";

export type IdCheck = {
  ok: boolean;
  is_ugandan_national_id: boolean;
  side: "front" | "back" | "unknown";
  looks_original: boolean;
  nin: string | null;
  name: string | null;
  reason: string;
};

const PROMPT = `You check photos of Ugandan National ID cards for a phone shop.
Return ONLY JSON: {"is_ugandan_national_id":bool,"side":"front"|"back"|"unknown","looks_original":bool,"nin":string|null,"name":string|null,"reason":string}
- looks_original must be false if it is a photocopy, a printout on paper, a photo of a screen/phone, a scan, edited, laminated paper copy, or a drawing. Only a real plastic card photographed directly is original.
- nin is the 14-character National Identification Number (starts with CM or CF) if readable, else null.
- name: full name as printed (front only), else null.
- reason: one short plain-English sentence.`;

export async function checkIdImage(dataUrl: string, expectedSide: "front" | "back"): Promise<IdCheck> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("ID checking is not configured");
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["is_ugandan_national_id", "side", "looks_original", "nin", "name", "reason"],
    properties: {
      is_ugandan_national_id: { type: "boolean" },
      side: { type: "string", enum: ["front", "back", "unknown"] },
      looks_original: { type: "boolean" },
      nin: { type: ["string", "null"] },
      name: { type: ["string", "null"] },
      reason: { type: "string" },
    },
  };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions: PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `This should be the ${expectedSide} of the card. Reply in json.` },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "id_check", strict: true, schema } },
    }),
  });
  if (res.status === 429) throw new Error("Too many ID checks right now — wait a minute and retry");
  if (res.status === 402) throw new Error("ID checking credits are used up — top up AI credits");
  if (!res.ok || !res.body) throw new Error(`ID check failed [${res.status}]`);
  let text = "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
      } catch {
        /* ignore */
      }
    }
  }
  const m = text.match(/\{[\s\S]*\}/);
  let p: any = {};
  try {
    p = m ? JSON.parse(m[0]) : {};
  } catch {
    p = {};
  }
  const side = ["front", "back"].includes(p.side) ? p.side : "unknown";
  const out: IdCheck = {
    is_ugandan_national_id: !!p.is_ugandan_national_id,
    side,
    looks_original: !!p.looks_original,
    nin: typeof p.nin === "string" ? p.nin.replace(/\s/g, "").toUpperCase() : null,
    name: typeof p.name === "string" ? p.name : null,
    reason: typeof p.reason === "string" ? p.reason : "Could not read the card",
    ok: false,
  };
  out.ok = out.is_ugandan_national_id && out.looks_original && (side === expectedSide || side === "unknown");
  if (!out.ok && out.is_ugandan_national_id && out.looks_original && side !== expectedSide)
    out.reason = `This looks like the ${side} — please take the ${expectedSide}.`;
  return out;
}

function decode(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) throw new Error("Bad image");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: m[1], bytes };
}

export type RegisterInput = {
  device_id: string;
  full_name: string;
  nin: string;
  primary_phone: string;
  alt_phone: string;
  address: string;
  occupation: string;
  guarantor_name: string;
  guarantor_nin: string;
  guarantor_phone: string;
  guarantor_relationship: string;
  guarantor_address: string;
  deposit_paid: number;
  images: {
    customer_photo: string;
    id_front: string;
    id_back: string;
    guarantor_photo: string;
    guarantor_id_front: string;
    guarantor_id_back: string;
    signature: string;
  };
};

export async function registerCustomer(userId: string, input: RegisterInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: device, error } = await supabaseAdmin
    .from("devices")
    .select("id, customer_name")
    .eq("id", input.device_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!device) throw new Error("Device not found");
  if (device.customer_name) throw new Error("This phone already has a customer");

  const { data: phoneTaken } = await supabaseAdmin
    .from("devices")
    .select("id")
    .eq("phone_number", input.primary_phone)
    .neq("id", input.device_id)
    .maybeSingle();
  if (phoneTaken) throw new Error("That main phone number is already the account for another phone");

  // Re-check every ID server-side — the form's checks can't be trusted alone.
  const [cf, cb, gf, gb] = await Promise.all([
    checkIdImage(input.images.id_front, "front"),
    checkIdImage(input.images.id_back, "back"),
    checkIdImage(input.images.guarantor_id_front, "front"),
    checkIdImage(input.images.guarantor_id_back, "back"),
  ]);
  const fail = [
    ["Customer ID front", cf],
    ["Customer ID back", cb],
    ["Guarantor ID front", gf],
    ["Guarantor ID back", gb],
  ].find(([, c]) => !(c as IdCheck).ok);
  if (fail) throw new Error(`${fail[0]}: ${(fail[1] as IdCheck).reason}`);
  if (cf.nin && cf.nin !== input.nin) throw new Error(`Customer NIN doesn't match the card (card shows ${cf.nin})`);
  if (gf.nin && gf.nin !== input.guarantor_nin)
    throw new Error(`Guarantor NIN doesn't match the card (card shows ${gf.nin})`);
  if (input.nin === input.guarantor_nin) throw new Error("Guarantor must be a different person");

  const paths: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.images)) {
    const { type, bytes } = decode(v);
    const path = `${input.device_id}/${k}-${Date.now()}.${type.includes("png") ? "png" : "jpg"}`;
    const { error: upErr } = await supabaseAdmin.storage.from("kyc").upload(path, bytes, { contentType: type });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    paths[k] = path;
  }

  const { images: _i, deposit_paid, device_id, ...fields } = input;
  const { error: kErr } = await supabaseAdmin.from("customer_kyc").insert({
    device_id,
    ...fields,
    ...paths,
    id_checks: { customer_front: cf, customer_back: cb, guarantor_front: gf, guarantor_back: gb } as never,
    created_by: userId,
  });
  if (kErr) throw new Error(kErr.message);

  // Deposit reduces the balance but buys NO days — paid time starts at zero.
  const { error: uErr } = await supabaseAdmin
    .from("devices")
    .update({
      customer_name: input.full_name,
      phone_number: input.primary_phone,
      deposit_paid,
      amount_paid: deposit_paid,
      paid_until: addDays(new Date(), 0).toISOString(),
      lock_override: "auto",
    })
    .eq("id", device_id);
  if (uErr) throw new Error(uErr.message);
  return { ok: true };
}

export async function getKyc(deviceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("customer_kyc").select("*").eq("device_id", deviceId).maybeSingle();
  if (!data) return null;
  const keys = ["customer_photo", "id_front", "id_back", "guarantor_photo", "guarantor_id_front", "guarantor_id_back", "signature"] as const;
  const urls: Record<string, string | null> = {};
  for (const k of keys) {
    const p = (data as any)[k];
    urls[k] = p ? (await supabaseAdmin.storage.from("kyc").createSignedUrl(p, 3600)).data?.signedUrl ?? null : null;
  }
  return { ...data, urls };
}

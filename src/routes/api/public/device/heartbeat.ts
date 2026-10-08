import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  imei: z.string().trim().regex(/^[0-9]{14,17}$/),
  secret: z.string().trim().min(16).max(64),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/public/device/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = schema.parse(await request.json());
        } catch {
          return json({ error: "invalid_request" }, 400);
        }

        const { deviceHeartbeat } = await import("@/lib/devices.server");
        const result = await deviceHeartbeat(parsed.imei, parsed.secret);
        if (!result) return json({ error: "unauthorized" }, 401);

        return json({
          locked: result.locked,
          balance: result.balance,
          paid_until: result.paid_until,
          message: result.message,
          customer_name: result.customer_name,
          frp_account_id: result.frp_account_id,
          fully_paid: result.fully_paid,
          lock_at: result.lock_at,
          checked_at: new Date().toISOString(),
        });
      },
    },
  },
});

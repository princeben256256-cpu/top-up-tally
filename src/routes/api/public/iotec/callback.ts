import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/public/iotec/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const { handleIotecCallback } = await import("@/lib/iotec.server");
        const result = await handleIotecCallback(payload as Record<string, any>);
        return json(result, result.ok ? 200 : 400);
      },
    },
  },
});

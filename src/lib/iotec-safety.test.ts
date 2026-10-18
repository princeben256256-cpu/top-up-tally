import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks }));
import { applySuccessfulIntent, handleIotecCallback } from "./iotec.server";

describe("payment callback safety", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("never trusts a callback claiming success for a failed provider transaction", async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn()
      .mockResolvedValueOnce({ data: { id: "intent", external_id: "payment-test", status: "failed", applied: false, device_id: "device", amount: 2000 }, error: null })
      .mockResolvedValueOnce({ data: null, error: null }) };
    mocks.from.mockReturnValue(query);
    const result = await handleIotecCallback({ externalId: "payment-test", status: "successful", amount: 999999 });
    expect(result).toEqual({ ok: true, status: "failed" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("credits through the atomic service-only function", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await applySuccessfulIntent("payment-test");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_iotec_intent", { p_external_id: "payment-test" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reports credit failures instead of claiming success", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "failure" } });
    await expect(applySuccessfulIntent("payment-test")).rejects.toThrow("credit is pending");
  });
});
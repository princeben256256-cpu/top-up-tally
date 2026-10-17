import { describe, expect, it } from "vitest";
import { assertResetLockAllowed, googleAccountInfo, isGoogleAccountNumber } from "./reset-protection";

describe("reset protection safety", () => {
  it("rejects email addresses", () => {
    expect(isGoogleAccountNumber("mulikaphones@gmail.com")).toBe(false);
  });
  it("uses only Google's numeric sub, never the identity UUID", () => {
    expect(googleAccountInfo([{ provider: "google", identity_data: { sub: "not-a-number", email: "shop@example.com" } }])).toBeNull();
    expect(googleAccountInfo([{ provider: "google", identity_data: { sub: "123456789012345678901", email: "shop@example.com" } }])).toEqual({ id: "123456789012345678901", email: "shop@example.com" });
  });
  it("rejects non-Google identities", () => {
    expect(googleAccountInfo([{ provider: "email", identity_data: { sub: "123456789012345678901", email: "shop@example.com" } }])).toBeNull();
  });
  it("allows only admins to change the lock", () => {
    expect(() => assertResetLockAllowed(false, false, "")).toThrow("Only admins");
  });
  it("requires an account number before enabling", () => {
    expect(() => assertResetLockAllowed(true, true, "")).toThrow("Save the shop Gmail number");
  });
  it("allows disabling without an account number", () => {
    expect(() => assertResetLockAllowed(true, false, "")).not.toThrow();
  });
});
/** Shape validation is not proof of device compatibility or successful recovery. */
export function isGoogleAccountNumber(value: string): boolean {
  return /^[0-9]{15,25}$/.test(value);
}

export function googleAccountInfo(identities: readonly { provider: string; identity_data?: Record<string, unknown> }[] = []) {
  const google = identities.find((identity) => identity.provider === "google");
  const sub = google?.identity_data?.sub;
  const email = google?.identity_data?.email;
  if (typeof sub !== "string" || !isGoogleAccountNumber(sub) || typeof email !== "string") return null;
  return { id: sub, email };
}

export function assertResetLockAllowed(isAdmin: boolean, enabled: boolean, accountNumber: string) {
  if (!isAdmin) throw new Error("Only admins can change the reset lock");
  if (enabled && !isGoogleAccountNumber(accountNumber)) {
    throw new Error("Save the shop Gmail number in Lock app setup first");
  }
}
package app.prepaidpay.agent

/** A second SIM is allowed, but cannot substitute for the staff-approved SIM. */
object SimLockRule {
    const val SETTLE_MS = 60_000L
    fun matches(expected: String, observed: List<String>) = expected.isNotBlank() && observed.contains(expected)
    fun shouldLock(enabled: Boolean, expected: String, observed: List<String>, missingForMs: Long): Boolean =
        enabled && !matches(expected, observed) && missingForMs >= SETTLE_MS
}
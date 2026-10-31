package app.prepaidpay.agent

/** Pure preflight; API readback and physical recovery remain separate checks. */
object ResetPolicyRule {
    fun preflight(owner: Boolean, sdk: Int, accountId: String, fullyPaid: Boolean): String? {
        if (!owner) return "not_owner"
        if (sdk < 30) return "unsupported"
        if (!fullyPaid && accountId.isNotBlank() && !accountId.matches(Regex("^[0-9]{15,25}$"))) return "invalid_account"
        return null
    }
}
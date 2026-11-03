package app.prepaidpay.agent

/** Clear the persisted restriction too, so upgrading restores hotspot access. */
object HotspotPolicy {
    const val RESTRICTION = "no_config_tethering"

    fun allow(clearRestriction: (String) -> Unit) {
        clearRestriction(RESTRICTION)
    }
}
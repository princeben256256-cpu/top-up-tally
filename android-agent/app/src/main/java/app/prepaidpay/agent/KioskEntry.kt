package app.prepaidpay.agent

/** Optional notification-bar restrictions must never prevent the main lock. */
object KioskEntry {
    fun enter(
        owner: Boolean,
        start: () -> Unit,
        isLocked: () -> Boolean,
        restrictStatusBar: () -> Unit,
        failed: (Throwable) -> Unit,
    ): Boolean {
        if (!owner) return false
        return runCatching {
            start()
            val locked = isLocked()
            if (locked) runCatching { restrictStatusBar() }.onFailure(failed)
            locked
        }.onFailure(failed).getOrDefault(false)
    }
}
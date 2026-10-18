package app.prepaidpay.agent

/** Server lock wins; a cleared deadline must not invent a new offline lock. */
object OfflineLockRule {
    fun shouldLock(enrolled: Boolean, locked: Boolean, lockAt: Long, now: Long): Boolean {
        if (!enrolled) return false
        if (locked) return true
        return lockAt > 0L && now >= lockAt
    }
}
package app.prepaidpay.agent

import android.content.Context
import android.content.SharedPreferences

/** Local persisted state for the agent. */
object Prefs {
    private const val FILE = "prepaidpay_agent"
    private const val K_IMEI = "imei"
    private const val K_SECRET = "secret"
    private const val K_LOCKED = "locked"
    private const val K_MESSAGE = "message"
    private const val K_BALANCE = "balance"
    private const val K_PAID_UNTIL = "paid_until"
    private const val K_LAST_OK = "last_ok"
    private const val K_LOCK_AT = "lock_at"
    private const val K_MAX_SEEN = "max_seen"

    /** Offline grace: if the server can't be reached for this long, we lock. */
    const val OFFLINE_GRACE_MS = 48L * 60 * 60 * 1000

    private fun sp(c: Context): SharedPreferences =
        c.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun isEnrolled(c: Context) = !imei(c).isNullOrBlank() && !secret(c).isNullOrBlank()

    fun imei(c: Context): String? = sp(c).getString(K_IMEI, null)
    fun secret(c: Context): String? = sp(c).getString(K_SECRET, null)

    fun enroll(c: Context, imei: String, secret: String) =
        sp(c).edit().putString(K_IMEI, imei.trim()).putString(K_SECRET, secret.trim()).apply()

    fun saveStatus(c: Context, s: Api.Status) {
        sp(c).edit()
            .putBoolean(K_LOCKED, s.locked)
            .putString(K_MESSAGE, s.message)
            .putString(K_BALANCE, s.balance)
            .putString(K_PAID_UNTIL, s.paidUntil)
            .putLong(K_LAST_OK, System.currentTimeMillis())
            .putLong(K_LOCK_AT, s.lockAtMs)
            .apply()
        // Shop Gmail must unlock the phone after any reset until fully paid.
        DeviceOwner.applyResetProtection(c, s.frpAccountId, s.fullyPaid)
    }

    fun locked(c: Context) = sp(c).getBoolean(K_LOCKED, false)
    fun message(c: Context): String =
        sp(c).getString(K_MESSAGE, null) ?: "Please make a payment to continue using this device."
    fun balance(c: Context): String = sp(c).getString(K_BALANCE, null) ?: "—"
    fun paidUntil(c: Context): String = sp(c).getString(K_PAID_UNTIL, null) ?: "—"
    fun lastOk(c: Context) = sp(c).getLong(K_LAST_OK, 0L)

    fun lockAt(c: Context) = sp(c).getLong(K_LOCK_AT, 0L)

    /**
     * Phone clock, but it can never go backwards: winding the clock back
     * doesn't buy free time — we keep the latest time ever seen.
     */
    fun safeNow(c: Context): Long {
        val now = System.currentTimeMillis()
        val max = sp(c).getLong(K_MAX_SEEN, 0L)
        if (now > max) { sp(c).edit().putLong(K_MAX_SEEN, now).apply(); return now }
        return max
    }

    /** Milliseconds until the phone locks by its own clock, or -1 if never. */
    fun msUntilLock(c: Context): Long {
        val at = lockAt(c)
        if (at <= 0L) return -1L
        return maxOf(0L, at - safeNow(c))
    }

    /** Server is the authority; offline the phone clock locks it when paid time ends. */
    fun shouldLock(c: Context): Boolean {
        if (!isEnrolled(c)) return false
        if (locked(c)) return true
        val at = lockAt(c)
        if (at > 0L && safeNow(c) >= at) return true
        val last = lastOk(c)
        if (last == 0L) return false
        return safeNow(c) - last > OFFLINE_GRACE_MS
    }

    fun countdownText(c: Context): String {
        val ms = msUntilLock(c)
        if (ms < 0) return "Device active"
        val mins = ms / 60_000
        val d = mins / 1440; val h = (mins % 1440) / 60; val m = mins % 60
        return "Locks in " + (if (d > 0) "${d}d " else "") + "${h}h ${m}m"
    }
}

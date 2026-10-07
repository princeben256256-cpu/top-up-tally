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

    /** Server is the authority; when unreachable past the grace window we fail closed. */
    fun shouldLock(c: Context): Boolean {
        if (!isEnrolled(c)) return false
        if (locked(c)) return true
        val last = lastOk(c)
        if (last == 0L) return false
        return System.currentTimeMillis() - last > OFFLINE_GRACE_MS
    }
}

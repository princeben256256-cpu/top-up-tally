package app.prepaidpay.agent

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/** Raw ICCIDs never leave the phone; approval is explicit and server-owned. */
object SimProtection {
    private fun store(c: Context) = c.getSharedPreferences("mulika_sim", Context.MODE_PRIVATE)
    private data class Observation(val hashes: List<String>, val readable: Boolean, val owner: Boolean)

    private fun observe(c: Context): Observation {
        val owner = DeviceOwner.isDeviceOwner(c)
        if (!owner || c.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            return Observation(emptyList(), false, owner)
        return runCatching {
            val manager = c.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
            val infos = (manager.activeSubscriptionInfoList ?: emptyList()).filter {
                android.os.Build.VERSION.SDK_INT < 28 || !it.isEmbedded
            }
            val phone = c.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val absent = android.os.Build.VERSION.SDK_INT >= 26 && phone.phoneCount > 0 &&
                (0 until phone.phoneCount).all { phone.getSimState(it) == TelephonyManager.SIM_STATE_ABSENT }
            val secret = Prefs.secret(c).orEmpty()
            val serials = infos.map { it.iccId.orEmpty().trim() }
            val readable = secret.isNotBlank() && (serials.isNotEmpty() || absent) &&
                serials.all { it.matches(Regex("^[0-9]{10,32}$")) }
            val hashes = if (!readable) emptyList() else serials.map { serial ->
                MessageDigest.getInstance("SHA-256").digest((secret + ":" + serial).toByteArray(Charsets.UTF_8))
                    .joinToString("") { "%02x".format(it.toInt() and 0xff) }
            }.distinct().take(4)
            Observation(hashes, readable, owner)
        }.getOrElse { Observation(emptyList(), false, owner) }
    }

    fun savePolicy(c: Context, enabled: Boolean, expected: String, revision: String) {
        val sp = store(c)
        val changed = sp.getString("revision", "") != revision || sp.getBoolean("enabled", false) != enabled
        val edit = sp.edit().putBoolean("enabled", enabled).putString("expected", expected).putString("revision", revision)
        if (changed) edit.remove("missing_since").remove("boot_count").remove("violation")
        edit.commit()
    }

    private fun missingDuration(c: Context, matches: Boolean): Long {
        val sp = store(c)
        if (matches) { sp.edit().remove("missing_since").apply(); return 0 }
        val now = SystemClock.elapsedRealtime()
        val boot = android.provider.Settings.Global.getInt(c.contentResolver, "boot_count", 0)
        val previous = sp.getLong("missing_since", -1L)
        if (previous < 0 || previous > now || sp.getInt("boot_count", -1) != boot) {
            sp.edit().putLong("missing_since", now).putInt("boot_count", boot).commit()
            return 0
        }
        return now - previous
    }

    fun shouldLock(c: Context): Boolean {
        val sp = store(c)
        if (!sp.getBoolean("enabled", false)) return false
        val expected = sp.getString("expected", "").orEmpty()
        val observation = observe(c)
        // Radio-off, SIM PIN and redacted reads are not proof of removal.
        // They must not clear an already-confirmed violation either.
        if (!observation.readable) return sp.getBoolean("violation", false)
        val violation = SimLockRule.shouldLock(true, expected, observation.hashes,
            missingDuration(c, SimLockRule.matches(expected, observation.hashes)))
        sp.edit().putBoolean("violation", violation).apply()
        return violation
    }

    fun report(c: Context): JSONObject {
        val sp = store(c)
        val o = observe(c)
        val enabled = sp.getBoolean("enabled", false)
        val state = when {
            !o.owner -> "not_owner"
            !o.readable -> "unreadable"
            !enabled -> "off"
            SimLockRule.matches(sp.getString("expected", "").orEmpty(), o.hashes) -> "matched"
            else -> "missing"
        }
        return JSONObject().put("hashes", JSONArray(o.hashes)).put("state", state)
            .put("revision", sp.getString("revision", null)?.takeIf { it.isNotBlank() } ?: JSONObject.NULL)
    }
}
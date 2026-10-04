package app.prepaidpay.agent

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PersistableBundle

/** Reads IMEI + secret that the staff console baked into the setup QR. */
object AutoEnroll {
    fun fromIntent(context: Context, intent: Intent?): Boolean {
        val extras: PersistableBundle? = if (Build.VERSION.SDK_INT >= 33) {
            intent?.getParcelableExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE, PersistableBundle::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent?.getParcelableExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE)
        }
        val imei = extras?.getString("imei")?.trim().orEmpty()
        val secret = extras?.getString("secret")?.trim().orEmpty()
        if (!imei.matches(Regex("^[0-9]{14,17}$")) || secret.length < 16) return false
        Prefs.enroll(context, imei, secret)
        HeartbeatWorker.schedule(context)
        KeepAliveService.start(context)
        return true
    }
}

/** Android 12+: tells setup we want a fully managed (device owner) phone. */
class GetProvisioningModeActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val result = Intent().putExtra(
            DevicePolicyManager.EXTRA_PROVISIONING_MODE,
            DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE,
        )
        setResult(RESULT_OK, result)
        finish()
    }
}

/** Android 10+: runs at the end of setup — apply hardening and self-enroll. */
class PolicyComplianceActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DeviceOwner.applyBaselinePolicies(this)
        AutoEnroll.fromIntent(this, intent)
        HeartbeatWorker.schedule(this)
        setResult(RESULT_OK)
        finish()
    }
}

package app.prepaidpay.agent

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.UserManager

/**
 * Device Owner hardening. All of this only takes effect when the app was
 * provisioned as device owner (QR provisioning on a factory-fresh phone).
 */
object DeviceOwner {

    fun admin(context: Context) = ComponentName(context, AgentAdminReceiver::class.java)

    fun dpm(context: Context): DevicePolicyManager =
        context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

    fun isDeviceOwner(context: Context): Boolean =
        dpm(context).isDeviceOwnerApp(context.packageName)

    fun applyBaselinePolicies(context: Context) {
        if (!isDeviceOwner(context)) return
        val dpm = dpm(context)
        val admin = admin(context)

        runCatching {
            // The customer must not be able to remove or reset their way out.
            dpm.addUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_ADD_USER)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_DEBUGGING_FEATURES)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_UNINSTALL_APPS)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_CONFIG_TETHERING)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            dpm.setUninstallBlocked(admin, context.packageName, true)
            dpm.setStatusBarDisabled(admin, false)

            // Extra anti-bypass: no clock cheating, no sideloaded "unlock" tools,
            // no network reset. USB file transfer and airplane mode are left open
            // so the customer keeps the full phone experience.
            dpm.addUserRestriction(admin, UserManager.DISALLOW_CONFIG_DATE_TIME)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_NETWORK_RESET)
            dpm.setAutoTimeRequired(admin, true)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {

                // Phone/SIM-menu apps are allowed inside the lock so a mobile money
                // PIN prompt can still appear while the customer pays from a locked phone.
                dpm.setLockTaskPackages(admin, arrayOf(
                    context.packageName,
                    "com.android.phone", "com.android.stk", "com.android.server.telecom",
                    "com.samsung.android.app.telephonyui", "com.android.dialer",
                ))
            }
        }
    }

    /** Called only from the lock screen so the customer can't leave it. */
    fun enterKiosk(activity: android.app.Activity) {
        if (!isDeviceOwner(activity)) return
        runCatching {
            dpm(activity).setStatusBarDisabled(admin(activity), true)
            activity.startLockTask()
        }
    }

    fun exitKiosk(activity: android.app.Activity) {
        runCatching {
            activity.stopLockTask()
            if (isDeviceOwner(activity)) {
                dpm(activity).setStatusBarDisabled(admin(activity), false)
            }
        }
    }

    /**
     * After any factory reset or flash, only the shop Google account can finish
     * setup. Works even if the customer removed that account from Settings.
     * Cleared automatically once the phone is fully paid.
     */
    fun applyResetProtection(context: Context, accountId: String, fullyPaid: Boolean) {
        if (!isDeviceOwner(context)) return
        val dpm = dpm(context)
        val admin = admin(context)
        val ids = if (fullyPaid || accountId.isBlank()) emptyList() else listOf(accountId.trim())
        runCatching {
            if (Build.VERSION.SDK_INT >= 30) {
                val policy = if (ids.isEmpty()) null else
                    android.app.admin.FactoryResetProtectionPolicy.Builder()
                        .setFactoryResetProtectionAccounts(ids)
                        .setFactoryResetProtectionEnabled(true)
                        .build()
                dpm.setFactoryResetProtectionPolicy(admin, policy)
            }
        }
        // Older Android: Google Play services reads the same rule from here.
        runCatching {
            val b = android.os.Bundle()
            if (ids.isNotEmpty()) b.putStringArray("factoryResetProtectionAdmin", ids.toTypedArray())
            dpm.setApplicationRestrictions(admin, "com.google.android.gms", b)
            context.sendBroadcast(
                android.content.Intent("com.google.android.gms.auth.FRP_CONFIG_CHANGED")
                    .setPackage("com.google.android.gms")
            )
        }
    }
}

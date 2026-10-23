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

        // Let our own countdown notification show (Android 13+ hides it otherwise).
        if (android.os.Build.VERSION.SDK_INT >= 33) runCatching {
            dpm.setPermissionGrantState(
                admin, context.packageName, android.Manifest.permission.POST_NOTIFICATIONS,
                android.app.admin.DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED,
            )
        }
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
    fun enterKiosk(activity: android.app.Activity): Boolean {
        val policy = dpm(activity)
        return KioskEntry.enter(
            owner = policy.isDeviceOwnerApp(activity.packageName),
            start = {
                check(policy.isLockTaskPermitted(activity.packageName)) {
                    "Agent is not allowed to enter lock task"
                }
                activity.startLockTask()
            },
            isLocked = {
                val manager = activity.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
                manager.lockTaskModeState == android.app.ActivityManager.LOCK_TASK_MODE_LOCKED
            },
            restrictStatusBar = { policy.setStatusBarDisabled(admin(activity), true) },
            failed = { android.util.Log.w("MulikaLock", "Kiosk enforcement failed", it) },
        )
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
     * Requests Google FRP for untrusted resets on supported Android 11+ phones.
     * This does not guarantee recovery or protection against firmware flashing.
     * Removes our policy once fully paid; ordinary Google FRP can still apply.
     */
    fun applyResetProtection(context: Context, accountId: String, fullyPaid: Boolean) {
        if (!isDeviceOwner(context)) return
        val dpm = dpm(context)
        val admin = admin(context)
        // Shape validation only: the ID must come from the Google identity sub.
        val clean = accountId.trim()
        val valid = clean.matches(Regex("^[0-9]{15,25}$"))
        val ids = if (fullyPaid || !valid) emptyList() else listOf(clean)
        if (Build.VERSION.SDK_INT >= 30) {
            runCatching {
                val policy = if (ids.isEmpty()) null else
                    android.app.admin.FactoryResetProtectionPolicy.Builder()
                        .setFactoryResetProtectionAccounts(ids)
                        .setFactoryResetProtectionEnabled(true)
                        .build()
                dpm.setFactoryResetProtectionPolicy(admin, policy)
                val applied = dpm.getFactoryResetProtectionPolicy(admin)
                check(if (policy == null) applied == null else
                    applied?.isFactoryResetProtectionEnabled == true &&
                    applied.factoryResetProtectionAccounts == ids)
            }.onFailure {
                // Do not log the account ID. UnsupportedOperationException is
                // the public API's support signal; no hidden APIs/reflection.
                android.util.Log.w("MulikaFRP", "Reset protection could not be applied or read back", it)
            }
        }
        // Retire the unverified legacy enable path. Remove only our old key,
        // preserving any unrelated Play services application restrictions.
        runCatching {
            val b = dpm.getApplicationRestrictions(admin, "com.google.android.gms")
            if (b.containsKey("factoryResetProtectionAdmin")) {
                b.remove("factoryResetProtectionAdmin")
                dpm.setApplicationRestrictions(admin, "com.google.android.gms", b)
                context.sendBroadcast(
                    android.content.Intent("com.google.android.gms.auth.FRP_CONFIG_CHANGED")
                        .setPackage("com.google.android.gms")
                )
            }
        }.onFailure { android.util.Log.w("MulikaFRP", "Legacy reset-policy cleanup failed", it) }
    }
}

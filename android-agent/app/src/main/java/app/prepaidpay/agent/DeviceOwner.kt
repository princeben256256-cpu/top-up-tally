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

    data class ResetReport(val state: String, val revision: String, val sdk: Int, val owner: Boolean, val resetBlocked: Boolean) {
        fun json() = org.json.JSONObject()
            .put("state", state).put("revision", revision).put("android_sdk", sdk)
            .put("device_owner", owner).put("settings_reset_blocked", resetBlocked)
    }
    @Volatile var resetReport: ResetReport? = null
        private set

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
        // Each restriction is applied on its own so one failure (some Samsung/Tecno
        // builds reject single items) never skips the Settings-reset block.
        listOf(
            UserManager.DISALLOW_FACTORY_RESET,
            UserManager.DISALLOW_ADD_USER,
            UserManager.DISALLOW_SAFE_BOOT,
            UserManager.DISALLOW_DEBUGGING_FEATURES,
            UserManager.DISALLOW_UNINSTALL_APPS,
            UserManager.DISALLOW_CONFIG_TETHERING,
            UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA,
            UserManager.DISALLOW_CONFIG_DATE_TIME,
            UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES,
            UserManager.DISALLOW_NETWORK_RESET,
        ).forEach { r ->
            runCatching { dpm.addUserRestriction(admin, r) }
                .onFailure { android.util.Log.w("MULIKA", "restriction $r failed", it) }
        }
        runCatching { dpm.setUninstallBlocked(admin, context.packageName, true) }
        runCatching { dpm.setStatusBarDisabled(admin, false) }
        runCatching { dpm.setAutoTimeRequired(admin, true) }
        runCatching {


            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {

                // Phone/SIM-menu apps are allowed inside the lock so a mobile money
                // PIN prompt can still appear while the customer pays from a locked phone.
                dpm.setLockTaskPackages(admin, arrayOf(
                    context.packageName,
                    "com.android.phone", "com.android.stk", "com.android.server.telecom",
                    "com.samsung.android.app.telephonyui", "com.android.dialer",
                    // Settings is allowed only so the locked screen can open the
                    // Wi-Fi / mobile-data panels; the lock returns after 2 minutes.
                    "com.android.settings",
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
    fun applyResetProtection(context: Context, accountId: String, fullyPaid: Boolean, revision: String) {
        val owner = isDeviceOwner(context)
        val dpm = dpm(context)
        val admin = admin(context)
        // Shape validation only: the ID must come from the Google identity sub.
        val clean = accountId.trim()
        val resetBlocked = owner && runCatching {
            dpm.getUserRestrictions(admin).getBoolean(UserManager.DISALLOW_FACTORY_RESET)
        }.getOrDefault(false)
        fun report(state: String) {
            resetReport = if (revision.matches(Regex("^[a-f0-9]{64}$")))
                ResetReport(state, revision, Build.VERSION.SDK_INT, owner, resetBlocked) else null
        }
        val preflight = ResetPolicyRule.preflight(owner, Build.VERSION.SDK_INT, clean, fullyPaid)
        if (preflight != null) { report(preflight); return }
        val ids = if (fullyPaid || clean.isBlank()) emptyList() else listOf(clean)
        if (Build.VERSION.SDK_INT >= 30) {
            runCatching {
                val policy = if (ids.isEmpty()) null else
                    android.app.admin.FactoryResetProtectionPolicy.Builder()
                        .setFactoryResetProtectionAccounts(ids)
                        .setFactoryResetProtectionEnabled(true)
                        .build()
                dpm.setFactoryResetProtectionPolicy(admin, policy)
                val applied = dpm.getFactoryResetProtectionPolicy(admin)
                val matches = if (policy == null) applied == null else
                    applied?.isFactoryResetProtectionEnabled == true &&
                    applied.factoryResetProtectionAccounts == ids
                report(if (!matches) "mismatch" else if (policy == null) "cleared" else "accepted")
            }.onFailure {
                // Do not log the account ID. UnsupportedOperationException is
                // the public API's support signal; no hidden APIs/reflection.
                android.util.Log.w("MulikaFRP", "Reset protection could not be applied or read back", it)
                report(if (it is UnsupportedOperationException) "unsupported" else "failed")
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

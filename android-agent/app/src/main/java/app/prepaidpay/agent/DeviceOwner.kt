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
            // no network reset, no USB file tricks.
            dpm.addUserRestriction(admin, UserManager.DISALLOW_CONFIG_DATE_TIME)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_NETWORK_RESET)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_USB_FILE_TRANSFER)
            dpm.setAutoTimeRequired(admin, true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // Stops hiding offline in airplane mode to dodge the lock.
                dpm.addUserRestriction(admin, UserManager.DISALLOW_AIRPLANE_MODE)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                dpm.setLockTaskPackages(admin, arrayOf(context.packageName))
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
}

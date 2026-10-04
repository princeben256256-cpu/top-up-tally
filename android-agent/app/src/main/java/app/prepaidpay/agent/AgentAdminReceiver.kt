package app.prepaidpay.agent

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class AgentAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        DeviceOwner.applyBaselinePolicies(context)
        HeartbeatWorker.schedule(context)
    }

    /** Fired after QR / NFC device-owner provisioning completes. */
    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)
        DeviceOwner.applyBaselinePolicies(context)
        HeartbeatWorker.schedule(context)

        if (AutoEnroll.fromIntent(context, intent) || Prefs.isEnrolled(context)) {
            if (Prefs.shouldLock(context)) HeartbeatWorker.showLock(context)
            return
        }
        val launch = Intent(context, EnrollActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launch)
    }
}

package app.prepaidpay.agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        DeviceOwner.applyBaselinePolicies(context)
        HeartbeatWorker.schedule(context)
        KeepAliveService.start(context)
        if (Prefs.shouldLock(context)) HeartbeatWorker.showLock(context)
    }
}

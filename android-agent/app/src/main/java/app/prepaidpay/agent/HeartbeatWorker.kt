package app.prepaidpay.agent

import android.content.Context
import android.content.Intent
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/** Polls the server for the authoritative lock state and enforces it. */
class HeartbeatWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val ctx = applicationContext
        val imei = Prefs.imei(ctx)
        val secret = Prefs.secret(ctx)
        if (imei.isNullOrBlank() || secret.isNullOrBlank()) return@withContext Result.success()

        try {
            val status = Api.heartbeat(imei, secret)
            if (status != null) Prefs.saveStatus(ctx, status)
        } catch (_: Exception) {
            // Offline: fall through, Prefs.shouldLock() enforces the grace window.
        }

        if (Prefs.shouldLock(ctx)) showLock(ctx)
        Result.success()
    }

    companion object {
        private const val NAME = "prepaidpay-heartbeat"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }

        fun screenOn(context: Context): Boolean =
            (context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).isInteractive

        fun showLock(context: Context) {
            // Never interrupt the customer while the payment page or emergency dialer is open.
            if (PayActivity.open || LockActivity.outsideAllowed) return
            // Screen off: let the phone sleep. The lock appears the moment the
            // screen turns on (KeepAliveService listens for that).
            if (!screenOn(context)) return
            // Bring the existing lock screen forward instead of rebuilding it.
            val intent = Intent(context, LockActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            runCatching { context.startActivity(intent) }
        }
    }
}

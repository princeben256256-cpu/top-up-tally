package app.prepaidpay.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Permanent foreground notification. itel / Infinix / Tecno (Transsion) phones
 * aggressively kill background apps; a running foreground service is the
 * standard way to keep the heartbeat alive on them. It also helps on Samsung.
 */
class KeepAliveService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    private val scope = kotlinx.coroutines.CoroutineScope(
        kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO
    )
    private var loop: kotlinx.coroutines.Job? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundWithNotification()
        // Re-apply hardening and make sure the heartbeat is scheduled — this
        // service restarts if the system kills it, so it's a good watchdog.
        DeviceOwner.applyBaselinePolicies(this)
        HeartbeatWorker.schedule(this)
        if (Prefs.shouldLock(this)) HeartbeatWorker.showLock(this)
        startFastLoop()
        return START_STICKY
    }

    /** Check with the server every 20 seconds so force-lock / payments act fast. */
    private fun startFastLoop() {
        if (loop?.isActive == true) return
        loop = scope.launch {
            while (true) {
                val imei = Prefs.imei(this@KeepAliveService)
                val secret = Prefs.secret(this@KeepAliveService)
                if (!imei.isNullOrBlank() && !secret.isNullOrBlank()) {
                    val status = runCatching { Api.heartbeat(imei, secret) }.getOrNull()
                    if (status != null) Prefs.saveStatus(this@KeepAliveService, status)
                    if (Prefs.shouldLock(this@KeepAliveService)) {
                        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                            HeartbeatWorker.showLock(this@KeepAliveService)
                        }
                    }
                }
                kotlinx.coroutines.delay(20_000)
            }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun startForegroundWithNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.keepalive_channel),
                    NotificationManager.IMPORTANCE_MIN,
                ).apply { setShowBadge(false) }
            )
        }

        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, LockActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(getString(R.string.keepalive_title))
            .setContentText(getString(R.string.keepalive_text))
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(ID, notification)
        }
    }

    companion object {
        private const val ID = 1001
        private const val CHANNEL_ID = "prepaidpay_keepalive"

        fun start(context: Context) {
            if (!Prefs.isEnrolled(context)) return
            val intent = Intent(context, KeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}

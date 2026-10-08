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

    private var screenReceiver: android.content.BroadcastReceiver? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundWithNotification()
        // Re-apply hardening and make sure the heartbeat is scheduled — this
        // service restarts if the system kills it, so it's a good watchdog.
        DeviceOwner.applyBaselinePolicies(this)
        HeartbeatWorker.schedule(this)
        registerScreenReceiver()
        if (Prefs.shouldLock(this)) HeartbeatWorker.showLock(this)
        startFastLoop()
        return START_STICKY
    }

    /** When the screen turns on: show the lock at once if due, then confirm with the server. */
    private fun registerScreenReceiver() {
        if (screenReceiver != null) return
        val r = object : android.content.BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                if (Prefs.shouldLock(c)) HeartbeatWorker.showLock(c)
                scope.launch { checkOnce() }
            }
        }
        val filter = android.content.IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(r, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(r, filter)
        }
        screenReceiver = r
    }

    private suspend fun checkOnce() {
        val imei = Prefs.imei(this)
        val secret = Prefs.secret(this)
        if (imei.isNullOrBlank() || secret.isNullOrBlank()) return
        val status = runCatching { Api.heartbeat(imei, secret) }.getOrNull()
        if (status != null) Prefs.saveStatus(this, status)
        updateNotification()
        if (Prefs.shouldLock(this)) {
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                HeartbeatWorker.showLock(this@KeepAliveService)
            }
        }
    }

    /**
     * Screen on: check every 20 seconds so force-lock / payments act fast.
     * Screen off: check every 3 minutes so the phone sleeps and saves battery.
     */
    private fun startFastLoop() {
        if (loop?.isActive == true) return
        loop = scope.launch {
            while (true) {
                checkOnce()
                // Offline too: the phone clock alone triggers the lock.
                if (Prefs.shouldLock(this@KeepAliveService)) {
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                        HeartbeatWorker.showLock(this@KeepAliveService)
                    }
                }
                val on = HeartbeatWorker.screenOn(this@KeepAliveService)
                kotlinx.coroutines.delay(if (on) 20_000 else 180_000)
            }
        }
    }

    override fun onDestroy() {
        screenReceiver?.let { runCatching { unregisterReceiver(it) } }
        screenReceiver = null
        scope.cancel()
        super.onDestroy()
    }

    private fun updateNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        runCatching { nm.notify(ID, buildNotification()) }
    }

    private fun buildNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0, Intent(this, LockActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(getString(R.string.keepalive_title))
            .setContentText(Prefs.countdownText(this))
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
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

        val notification: Notification = buildNotification()

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

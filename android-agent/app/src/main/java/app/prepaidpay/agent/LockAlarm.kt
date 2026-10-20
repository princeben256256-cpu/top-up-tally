package app.prepaidpay.agent

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Wakes the phone at the exact moment paid time ends, even with no internet
 * and even if the system killed the background service.
 */
object LockAlarm {
    private fun pending(c: Context): PendingIntent = PendingIntent.getBroadcast(
        c, 77, Intent(c, LockAlarmReceiver::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    fun schedule(c: Context) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val at = Prefs.lockAt(c)
        val pi = pending(c)
        if (at <= 0L) { runCatching { am.cancel(pi) }; return }
        val canExact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        runCatching {
            when {
                canExact && Build.VERSION.SDK_INT >= 23 ->
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
                Build.VERSION.SDK_INT >= 23 ->
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
                else -> am.set(AlarmManager.RTC_WAKEUP, at, pi)
            }
        }
    }
}

class LockAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        runCatching { KeepAliveService.start(context) }
        if (Prefs.shouldLock(context)) HeartbeatWorker.showLock(context)
        else LockAlarm.schedule(context)
    }
}

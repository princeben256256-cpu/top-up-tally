package app.prepaidpay.agent

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Full-screen kiosk lock. Only "check payment" and emergency call are allowed. */
class LockActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_lock)

        DeviceOwner.enterKiosk(this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { /* swallowed */ }
        })

        render()

        findViewById<Button>(R.id.refresh).setOnClickListener { refreshNow() }
        findViewById<Button>(R.id.pay).setOnClickListener {
            startActivity(Intent(this, PayActivity::class.java))
        }
        findViewById<Button>(R.id.emergency).setOnClickListener {
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:")))
        }

        // Keep polling so a payment unlocks within seconds, not 15 minutes.
        lifecycleScope.launch {
            while (true) {
                delay(15_000)
                refreshNow()
            }
        }
    }

    private fun refreshNow() {
        val imei = Prefs.imei(this) ?: return
        val secret = Prefs.secret(this) ?: return
        lifecycleScope.launch {
            val status = withContext(Dispatchers.IO) {
                runCatching { Api.heartbeat(imei, secret) }.getOrNull()
            }
            if (status != null) Prefs.saveStatus(this@LockActivity, status)
            if (!Prefs.shouldLock(this@LockActivity)) {
                DeviceOwner.exitKiosk(this@LockActivity)
                finish()
            } else {
                render()
            }
        }
    }

    private fun render() {
        findViewById<TextView>(R.id.message).text = Prefs.message(this)
        findViewById<TextView>(R.id.balance).text = "Balance: UGX ${Prefs.balance(this)}"
        findViewById<TextView>(R.id.paidUntil).text = "Paid until: ${Prefs.paidUntil(this)}"
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Prefs.shouldLock(this) && !PayActivity.open) HeartbeatWorker.showLock(this)
    }

    override fun onPause() {
        super.onPause()
        if (Prefs.shouldLock(this) && !PayActivity.open) HeartbeatWorker.showLock(this)
    }
}

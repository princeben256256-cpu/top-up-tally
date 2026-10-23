package app.prepaidpay.agent

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Full-screen kiosk lock. Only "pay", "check payment" and emergency call are allowed. */
class LockActivity : AppCompatActivity() {

    companion object {
        /** True while the customer is in the emergency dialer — don't cover it. */
        @Volatile var outsideAllowed = false
        /** True while the lock is on screen, so nobody re-launches it on top of
         *  itself (that pause/resume loop swallowed every tap). */
        @Volatile var visible = false
    }

    private var kioskOn = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_lock)

        kioskOn = DeviceOwner.enterKiosk(this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { /* swallowed */ }
        })

        render()

        findViewById<Button>(R.id.refresh).setOnClickListener {
            android.widget.Toast.makeText(this, "Checking payment…", android.widget.Toast.LENGTH_SHORT).show()
            refreshNow(userAsked = true)
        }
        findViewById<Button>(R.id.pay).setOnClickListener {
            PayActivity.open = true
            runCatching { startActivity(Intent(this, PayActivity::class.java)) }
                .onFailure { PayActivity.open = false }
        }
        findViewById<Button>(R.id.emergency).setOnClickListener {
            outsideAllowed = true
            runCatching { startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:"))) }
                .onFailure { outsideAllowed = false }
        }

        // Poll only while the lock screen is actually visible, so a payment
        // unlocks within seconds but the phone can sleep (no polling when off).
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    delay(15_000)
                    refreshNow()
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        visible = true
    }

    override fun onResume() {
        super.onResume()
        outsideAllowed = false
        // Re-check Android enforcement when returning to an existing lock task.
        if (Prefs.shouldLock(this)) kioskOn = DeviceOwner.enterKiosk(this)
        // Back from the payment page or screen just turned on: check right away.
        refreshNow()
    }

    private fun refreshNow(userAsked: Boolean = false) {
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
                // A policy failure must not leave a visible but unenforced lock.
                if (!kioskOn) kioskOn = DeviceOwner.enterKiosk(this@LockActivity)
                render()
                if (userAsked) android.widget.Toast.makeText(
                    this@LockActivity,
                    if (status == null) "No internet — try again" else "Not paid yet. Tap Pay now.",
                    android.widget.Toast.LENGTH_LONG,
                ).show()
            }
        }
    }

    private fun render() {
        // Tell staff honestly when Android is not letting the lock block other apps.
        val warning = when {
            !DeviceOwner.isDeviceOwner(this) -> "\n\nSTAFF: full lock NOT ACTIVE (phone not set up by QR)."
            !kioskOn -> "\n\nSTAFF: full lock failed to start."
            else -> ""
        }
        findViewById<TextView>(R.id.message).text = Prefs.message(this) + warning
        findViewById<TextView>(R.id.balance).text = "Balance: UGX ${Prefs.balance(this)}"
        findViewById<TextView>(R.id.paidUntil).text = "Paid until: ${Prefs.paidUntil(this)}"
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        relock()
    }

    // onStop, not onPause: Android pauses the lock just to deliver its own
    // relaunch, and relocking there looped forever and froze the buttons.
    override fun onStop() {
        super.onStop()
        visible = false
        relock()
    }

    /** Come back to the front if the customer escaped — but never while paying,
     *  dialling an emergency number, or when the screen is simply turning off. */
    private fun relock() {
        if (isFinishing) return
        if (PayActivity.open || outsideAllowed) return
        if (!HeartbeatWorker.screenOn(this)) return
        if (Prefs.shouldLock(this)) HeartbeatWorker.showLock(this)
    }
}

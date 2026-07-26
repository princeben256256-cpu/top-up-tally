package app.prepaidpay.agent

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Point-of-sale screen. The dealer types the IMEI + enrollment secret from the
 * staff console once, then hands the phone to the customer.
 */
class EnrollActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_enroll)

        DeviceOwner.applyBaselinePolicies(this)

        val imeiField = findViewById<EditText>(R.id.imei)
        val secretField = findViewById<EditText>(R.id.secret)
        val statusView = findViewById<TextView>(R.id.status)
        val button = findViewById<Button>(R.id.enroll)

        statusView.text = buildString {
            append(if (DeviceOwner.isDeviceOwner(this@EnrollActivity)) "Device owner: ACTIVE" else "Device owner: NOT ACTIVE (provision by QR)")
            append("\nServer: ").append(BuildConfig.API_BASE)
        }

        Prefs.imei(this)?.let { imeiField.setText(it) }

        button.setOnClickListener {
            val imei = imeiField.text.toString().trim()
            val secret = secretField.text.toString().trim()
            if (!imei.matches(Regex("^[0-9]{14,17}$"))) {
                Toast.makeText(this, "IMEI must be 14–17 digits", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            if (secret.length < 16) {
                Toast.makeText(this, "Enrollment secret looks too short", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            button.isEnabled = false
            lifecycleScope.launch {
                val result = withContext(Dispatchers.IO) {
                    runCatching { Api.heartbeat(imei, secret) }
                }
                button.isEnabled = true
                val status = result.getOrNull()
                when {
                    result.isFailure -> Toast.makeText(
                        this@EnrollActivity,
                        "Network error: ${result.exceptionOrNull()?.message}",
                        Toast.LENGTH_LONG,
                    ).show()

                    status == null -> Toast.makeText(
                        this@EnrollActivity,
                        "Rejected: IMEI or secret is wrong",
                        Toast.LENGTH_LONG,
                    ).show()

                    else -> {
                        Prefs.enroll(this@EnrollActivity, imei, secret)
                        Prefs.saveStatus(this@EnrollActivity, status)
                        HeartbeatWorker.schedule(this@EnrollActivity)
                        Toast.makeText(
                            this@EnrollActivity,
                            "Enrolled for ${status.customerName}",
                            Toast.LENGTH_LONG,
                        ).show()
                        if (Prefs.shouldLock(this@EnrollActivity)) {
                            HeartbeatWorker.showLock(this@EnrollActivity)
                        }
                        finish()
                    }
                }
            }
        }
    }
}

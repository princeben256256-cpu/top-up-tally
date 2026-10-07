package app.prepaidpay.agent

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Talks to the PrepaidPay lock API. The server is always the authority. */
object Api {

    data class Status(
        val locked: Boolean,
        val message: String,
        val balance: String,
        val paidUntil: String,
        val customerName: String,
        val frpAccountId: String = "",
        val fullyPaid: Boolean = false,
    )

    private const val HEARTBEAT_PATH = "/api/public/device/heartbeat"

    /** Returns null on auth failure, throws on network/server error. */
    fun heartbeat(imei: String, secret: String): Status? {
        val url = URL(BuildConfig.API_BASE + HEARTBEAT_PATH)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15000
            readTimeout = 15000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }
        try {
            val body = JSONObject()
                .put("imei", imei)
                .put("secret", secret)
                .toString()
            conn.outputStream.use { it.write(body.toByteArray()) }

            val code = conn.responseCode
            if (code == 401 || code == 403) return null
            if (code !in 200..299) {
                val err = conn.errorStream?.bufferedReader()?.readText().orEmpty()
                throw RuntimeException("heartbeat failed [$code]: $err")
            }

            val json = JSONObject(conn.inputStream.bufferedReader().readText())
            return Status(
                locked = json.optBoolean("locked", false),
                message = json.optString("message", ""),
                balance = json.optString("balance", "0"),
                paidUntil = json.optString("paid_until", ""),
                customerName = json.optString("customer_name", ""),
                frpAccountId = json.optString("frp_account_id", ""),
                fullyPaid = json.optBoolean("fully_paid", false),
            )
        } finally {
            conn.disconnect()
        }
    }

    fun payUrl(imei: String) = BuildConfig.API_BASE + "/pay?imei=" + imei
}

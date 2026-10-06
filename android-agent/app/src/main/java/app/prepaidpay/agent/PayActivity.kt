package app.prepaidpay.agent

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

/** Built-in customer payment page — no second app needed. The lock never covers it. */
class PayActivity : AppCompatActivity() {

    companion object { @Volatile var open = false }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        open = true
        val web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.webViewClient = object : WebViewClient() {
            // Stay on our own site only.
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean =
                !req.url.toString().startsWith(BuildConfig.API_BASE)
        }
        val imei = Prefs.imei(this).orEmpty()
        if (savedInstanceState == null) {
            web.loadUrl(BuildConfig.API_BASE + "/pay?imei=" + imei)
        } else {
            web.restoreState(savedInstanceState)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })
    }

    override fun onResume() {
        super.onResume()
        // Mobile money PIN prompts pause this page; keep the lock away meanwhile.
        open = true
    }

    override fun onDestroy() {
        // Only a real close brings the lock back (not a screen rotation).
        val closing = isFinishing && !isChangingConfigurations
        if (closing) open = false
        super.onDestroy()
        if (closing && Prefs.shouldLock(this)) HeartbeatWorker.showLock(this)
    }
}

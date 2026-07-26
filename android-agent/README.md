# PrepaidPay Lock Agent (Android Device Owner)

Native agent that makes the phone genuinely unusable until the customer pays.
It is **not** a Median/Capacitor wrapper — it uses `DevicePolicyManager` in
**Device Owner** mode, which is the only Android API that can't be bypassed by
the user.

## What it enforces

- Cannot be uninstalled (`setUninstallBlocked` + `DISALLOW_UNINSTALL_APPS`)
- Factory reset, safe boot, USB debugging and extra users blocked
- Kiosk lock screen via `startLockTask()` — home/recents/back do nothing
- Re-locks on boot (`BOOT_COMPLETED`) and whenever the lock screen is paused
- Server is the only authority: it polls
  `POST https://top-up-tally.lovable.app/api/public/device/heartbeat`
  with `{ imei, secret }`
- **Fails closed**: if the server can't be reached for 48h (airplane mode, SIM
  removed), the phone locks anyway (`Prefs.OFFLINE_GRACE_MS`)

## Build the APK (no computer needed)

1. Connect this project to GitHub (Lovable editor → **+** → GitHub → Connect).
2. GitHub → **Actions** → **Build Lock Agent APK** → **Run workflow**.
3. Download the `prepaidpay-lock-agent` artifact. It contains:
   - `app-debug.apk` — for testing
   - `app-release-unsigned.apk` — sign this for production
   - `checksum.txt` — the `PACKAGE_CHECKSUM` needed for QR provisioning

## Deploying to a customer phone (point of sale)

The phone must be **factory fresh** (or factory reset). On the very first
"Welcome" screen, tap the same spot 6 times → the camera opens → scan a QR
containing:

```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
    "app.prepaidpay.agent/app.prepaidpay.agent.AgentAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":
    "<PACKAGE_CHECKSUM from checksum.txt>",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
    "https://<where you host the signed apk>/prepaidpay-agent.apk",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
  "android.app.extra.PROVISIONING_WIFI_SSID": "<shop wifi>",
  "android.app.extra.PROVISIONING_WIFI_PASSWORD": "<shop wifi password>"
}
```

Android downloads the APK, verifies the checksum, and installs it as device
owner. When provisioning finishes, the enrollment screen opens: type the
**IMEI** and the device's **enrollment secret** (both shown on the device page
in the staff console at `/admin`), tap **Enroll this device**, then hand the
phone over.

## Signing for production

Generate a keystore once, add it as GitHub repository secrets, and add a
`signingConfigs` block to `app/build.gradle.kts`. Until then use the debug APK
for testing only — device-owner provisioning by QR requires the checksum of the
exact APK you host.

## Changing the server URL

`API_BASE` in `android-agent/app/build.gradle.kts`. Update it if you connect a
custom domain.

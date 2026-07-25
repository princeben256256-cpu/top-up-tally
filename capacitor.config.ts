import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper for the PrepaidPay customer app.
 *
 * This app is server-rendered (TanStack Start), so the APK loads the hosted
 * site instead of bundling static files. `server.url` must point at a published
 * Lovable URL — otherwise the WebView shows the offline page in mobile/www.
 *
 * NOTE: this is the *customer* app (check balance, due date, lock status).
 * It is NOT the Device Owner lock agent — a normal installable app cannot
 * block the phone. See PrepaidPay_Android_Lock_Agent_Spec.md for that piece.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.prepaidpay",
  appName: "PrepaidPay",
  webDir: "mobile/www",
  server: {
    url: "https://project--7e194fb2-0104-4881-941c-1786b5ed36d5.lovable.app",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0b0b0f",
      showSpinner: false,
    },
  },
};

export default config;

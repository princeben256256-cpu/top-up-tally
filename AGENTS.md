<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Customer KYC (photos, ID scans, signature) lives in customer_kyc + private "kyc" bucket, written only by a staff-checked server function that re-verifies IDs with AI — never trust client checks.
- Deposits reduce the balance but never add paid days; only later payments buy days.
- Lock app: never show/relaunch the lock while the screen is off or the pay page/emergency dialer is open; it appears on screen-on instead. Why: lets the phone sleep and keeps payment uninterrupted.
- Reset-lock requests are admin-checked server-side; Google account extraction accepts only the Google identity's numeric sub, never identity UUIDs. Why: reject wrong identifiers and unauthorized policy changes.
- Reset-lock UI separates requested configuration from device-reported Android readback; reports are service-written after enrollment-secret authentication, matched to a hashed configuration revision and expire after two minutes. Why: stale/account-changed reports and API acceptance must never imply proven post-reset Gmail enforcement.
- Android reset policy uses only public Android 11+ policy APIs with readback and logged failures; no legacy enable or hidden support APIs. Why: unsupported methods can break builds or silently claim protection.
- Mobile-money callbacks are hints only; confirm status against the stored transaction through IoTec and credit using a service-only atomic database function. Why: forged callbacks and partial writes must not change balances.
- Offline enforcement uses the cached server lock and deadline; a cleared deadline never acquires a grace-period lock. Why: fully paid and force-unlocked phones must remain usable offline.
- Staff installation is handled by one root-mounted control on staff pages, using the browser install prompt with manual home-screen fallback; standalone windows hide it to avoid duplicate installation prompts.
- Android kiosk entry verifies LOCK_TASK_MODE_LOCKED, retries on return, and treats status-bar restrictions independently; report owner/enforcement failures rather than claiming a visible app equals a device lock.
- Customer countdown and heartbeat use the shared lock deadline rules; staff/customer lock labels describe requested instructions, never unreported physical enforcement. Why: overrides must not show stale timers and check-ins cannot prove kiosk containment.

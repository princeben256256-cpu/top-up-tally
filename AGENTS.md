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
- Reset-lock UI reports requested configuration, not confirmed hardware protection. Why: successful saving or heartbeat does not prove post-reset recovery.
- Android reset policy uses only public Android 11+ policy APIs with readback and logged failures; no legacy enable or hidden support APIs. Why: unsupported methods can break builds or silently claim protection.

# Fix the locked-phone payment button

## Change
- Mark the payment screen as opening before Android leaves the lock screen, preventing the lock from immediately covering it again.
- Keep the phone locked if the payment screen cannot open.

## Verify
- Check the Android source and current project build status.

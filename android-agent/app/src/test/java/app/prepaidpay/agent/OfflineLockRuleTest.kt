package app.prepaidpay.agent

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OfflineLockRuleTest {
    @Test fun fullyPaidOrForcedUnlockHasNoOfflineDeadline() {
        assertFalse(OfflineLockRule.shouldLock(true, false, 0L, 49L * 60 * 60 * 1000))
    }
    @Test fun unpaidPhoneLocksExactlyAtSavedDeadline() {
        assertFalse(OfflineLockRule.shouldLock(true, false, 1000L, 999L))
        assertTrue(OfflineLockRule.shouldLock(true, false, 1000L, 1000L))
    }
    @Test fun forcedLockRemainsLockedOffline() {
        assertTrue(OfflineLockRule.shouldLock(true, true, 0L, 1000L))
    }
    @Test fun unenrolledPhoneIsNotLocked() {
        assertFalse(OfflineLockRule.shouldLock(false, true, 1000L, 2000L))
    }
}
package app.prepaidpay.agent

import org.junit.Assert.*
import org.junit.Test

class SimLockRuleTest {
    @Test fun registeredSimAllowsAnotherSimAlongsideIt() {
        assertFalse(SimLockRule.shouldLock(true, "approved", listOf("other", "approved"), 120_000))
    }
    @Test fun removalLocksAfterRadioSettlesOffline() {
        assertFalse(SimLockRule.shouldLock(true, "approved", emptyList(), 59_999))
        assertTrue(SimLockRule.shouldLock(true, "approved", emptyList(), 60_000))
    }
    @Test fun replacementCannotBecomeApprovedAutomatically() {
        assertTrue(SimLockRule.shouldLock(true, "approved", listOf("replacement"), 60_000))
    }
    @Test fun disabledOrReleasedPolicyNeverLocks() {
        assertFalse(SimLockRule.shouldLock(false, "approved", emptyList(), 120_000))
    }
    @Test fun confirmedAbsenceRemainsLocked() {
        assertTrue(SimLockRule.shouldLock(true, "approved", emptyList(), 120_000))
    }
    @Test fun unknownRadioNeverInventsOrClearsAViolation() {
        assertFalse(SimLockRule.shouldLock(true, "approved", emptyList(), 120_000, false, false))
        assertTrue(SimLockRule.shouldLock(true, "approved", emptyList(), 0, false, true))
    }
}
package app.prepaidpay.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KioskEntryTest {
    @Test fun statusBarFailureDoesNotPreventFullPhoneLock() {
        val calls = mutableListOf<String>()
        assertTrue(KioskEntry.enter(true,
            { calls.add("start") }, { calls.add("verify"); true },
            { calls.add("bar"); throw SecurityException("unsupported") },
            { calls.add("failure") }))
        assertEquals(listOf("start", "verify", "bar", "failure"), calls)
    }

    @Test fun appWithoutDeviceOwnerCannotClaimFullPhoneLock() {
        var calls = 0
        assertFalse(KioskEntry.enter(false, { calls++ }, { calls++; true }, { calls++ }, { calls++ }))
        assertEquals(0, calls)
    }

    @Test fun screenPinningIsNotFullPhoneLock() {
        assertFalse(KioskEntry.enter(true, {}, { false }, { throw AssertionError("must not run") }, {}))
    }

    @Test fun failedStartIsReportedAndNotClaimedAsLocked() {
        var failures = 0
        assertFalse(KioskEntry.enter(true, { throw SecurityException("denied") },
            { throw AssertionError("must not run") }, {}, { failures++ }))
        assertEquals(1, failures)
    }
}
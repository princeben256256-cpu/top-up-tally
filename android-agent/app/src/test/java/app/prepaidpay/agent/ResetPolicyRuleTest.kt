package app.prepaidpay.agent

import org.junit.Assert.*
import org.junit.Test

class ResetPolicyRuleTest {
    @Test fun requiresDeviceOwner() { assertEquals("not_owner", ResetPolicyRule.preflight(false, 35, "109240451316663629369", false)) }
    @Test fun requiresAndroid11() { assertEquals("unsupported", ResetPolicyRule.preflight(true, 29, "109240451316663629369", false)) }
    @Test fun rejectsEmail() { assertEquals("invalid_account", ResetPolicyRule.preflight(true, 35, "mulikaphones@gmail.com", false)) }
    @Test fun acceptsNumericGoogleId() { assertNull(ResetPolicyRule.preflight(true, 30, "109240451316663629369", false)) }
    @Test fun allowsClearingAfterPayoff() { assertNull(ResetPolicyRule.preflight(true, 35, "", true)) }
}
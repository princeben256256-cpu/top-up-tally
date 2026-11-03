package app.prepaidpay.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class HotspotPolicyTest {
    @Test fun upgradeClearsExistingHotspotBlockWithoutRemovingSecurityRestrictions() {
        val restrictions = mutableSetOf("no_config_tethering", "no_factory_reset", "no_uninstall_apps")
        HotspotPolicy.allow { restrictions.remove(it) }
        assertFalse(restrictions.contains("no_config_tethering"))
        assertEquals(setOf("no_factory_reset", "no_uninstall_apps"), restrictions)
    }
}
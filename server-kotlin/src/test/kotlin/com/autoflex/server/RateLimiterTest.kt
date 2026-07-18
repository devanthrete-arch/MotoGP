package com.autoflex.server

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RateLimiterTest {
    @Test
    fun `blocks after limit and resets after window`() {
        var now = 1_000L
        val limiter = RateLimiter(maxEvents = 2, windowMillis = 1_000) { now }

        assertTrue(limiter.allow("user"))
        assertTrue(limiter.allow("user"))
        assertFalse(limiter.allow("user"))

        now = 2_001L
        assertTrue(limiter.allow("user"))
    }
}

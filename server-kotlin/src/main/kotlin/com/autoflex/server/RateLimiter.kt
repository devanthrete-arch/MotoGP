package com.autoflex.server

class RateLimiter(
    private val maxEvents: Int,
    private val windowMillis: Long,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val buckets = mutableMapOf<String, MutableList<Long>>()

    @Synchronized
    fun allow(key: String): Boolean {
        val cutoff = now() - windowMillis
        val events = buckets.getOrPut(key) { mutableListOf() }
        events.removeAll { it <= cutoff }
        if (events.size >= maxEvents) return false
        events += now()
        return true
    }
}

package com.autoflex.server

import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SeedTest {
    @Test
    fun `seed creates a useful starter garage once`() {
        val path = Files.createTempDirectory("autoflex-seed-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            seed(database)
            seed(database)

            val (posts, comments) = database.stats()
            val models = database.listModels()
            val nexonPosts = database.listPosts(null, null, null, "latest", 20, 0, model = "Nexon")
            val fix = nexonPosts.first { it.knowledgeLabel == "Fix" }

            assertEquals(8, posts)
            assertEquals(3, comments)
            assertTrue(models.any { it.model == "Nexon" && it.knownIssueCount == 1 && it.fixCount == 1 })
            assertTrue(models.any { it.model == "Creta" && it.costNoteCount == 1 })
            assertTrue(fix.isPinned)
            assertEquals(2, fix.fixConfirmationCount)
            assertEquals(1, fix.helpfulCount)
        }
    }
}

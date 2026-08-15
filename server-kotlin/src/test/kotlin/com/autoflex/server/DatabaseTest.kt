package com.autoflex.server

import com.autoflex.shared.PostDraft
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class DatabaseTest {
    @Test
    fun `post ownership and comments survive the Kotlin migration`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val id = database.createPost(PostDraft(title = "Title", body = "Body"), "secret")
            assertTrue(database.ownsPost(id, "secret"))
            assertFalse(database.ownsPost(id, "wrong"))
            assertNotNull(database.addComment(id, "Driver", "Useful post"))
            assertEquals(1, database.getPost(id, incrementViews = false)?.comments?.size)
        }
    }

    @Test
    fun `post reports are stored for moderation`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val id = database.createPost(PostDraft(title = "Title", body = "Body"), "secret")

            assertNotNull(database.reportPost(id, "Reader", "Spam"))
            assertEquals(1, database.reportCount(id))
            assertEquals(null, database.reportPost(404, "Reader", "Spam"))
        }
    }

    @Test
    fun `product feedback is stored for the product loop`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val id = database.addFeedback("Priyansh", "Model pages need city filters", "#models", "1234567890abcdef")

            val feedback = database.listFeedback(limit = 10, offset = 0).single()

            assertEquals(id, feedback.id)
            assertEquals("Priyansh", feedback.name)
            assertEquals("Model pages need city filters", feedback.message)
            assertEquals("#models", feedback.context)
        }
    }

    @Test
    fun `client errors are stored for staging QA`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val id = database.addClientError("Boom", "/assets/app.js", "stack", "#post-1", "1234567890abcdef")

            val error = database.listClientErrors(limit = 10, offset = 0).single()

            assertEquals(id, error.id)
            assertEquals("Boom", error.message)
            assertEquals("/assets/app.js", error.source)
            assertEquals("stack", error.stack)
            assertEquals("#post-1", error.path)
        }
    }

    @Test
    fun `reports can be listed for admin review`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val id = database.createPost(PostDraft(title = "Suspicious post", body = "Body"), "secret")
            assertNotNull(database.reportPost(id, "Reader", "Spam link"))

            val report = database.listReports(limit = 10, offset = 0).single()

            assertEquals(id, report.postId)
            assertEquals("Suspicious post", report.postTitle)
            assertEquals("Reader", report.reporter)
            assertEquals("Spam link", report.reason)
        }
    }

    @Test
    fun `posts can be listed in pages`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            repeat(3) { index ->
                database.createPost(PostDraft(title = "Title $index", body = "Body"), "secret-$index")
            }

            val firstPage = database.listPosts(null, null, null, "latest", limit = 2, offset = 0)
            val secondPage = database.listPosts(null, null, null, "latest", limit = 2, offset = 2)

            assertEquals(2, firstPage.size)
            assertEquals(1, secondPage.size)
        }
    }

    @Test
    fun `ownership details create model pages from posts`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val nexon = PostDraft(
                title = "Nexon 45k km review",
                body = "Useful notes",
                brand = "Tata",
                model = "Nexon",
                knowledgeLabel = "Known issue",
                variant = "XZ+ Diesel",
                city = "Pune",
                odometerKm = 45_000,
            )
            database.createPost(nexon, "secret")
            database.createPost(PostDraft(title = "Nexon fix", body = "Body", brand = "Tata", model = "Nexon", knowledgeLabel = "Fix"), "secret-fix")
            database.createPost(PostDraft(title = "Nexon cost", body = "Body", brand = "Tata", model = "Nexon", knowledgeLabel = "Cost note"), "secret-cost")
            database.createPost(PostDraft(title = "City review", body = "Body", brand = "Honda", model = "City"), "secret-2")

            val models = database.listModels()
            val tata = models.first { it.brand == "Tata" && it.model == "Nexon" }
            val posts = database.listPosts(null, null, null, "latest", limit = 10, offset = 0, model = "Nexon")
            val post = database.getPost(posts.first { it.title == "Nexon 45k km review" }.id, incrementViews = false)!!

            assertEquals(3, tata.postCount)
            assertEquals(1, tata.knownIssueCount)
            assertEquals(1, tata.fixCount)
            assertEquals(1, tata.costNoteCount)
            assertEquals(3, posts.size)
            assertEquals("Known issue", post.knowledgeLabel)
            assertEquals("XZ+ Diesel", post.variant)
            assertEquals("Pune", post.city)
            assertEquals(45_000, post.odometerKm)
        }
    }

    @Test
    fun `fix confirmations are counted once per actor token`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val fixId = database.createPost(
                PostDraft(title = "Nexon rattle fix", body = "Tighten the bracket", brand = "Tata", model = "Nexon", knowledgeLabel = "Fix"),
                "secret",
            )
            val noteId = database.createPost(
                PostDraft(title = "Nexon note", body = "General observation", brand = "Tata", model = "Nexon"),
                "secret-2",
            )

            assertEquals(1, database.confirmFix(fixId, "1234567890abcdef"))
            assertEquals(1, database.confirmFix(fixId, "1234567890abcdef"))
            assertEquals(2, database.confirmFix(fixId, "abcdef1234567890"))
            assertEquals(null, database.confirmFix(noteId, "1234567890abcdef"))
            assertEquals(2, database.getPost(fixId, incrementViews = false)?.fixConfirmationCount)
            assertEquals(2, database.listPosts(null, null, null, "latest", 10, 0, model = "Nexon").first { it.id == fixId }.fixConfirmationCount)
        }
    }

    @Test
    fun `quality signals are counted once per actor and posts can be pinned`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val id = database.createPost(
                PostDraft(title = "Nexon service note", body = "Changed mounts", brand = "Tata", model = "Nexon"),
                "secret",
            )

            assertEquals(1, database.addQualitySignal(id, "1234567890abcdef", "helpful")?.helpfulCount)
            assertEquals(1, database.addQualitySignal(id, "1234567890abcdef", "helpful")?.helpfulCount)
            assertEquals(2, database.addQualitySignal(id, "abcdef1234567890", "helpful")?.helpfulCount)
            assertEquals(1, database.addQualitySignal(id, "token123456789000", "stale")?.staleCount)
            assertEquals(true, database.setPinned(id, true)?.isPinned)

            val detail = database.getPost(id, incrementViews = false)!!
            val summary = database.listPosts(null, null, null, "latest", 10, 0).single()

            assertEquals(2, detail.helpfulCount)
            assertEquals(1, detail.staleCount)
            assertTrue(detail.isPinned)
            assertEquals(2, summary.helpfulCount)
            assertEquals(1, summary.staleCount)
            assertTrue(summary.isPinned)
            assertEquals(null, database.addQualitySignal(404, "1234567890abcdef", "helpful"))
        }
    }

    @Test
    fun `posts can be saved and unsaved by token`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val id = database.createPost(PostDraft(title = "Title", body = "Body"), "secret")
            val token = "1234567890abcdef"

            assertTrue(database.savePost(id, token))
            assertEquals(listOf(id), database.listSavedPosts(token, limit = 10, offset = 0).map { it.id })

            database.unsavePost(id, token)
            assertTrue(database.listSavedPosts(token, limit = 10, offset = 0).isEmpty())
            assertFalse(database.savePost(404, token))
        }
    }

    @Test
    fun `profiles can be recovered by hashed code`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            database.createProfile("Priyansh", "1234567890abcdef", "hashed-code")

            val profile = database.recoverProfile("hashed-code")

            assertEquals("Priyansh", profile?.displayName)
            assertEquals("1234567890abcdef", profile?.profileToken)
        }
    }

    @Test
    fun `profile token can own posts across browsers`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val profileToken = "1234567890abcdef"
            val id = database.createPost(PostDraft(title = "Title", body = "Body"), "edit-token", profileToken)

            assertTrue(database.ownsPost(id, "", profileToken))
            assertTrue(database.ownsPost(id, "edit-token", ""))
            assertFalse(database.ownsPost(id, "", "wrong-profile-token"))
        }
    }

    @Test
    fun `deleting a profile removes its saved posts owned posts and recovery`() {
        val path = Files.createTempDirectory("autoflex-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            val token = "1234567890abcdef"
            val id = database.createPost(PostDraft(title = "Title", body = "Body"), "secret")
            val ownedId = database.createPost(PostDraft(title = "Owned", body = "Body"), "secret-2", token)
            database.createProfile("Priyansh", token, "hashed-code")
            assertTrue(database.savePost(id, token))

            database.deleteProfile(token)

            assertTrue(database.listSavedPosts(token, limit = 10, offset = 0).isEmpty())
            assertEquals(null, database.getPost(ownedId, incrementViews = false))
            assertEquals(null, database.recoverProfile("hashed-code"))
        }
    }
}

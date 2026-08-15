package com.autoflex.server

import com.autoflex.shared.PostDraft
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AdminRoutesTest {
    @Test
    fun `admin can dismiss reports and remove reported posts`() = testApplication {
        val path = Files.createTempDirectory("autoflex-admin-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            application { autoflexModule(database) }
            val postId = database.createPost(PostDraft(title = "Spam", body = "Bad link"), "secret")
            val reportId = database.reportPost(postId, "Reader", "Spam")!!

            assertEquals(HttpStatusCode.Unauthorized, client.delete("/api/admin/reports/$reportId").status)
            assertEquals(
                HttpStatusCode.OK,
                client.delete("/api/admin/reports/$reportId") { parameter("admin_token", "dev-admin") }.status,
            )
            assertEquals(0, database.reportCount(postId))

            database.reportPost(postId, "Reader", "Still spam")
            assertEquals(
                HttpStatusCode.OK,
                client.delete("/api/admin/posts/$postId") { parameter("admin_token", "dev-admin") }.status,
            )
            assertEquals(null, database.getPost(postId, incrementViews = false))
            assertEquals(HttpStatusCode.NotFound, client.get("/api/posts/$postId").status)
        }
    }

    @Test
    fun `admin can block reported post owner from future community writes`() = testApplication {
        val path = Files.createTempDirectory("autoflex-admin-block-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            application { autoflexModule(database) }
            val actorToken = "1234567890abcdef"
            val postId = database.createPost(PostDraft(title = "Spam", body = "Bad link"), "secret", actorToken)
            database.reportPost(postId, "Reader", "Spam")!!

            assertEquals(
                HttpStatusCode.OK,
                client.put("/api/admin/posts/$postId/block-owner") {
                    parameter("admin_token", "dev-admin")
                    contentType(ContentType.Application.Json)
                    setBody("""{"reason":"Spam"}""")
                }.status,
            )

            assertTrue(database.isBlocked(actorToken))
            assertTrue(database.listReports(limit = 10, offset = 0).single().ownerBlocked)
            assertEquals(HttpStatusCode.Forbidden, client.post("/api/posts") {
                contentType(ContentType.Application.Json)
                setBody("""{"title":"Again","body":"Bad","actor_token":"$actorToken"}""")
            }.status)
            assertEquals(HttpStatusCode.Forbidden, client.post("/api/posts/$postId/comments") {
                contentType(ContentType.Application.Json)
                setBody("""{"body":"Still here","actor_token":"$actorToken"}""")
            }.status)
            assertEquals(HttpStatusCode.Forbidden, client.post("/api/posts/$postId/reports") {
                contentType(ContentType.Application.Json)
                setBody("""{"reason":"Noise","actor_token":"$actorToken"}""")
            }.status)
        }
    }

    @Test
    fun `admin can pin and unpin reported posts`() = testApplication {
        val path = Files.createTempDirectory("autoflex-admin-pin-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            application { autoflexModule(database) }
            val postId = database.createPost(PostDraft(title = "Good fix", body = "Tighten bracket"), "secret")
            database.reportPost(postId, "Reader", "Needs curation")!!

            assertEquals(HttpStatusCode.Unauthorized, client.put("/api/admin/posts/$postId/pin").status)
            assertEquals(
                HttpStatusCode.OK,
                client.put("/api/admin/posts/$postId/pin") {
                    parameter("admin_token", "dev-admin")
                    contentType(ContentType.Application.Json)
                    setBody("""{"is_pinned":true}""")
                }.status,
            )
            assertTrue(database.getPost(postId, incrementViews = false)!!.isPinned)
            assertTrue(database.listReports(limit = 10, offset = 0).single().isPinned)
            assertEquals(
                HttpStatusCode.OK,
                client.put("/api/admin/posts/$postId/pin") {
                    parameter("admin_token", "dev-admin")
                    contentType(ContentType.Application.Json)
                    setBody("""{"is_pinned":false}""")
                }.status,
            )
            assertEquals(false, database.getPost(postId, incrementViews = false)!!.isPinned)
        }
    }

    @Test
    fun `feedback can be submitted and read by admin`() = testApplication {
        val path = Files.createTempDirectory("autoflex-feedback-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            application { autoflexModule(database) }

            assertEquals(HttpStatusCode.Created, client.post("/api/feedback") {
                contentType(ContentType.Application.Json)
                setBody("""{"name":"Owner","message":"Add city groups","context":"#models","actor_token":"1234567890abcdef"}""")
            }.status)
            assertEquals(HttpStatusCode.Unauthorized, client.get("/api/admin/feedback").status)
            assertEquals(HttpStatusCode.OK, client.get("/api/admin/feedback") {
                parameter("admin_token", "dev-admin")
            }.status)
            assertEquals("Add city groups", database.listFeedback(limit = 10, offset = 0).single().message)
        }
    }

    @Test
    fun `client errors can be submitted and read by admin`() = testApplication {
        val path = Files.createTempDirectory("autoflex-client-errors-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            application { autoflexModule(database) }

            assertEquals(HttpStatusCode.Created, client.post("/api/client-errors") {
                contentType(ContentType.Application.Json)
                setBody("""{"message":"Boom","source":"/assets/app.js","stack":"trace","path":"#models","actor_token":"1234567890abcdef"}""")
            }.status)
            assertEquals(HttpStatusCode.Unauthorized, client.get("/api/admin/client-errors").status)
            assertEquals(HttpStatusCode.OK, client.get("/api/admin/client-errors") {
                parameter("admin_token", "dev-admin")
            }.status)
            assertEquals("Boom", database.listClientErrors(limit = 10, offset = 0).single().message)
        }
    }
}

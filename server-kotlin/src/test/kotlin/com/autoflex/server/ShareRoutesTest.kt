package com.autoflex.server

import com.autoflex.shared.PostDraft
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ShareRoutesTest {
    @Test
    fun `post share page exposes metadata and app deep link`() = testApplication {
        val path = Files.createTempDirectory("autoflex-share-post-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            application { autoflexModule(database) }
            val postId = database.createPost(
                PostDraft(
                    title = "Nexon ownership note",
                    body = "Useful long-term owner detail",
                    brand = "Tata",
                    model = "Nexon",
                ),
                "secret",
            )

            val response = client.get("/share/posts/$postId")
            val html = response.bodyAsText()

            assertEquals(HttpStatusCode.OK, response.status)
            assertTrue(html.contains("""property="og:title" content="Nexon ownership note""""))
            assertTrue(html.contains("/#post-$postId"))
        }
    }

    @Test
    fun `model share page exposes metadata and app deep link`() = testApplication {
        val path = Files.createTempDirectory("autoflex-share-model-test").resolve("test.db")
        AutoflexDatabase(path).use { database ->
            application { autoflexModule(database) }
            database.createPost(
                PostDraft(title = "City CVT note", body = "Calm sedan", brand = "Honda", model = "City"),
                "secret",
            )

            val response = client.get("/share/models?brand=Honda&model=City")
            val html = response.bodyAsText()

            assertEquals(HttpStatusCode.OK, response.status)
            assertTrue(html.contains("""property="og:title" content="Honda City owner notebook""""))
            assertTrue(html.contains("/#model-Honda--City"))
            assertEquals(HttpStatusCode.NotFound, client.get("/share/models?brand=Tata&model=Nexon").status)
        }
    }
}

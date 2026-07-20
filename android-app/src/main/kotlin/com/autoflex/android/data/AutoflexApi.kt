package com.autoflex.android.data

import com.autoflex.android.BuildConfig
import com.autoflex.shared.Comment
import com.autoflex.shared.CommentRequest
import com.autoflex.shared.CreatePostRequest
import com.autoflex.shared.CreatePostResponse
import com.autoflex.shared.EditTokenRequest
import com.autoflex.shared.ErrorResponse
import com.autoflex.shared.LikeResponse
import com.autoflex.shared.MetaResponse
import com.autoflex.shared.Post
import com.autoflex.shared.PostsResponse
import com.autoflex.shared.ReportPostRequest
import com.autoflex.shared.ReportPostResponse
import com.autoflex.shared.StatsResponse
import com.autoflex.shared.UpdatePostRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

class AutoflexApi(
    private val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/'),
) {
    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    suspend fun meta(): MetaResponse = client.get("$baseUrl/api/meta").checkedBody()
    suspend fun stats(): StatsResponse = client.get("$baseUrl/api/stats").checkedBody()

    suspend fun posts(
        brand: String,
        topic: String,
        sort: String,
        query: String,
        limit: Int = 20,
        offset: Int = 0,
    ): PostsResponse =
        client.get("$baseUrl/api/posts") {
            if (brand != "All") parameter("brand", brand)
            if (topic != "All") parameter("topic", topic)
            parameter("sort", sort)
            if (query.isNotBlank()) parameter("q", query)
            parameter("limit", limit)
            parameter("offset", offset)
        }.checkedBody()

    suspend fun post(id: Long): Post = client.get("$baseUrl/api/posts/$id").checkedBody()

    suspend fun create(request: CreatePostRequest): CreatePostResponse = client.post("$baseUrl/api/posts") {
        contentType(ContentType.Application.Json)
        setBody(request)
    }.checkedBody()

    suspend fun update(id: Long, request: UpdatePostRequest) {
        client.put("$baseUrl/api/posts/$id") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.check()
    }

    suspend fun delete(id: Long, token: String) {
        client.delete("$baseUrl/api/posts/$id") {
            contentType(ContentType.Application.Json)
            setBody(EditTokenRequest(token))
        }.check()
    }

    suspend fun like(id: Long): LikeResponse = client.post("$baseUrl/api/posts/$id/like").checkedBody()

    suspend fun comment(id: Long, author: String, body: String): Comment =
        client.post("$baseUrl/api/posts/$id/comments") {
            contentType(ContentType.Application.Json)
            setBody(CommentRequest(author, body))
        }.checkedBody()

    suspend fun report(id: Long, reporter: String, reason: String): ReportPostResponse =
        client.post("$baseUrl/api/posts/$id/reports") {
            contentType(ContentType.Application.Json)
            setBody(ReportPostRequest(reporter, reason))
        }.checkedBody()
}

private suspend inline fun <reified T> HttpResponse.checkedBody(): T {
    check()
    return body()
}

private suspend fun HttpResponse.check() {
    if (status.value !in 200..299) {
        throw ApiException(runCatching { body<ErrorResponse>().error }.getOrDefault("Request failed"))
    }
}

class ApiException(message: String) : Exception(message)

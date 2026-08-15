package com.autoflex.server

import com.autoflex.shared.AutoflexMeta
import com.autoflex.shared.BlockTokenRequest
import com.autoflex.shared.ClientErrorRequest
import com.autoflex.shared.ClientErrorResponse
import com.autoflex.shared.ClientErrorsResponse
import com.autoflex.shared.CommentRequest
import com.autoflex.shared.CreateProfileRequest
import com.autoflex.shared.CreatePostRequest
import com.autoflex.shared.CreatePostResponse
import com.autoflex.shared.EditTokenRequest
import com.autoflex.shared.ErrorResponse
import com.autoflex.shared.FeedbackRequest
import com.autoflex.shared.FeedbackResponse
import com.autoflex.shared.FeedbacksResponse
import com.autoflex.shared.FixConfirmationRequest
import com.autoflex.shared.FixConfirmationResponse
import com.autoflex.shared.HealthResponse
import com.autoflex.shared.LikeResponse
import com.autoflex.shared.MetaResponse
import com.autoflex.shared.ModelsResponse
import com.autoflex.shared.OkResponse
import com.autoflex.shared.PinPostRequest
import com.autoflex.shared.Post
import com.autoflex.shared.PostDraft
import com.autoflex.shared.PostsResponse
import com.autoflex.shared.ProfileResponse
import com.autoflex.shared.QualitySignalRequest
import com.autoflex.shared.RecoverProfileRequest
import com.autoflex.shared.ReportPostRequest
import com.autoflex.shared.ReportPostResponse
import com.autoflex.shared.SaveTokenRequest
import com.autoflex.shared.ServiceCenterStatusResponse
import com.autoflex.shared.StatsResponse
import com.autoflex.shared.UpdatePostRequest
import com.autoflex.shared.UploadResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.receiveMultipart
import io.ktor.server.request.receive
import io.ktor.server.response.respondFile
import io.ktor.server.response.respond
import io.ktor.server.response.respondResource
import io.ktor.server.response.respondText
import io.ktor.server.http.content.staticResources
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.utils.io.readRemaining
import kotlinx.io.readByteArray
import kotlinx.serialization.json.Json
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.net.URLEncoder
import java.nio.file.Path
import java.nio.file.Files
import java.security.SecureRandom
import javax.imageio.ImageIO

fun main(args: Array<String>) {
    val database = AutoflexDatabase(Path.of(System.getenv("DATABASE_PATH") ?: "data/autoflex.db"))
    if ("--seed" in args) seed(database)
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    embeddedServer(Netty, host = "0.0.0.0", port = port) { autoflexModule(database) }.start(wait = true)
}

fun Application.autoflexModule(database: AutoflexDatabase) {
    val writeLimiter = RateLimiter(maxEvents = 30, windowMillis = 60_000)
    val adminToken = System.getenv("ADMIN_TOKEN") ?: "dev-admin"
    val appVersion = System.getenv("APP_VERSION") ?: "dev"
    val publicBaseUrl = System.getenv("PUBLIC_BASE_URL")?.trimEnd('/').orEmpty()
    val uploadDir = Path.of(System.getenv("UPLOAD_DIR") ?: "data/uploads")
    Files.createDirectories(uploadDir)
    install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            this@autoflexModule.environment.log.error("Request failed", cause)
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse("Request failed"))
        }
    }

    routing {
        get("/") { call.respondResource("web/index.html") }
        get("/admin") { call.respondResource("web/admin.html") }
        get("/share/posts/{id}") {
            val id = call.postId() ?: return@get
            val post = database.getPost(id, incrementViews = false)
                ?: return@get call.respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
            call.respondText(postSharePage(post, publicBaseUrl), ContentType.Text.Html)
        }
        get("/share/models") {
            val brand = call.request.queryParameters["brand"].orEmpty().clean(80)
            val model = call.request.queryParameters["model"].orEmpty().clean(80)
            if (brand.isBlank() || model.isBlank()) {
                return@get call.respond(HttpStatusCode.BadRequest, ErrorResponse("Brand and model are required"))
            }
            val posts = database.listPosts(brand, null, null, "latest", 1, 0, model)
            if (posts.isEmpty()) return@get call.respond(HttpStatusCode.NotFound, ErrorResponse("Model notebook not found"))
            call.respondText(modelSharePage(brand, model, posts.first().cover, publicBaseUrl), ContentType.Text.Html)
        }
        get("/uploads/{file}") {
            val file = call.parameters["file"]?.takeIf { it.matches(Regex("[a-f0-9]{48}\\.jpg")) }
                ?: return@get call.respond(HttpStatusCode.NotFound, ErrorResponse("Upload not found"))
            val path = uploadDir.resolve(file)
            if (!Files.exists(path)) return@get call.respond(HttpStatusCode.NotFound, ErrorResponse("Upload not found"))
            call.respondFile(path.toFile())
        }
        staticResources("/assets", "web/assets")
        route("/api") {
            get("/health") { call.respond(HealthResponse("ok", appVersion, "external")) }
            get("/meta") { call.respond(MetaResponse(AutoflexMeta.brands, AutoflexMeta.topics, AutoflexMeta.knowledgeLabels)) }
            get("/stats") {
                val (posts, comments) = database.stats()
                call.respond(StatsResponse(posts, comments))
            }
            get("/models") {
                call.respond(ModelsResponse(database.listModels()))
            }
            get("/posts") {
                val limit = call.request.queryParameters["limit"].toPageLimit()
                val offset = call.request.queryParameters["offset"].toOffset()
                val posts = database.listPosts(
                    brand = call.request.queryParameters["brand"],
                    topic = call.request.queryParameters["topic"],
                    query = call.request.queryParameters["q"],
                    sort = call.request.queryParameters["sort"],
                    limit = limit + 1,
                    offset = offset,
                    model = call.request.queryParameters["model"],
                )
                call.respond(
                    PostsResponse(
                        posts = posts.take(limit),
                        limit = limit,
                        offset = offset,
                        hasMore = posts.size > limit,
                    ),
                )
            }
            get("/posts/{id}") {
                val id = call.postId() ?: return@get
                val post = database.getPost(id)
                    ?: return@get call.respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
                val profileToken = call.request.queryParameters["profile_token"].cleanToken().orEmpty()
                call.respond(post.copy(canEdit = database.ownsPost(id, "", profileToken)))
            }
            get("/saved-posts") {
                val saveToken = call.request.queryParameters["save_token"].cleanToken()
                    ?: return@get call.respond(HttpStatusCode.BadRequest, ErrorResponse("Save token is required"))
                val limit = call.request.queryParameters["limit"].toPageLimit()
                val offset = call.request.queryParameters["offset"].toOffset()
                val posts = database.listSavedPosts(saveToken, limit + 1, offset)
                call.respond(
                    PostsResponse(
                        posts = posts.take(limit),
                        limit = limit,
                        offset = offset,
                        hasMore = posts.size > limit,
                    ),
                )
            }
            post("/profiles") {
                if (call.rateLimited(writeLimiter)) return@post
                val request = call.receive<CreateProfileRequest>()
                val displayName = request.displayName.clean(60).ifBlank {
                    return@post call.respond(HttpStatusCode.BadRequest, ErrorResponse("Display name is required"))
                }
                val profileToken = request.saveToken.cleanToken() ?: secureToken()
                val recoveryCode = recoveryCode()
                val profile = database.createProfile(displayName, profileToken, recoveryCode.sha256())
                call.respond(
                    HttpStatusCode.Created,
                    ProfileResponse(profile.displayName, profile.profileToken, recoveryCode),
                )
            }
            post("/profiles/recover") {
                if (call.rateLimited(writeLimiter)) return@post
                val request = call.receive<RecoverProfileRequest>()
                val profile = database.recoverProfile(request.recoveryCode.cleanRecoveryCode().sha256())
                    ?: return@post call.respond(HttpStatusCode.NotFound, ErrorResponse("Recovery code not found"))
                call.respond(ProfileResponse(profile.displayName, profile.profileToken))
            }
            delete("/profiles") {
                if (call.rateLimited(writeLimiter)) return@delete
                val token = call.receive<SaveTokenRequest>().saveToken.cleanToken()
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, ErrorResponse("Profile token is required"))
                database.deleteProfile(token)
                call.respond(OkResponse())
            }
            post("/uploads") {
                if (call.rateLimited(writeLimiter)) return@post
                val uploaded = call.receiveImageUpload(uploadDir)
                    ?: return@post call.respond(HttpStatusCode.BadRequest, ErrorResponse("Upload an image under 4 MB"))
                call.respond(HttpStatusCode.Created, UploadResponse(uploaded))
            }
            post("/feedback") {
                if (call.rateLimited(writeLimiter)) return@post
                val request = call.receive<FeedbackRequest>()
                val actorToken = request.actorToken.cleanToken()
                if (actorToken != null && database.isBlocked(actorToken)) return@post call.blocked()
                val message = request.message.clean(2_000).ifBlank {
                    return@post call.respond(HttpStatusCode.BadRequest, ErrorResponse("Feedback message is required"))
                }
                val id = database.addFeedback(
                    request.name.clean(60).ifBlank { "Anonymous" },
                    message,
                    request.context.clean(300),
                    actorToken,
                )
                call.respond(HttpStatusCode.Created, FeedbackResponse(id))
            }
            post("/client-errors") {
                if (call.rateLimited(writeLimiter)) return@post
                val request = call.receive<ClientErrorRequest>()
                val message = request.message.clean(500).ifBlank {
                    return@post call.respond(HttpStatusCode.BadRequest, ErrorResponse("Error message is required"))
                }
                val actorToken = request.actorToken.cleanToken()
                val id = database.addClientError(
                    message,
                    request.source.clean(300),
                    request.stack.clean(4_000),
                    request.path.clean(300),
                    actorToken,
                )
                call.respond(HttpStatusCode.Created, ClientErrorResponse(id))
            }
            post("/posts") {
                if (call.rateLimited(writeLimiter)) return@post
                val request = call.receive<CreatePostRequest>()
                val actorToken = request.actorToken()
                if (actorToken != null && database.isBlocked(actorToken)) return@post call.blocked()
                val draft = request.validatedDraft()
                    ?: return@post call.respond(HttpStatusCode.BadRequest, ErrorResponse("Title and body are required"))
                val token = secureToken()
                val id = database.createPost(draft, token, actorToken)
                call.respond(HttpStatusCode.Created, CreatePostResponse(id, token))
            }
            put("/posts/{id}") {
                if (call.rateLimited(writeLimiter)) return@put
                val id = call.postId() ?: return@put
                val request = call.receive<UpdatePostRequest>()
                val actorToken = request.actorToken()
                if (actorToken != null && database.isBlocked(actorToken)) return@put call.blocked()
                if (!database.ownsPost(id, request.editToken, request.profileToken)) {
                    return@put call.respond(HttpStatusCode.Forbidden, ErrorResponse("You can only edit your own post"))
                }
                val draft = request.validatedDraft()
                    ?: return@put call.respond(HttpStatusCode.BadRequest, ErrorResponse("Title and body are required"))
                database.updatePost(id, draft)
                call.respond(OkResponse())
            }
            delete("/posts/{id}") {
                if (call.rateLimited(writeLimiter)) return@delete
                val id = call.postId() ?: return@delete
                val request = call.receive<EditTokenRequest>()
                if (!database.ownsPost(id, request.editToken, request.profileToken)) {
                    return@delete call.respond(HttpStatusCode.Forbidden, ErrorResponse("You can only delete your own post"))
                }
                database.deletePost(id)
                call.respond(OkResponse())
            }
            post("/posts/{id}/like") {
                if (call.rateLimited(writeLimiter)) return@post
                val id = call.postId() ?: return@post
                val likes = database.likePost(id)
                    ?: return@post call.respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
                call.respond(LikeResponse(likes))
            }
            put("/posts/{id}/fix-confirmation") {
                if (call.rateLimited(writeLimiter)) return@put
                val id = call.postId() ?: return@put
                val actorToken = call.receive<FixConfirmationRequest>().actorToken.cleanToken()
                    ?: return@put call.respond(HttpStatusCode.BadRequest, ErrorResponse("Actor token is required"))
                if (database.isBlocked(actorToken)) return@put call.blocked()
                val count = database.confirmFix(id, actorToken)
                    ?: return@put call.respond(HttpStatusCode.BadRequest, ErrorResponse("Only fix posts can be confirmed"))
                call.respond(FixConfirmationResponse(count))
            }
            put("/posts/{id}/helpful") {
                if (call.rateLimited(writeLimiter)) return@put
                call.qualitySignal(database, "helpful")
            }
            put("/posts/{id}/stale") {
                if (call.rateLimited(writeLimiter)) return@put
                call.qualitySignal(database, "stale")
            }
            put("/posts/{id}/save") {
                if (call.rateLimited(writeLimiter)) return@put
                val id = call.postId() ?: return@put
                val token = call.receive<SaveTokenRequest>().saveToken.cleanToken()
                    ?: return@put call.respond(HttpStatusCode.BadRequest, ErrorResponse("Save token is required"))
                if (!database.savePost(id, token)) {
                    return@put call.respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
                }
                call.respond(OkResponse())
            }
            delete("/posts/{id}/save") {
                if (call.rateLimited(writeLimiter)) return@delete
                val id = call.postId() ?: return@delete
                val token = call.receive<SaveTokenRequest>().saveToken.cleanToken()
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, ErrorResponse("Save token is required"))
                database.unsavePost(id, token)
                call.respond(OkResponse())
            }
            post("/posts/{id}/comments") {
                if (call.rateLimited(writeLimiter)) return@post
                val id = call.postId() ?: return@post
                val request = call.receive<CommentRequest>()
                val actorToken = request.actorToken.cleanToken()
                if (actorToken != null && database.isBlocked(actorToken)) return@post call.blocked()
                if (request.body.isBlank()) {
                    return@post call.respond(HttpStatusCode.BadRequest, ErrorResponse("Comment cannot be empty"))
                }
                val comment = database.addComment(
                    id,
                    request.author.clean(60).ifBlank { "Anonymous" },
                    request.body.clean(5_000),
                ) ?: return@post call.respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
                call.respond(HttpStatusCode.Created, comment)
            }
            post("/posts/{id}/reports") {
                if (call.rateLimited(writeLimiter)) return@post
                val id = call.postId() ?: return@post
                val request = call.receive<ReportPostRequest>()
                val actorToken = request.actorToken.cleanToken()
                if (actorToken != null && database.isBlocked(actorToken)) return@post call.blocked()
                if (request.reason.isBlank()) {
                    return@post call.respond(HttpStatusCode.BadRequest, ErrorResponse("Report reason is required"))
                }
                val reportId = database.reportPost(
                    id,
                    request.reporter.clean(60).ifBlank { "Anonymous" },
                    request.reason.clean(1_000),
                ) ?: return@post call.respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
                call.respond(HttpStatusCode.Created, ReportPostResponse(reportId))
            }
        }
        route("/api/service-centers") {
            get("/status") {
                call.respond(ServiceCenterStatusResponse(status = "external", ownedBy = "service-center-team"))
            }
        }
        route("/api/admin") {
            get("/reports") {
                if (!call.isAdmin(adminToken)) {
                    return@get call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Admin token is required"))
                }
                val limit = call.request.queryParameters["limit"].toPageLimit()
                val offset = call.request.queryParameters["offset"].toOffset()
                val reports = database.listReports(limit + 1, offset)
                call.respond(
                    com.autoflex.shared.ReportsResponse(
                        reports = reports.take(limit),
                        limit = limit,
                        offset = offset,
                        hasMore = reports.size > limit,
                    ),
                )
            }
            get("/feedback") {
                if (!call.isAdmin(adminToken)) {
                    return@get call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Admin token is required"))
                }
                val limit = call.request.queryParameters["limit"].toPageLimit()
                val offset = call.request.queryParameters["offset"].toOffset()
                val feedback = database.listFeedback(limit + 1, offset)
                call.respond(
                    FeedbacksResponse(
                        feedback = feedback.take(limit),
                        limit = limit,
                        offset = offset,
                        hasMore = feedback.size > limit,
                    ),
                )
            }
            get("/client-errors") {
                if (!call.isAdmin(adminToken)) {
                    return@get call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Admin token is required"))
                }
                val limit = call.request.queryParameters["limit"].toPageLimit()
                val offset = call.request.queryParameters["offset"].toOffset()
                val errors = database.listClientErrors(limit + 1, offset)
                call.respond(
                    ClientErrorsResponse(
                        errors = errors.take(limit),
                        limit = limit,
                        offset = offset,
                        hasMore = errors.size > limit,
                    ),
                )
            }
            delete("/reports/{id}") {
                if (!call.isAdmin(adminToken)) {
                    return@delete call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Admin token is required"))
                }
                val id = call.adminId() ?: return@delete
                if (!database.deleteReport(id)) {
                    return@delete call.respond(HttpStatusCode.NotFound, ErrorResponse("Report not found"))
                }
                call.respond(OkResponse())
            }
            delete("/posts/{id}") {
                if (!call.isAdmin(adminToken)) {
                    return@delete call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Admin token is required"))
                }
                val id = call.adminId() ?: return@delete
                if (!database.deletePost(id)) {
                    return@delete call.respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
                }
                call.respond(OkResponse())
            }
            put("/posts/{id}/block-owner") {
                if (!call.isAdmin(adminToken)) {
                    return@put call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Admin token is required"))
                }
                val id = call.adminId() ?: return@put
                val request = call.receive<BlockTokenRequest>()
                if (!database.blockPostOwner(id, request.reason.clean(1_000).ifBlank { "Moderation block" })) {
                    return@put call.respond(HttpStatusCode.NotFound, ErrorResponse("Post owner token not found"))
                }
                call.respond(OkResponse())
            }
            put("/posts/{id}/pin") {
                if (!call.isAdmin(adminToken)) {
                    return@put call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Admin token is required"))
                }
                val id = call.adminId() ?: return@put
                val request = call.receive<PinPostRequest>()
                val summary = database.setPinned(id, request.isPinned)
                    ?: return@put call.respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
                call.respond(summary)
            }
        }
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.qualitySignal(
    database: AutoflexDatabase,
    signal: String,
) {
    val id = postId() ?: return
    val actorToken = receive<QualitySignalRequest>().actorToken.cleanToken()
        ?: return respond(HttpStatusCode.BadRequest, ErrorResponse("Actor token is required"))
    if (database.isBlocked(actorToken)) return blocked()
    val summary = database.addQualitySignal(id, actorToken, signal)
        ?: return respond(HttpStatusCode.NotFound, ErrorResponse("Post not found"))
    respond(summary)
}

private fun postSharePage(post: Post, publicBaseUrl: String): String {
    val appPath = "/#post-${post.id}"
    val sharePath = "/share/posts/${post.id}"
    val description = post.body.clean(180).replace(Regex("\\s+"), " ")
    val image = post.cover?.takeIf(String::isNotBlank)
    return sharePage(
        title = post.title,
        description = description.ifBlank { "${post.brand} ${post.model} ownership note".trim() },
        appPath = appPath,
        sharePath = sharePath,
        image = image,
        publicBaseUrl = publicBaseUrl,
    )
}

private fun modelSharePage(brand: String, model: String, cover: String?, publicBaseUrl: String): String {
    val appPath = "/#model-${brand.urlComponent()}--${model.urlComponent()}"
    val sharePath = "/share/models?brand=${brand.urlComponent()}&model=${model.urlComponent()}"
    return sharePage(
        title = "$brand $model owner notebook",
        description = "Reviews, known issues, fixes, costs, and travelogues for $brand $model.",
        appPath = appPath,
        sharePath = sharePath,
        image = cover?.takeIf(String::isNotBlank),
        publicBaseUrl = publicBaseUrl,
    )
}

private fun sharePage(
    title: String,
    description: String,
    appPath: String,
    sharePath: String,
    image: String?,
    publicBaseUrl: String,
): String {
    val openUrl = publicBaseUrl + appPath
    val canonical = publicBaseUrl + sharePath
    val imageMeta = image?.let { """<meta property="og:image" content="${it.html()}">""" }.orEmpty()
    return """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${title.html()} | Autoflex</title>
            <meta name="description" content="${description.html()}">
            <link rel="canonical" href="${canonical.html()}">
            <meta property="og:type" content="article">
            <meta property="og:title" content="${title.html()}">
            <meta property="og:description" content="${description.html()}">
            <meta property="og:url" content="${canonical.html()}">
            $imageMeta
            <meta name="twitter:card" content="${if (image == null) "summary" else "summary_large_image"}">
            <meta http-equiv="refresh" content="0; url=${openUrl.html()}">
          </head>
          <body>
            <p><a href="${openUrl.html()}">Open this Autoflex note</a></p>
          </body>
        </html>
    """.trimIndent()
}

private suspend fun io.ktor.server.application.ApplicationCall.adminId(): Long? {
    val id = parameters["id"]?.toLongOrNull()
    if (id == null) respond(HttpStatusCode.BadRequest, ErrorResponse("Invalid id"))
    return id
}

private suspend fun io.ktor.server.application.ApplicationCall.postId(): Long? {
    val id = parameters["id"]?.toLongOrNull()
    if (id == null) respond(HttpStatusCode.BadRequest, ErrorResponse("Invalid post id"))
    return id
}

private suspend fun io.ktor.server.application.ApplicationCall.rateLimited(limiter: RateLimiter): Boolean {
    if (limiter.allow("write:${clientKey()}")) return false
    respond(HttpStatusCode.TooManyRequests, ErrorResponse("Too many actions. Wait a minute and try again."))
    return true
}

private suspend fun io.ktor.server.application.ApplicationCall.blocked() {
    respond(HttpStatusCode.Forbidden, ErrorResponse("This browser or profile is blocked from community writes."))
}

private fun io.ktor.server.application.ApplicationCall.clientKey(): String {
    val forwarded = request.headers["X-Forwarded-For"]?.substringBefore(",")?.trim()
    val realIp = request.headers["X-Real-IP"]?.trim()
    return forwarded?.takeIf(String::isNotBlank) ?: realIp?.takeIf(String::isNotBlank) ?: "local"
}

private fun io.ktor.server.application.ApplicationCall.isAdmin(adminToken: String): Boolean {
    val supplied = request.headers["X-Admin-Token"] ?: request.queryParameters["admin_token"]
    return supplied != null && java.security.MessageDigest.isEqual(supplied.toByteArray(), adminToken.toByteArray())
}

private suspend fun io.ktor.server.application.ApplicationCall.receiveImageUpload(uploadDir: Path): String? {
    var bytes: ByteArray? = null
    val multipart = receiveMultipart()
    while (true) {
        val part = multipart.readPart() ?: break
        if (part is PartData.FileItem && part.contentType.isAllowedImage()) {
            bytes = part.provider().readRemaining(4L * 1024 * 1024 + 1).readByteArray()
        }
        part.release()
    }
    val source = bytes?.takeIf { it.size in 1..(4 * 1024 * 1024) } ?: return null
    val image = ImageIO.read(ByteArrayInputStream(source)) ?: return null
    val rgb = BufferedImage(image.width, image.height, BufferedImage.TYPE_INT_RGB)
    val graphics = rgb.createGraphics()
    try {
        graphics.drawImage(image, 0, 0, null)
    } finally {
        graphics.dispose()
    }
    val file = "${secureToken()}.jpg"
    ImageIO.write(rgb, "jpg", uploadDir.resolve(file).toFile())
    return "/uploads/$file"
}

private fun ContentType?.isAllowedImage() = this?.match(ContentType.Image.JPEG) == true ||
    this?.match(ContentType.Image.PNG) == true ||
    this?.toString()?.equals("image/webp", ignoreCase = true) == true

private fun String?.toPageLimit() = this?.toIntOrNull()?.coerceIn(1, 50) ?: 20
private fun String?.toOffset() = this?.toIntOrNull()?.coerceAtLeast(0) ?: 0
private fun String?.cleanToken() = this?.trim()?.take(80)?.takeIf { it.length >= 16 }
private fun String.cleanRecoveryCode() = uppercase().filter { it.isLetterOrDigit() }.take(32)

private fun CreatePostRequest.validatedDraft() = draft(
    title, body, author, brand, topic, cover, knowledgeLabel, model, variant, city, odometerKm,
)
private fun UpdatePostRequest.validatedDraft() = draft(
    title, body, author, brand, topic, cover, knowledgeLabel, model, variant, city, odometerKm,
)
private fun CreatePostRequest.actorToken() = profileToken.cleanToken() ?: actorToken.cleanToken()
private fun UpdatePostRequest.actorToken() = profileToken.cleanToken() ?: actorToken.cleanToken()

private fun draft(
    title: String,
    body: String,
    author: String,
    brand: String,
    topic: String,
    cover: String,
    knowledgeLabel: String,
    model: String,
    variant: String,
    city: String,
    odometerKm: Int?,
): PostDraft? {
    if (title.isBlank() || body.isBlank()) return null
    return PostDraft(
        title = title.clean(200),
        body = body.clean(20_000),
        author = author.clean(60).ifBlank { "Anonymous" },
        brand = brand.takeIf(AutoflexMeta.brands::contains) ?: "General",
        topic = topic.takeIf(AutoflexMeta.topics::contains) ?: "Discussion",
        cover = cleanCover(cover),
        knowledgeLabel = knowledgeLabel.takeIf(AutoflexMeta.knowledgeLabels::contains) ?: "Owner note",
        model = model.clean(80),
        variant = variant.clean(80),
        city = city.clean(60),
        odometerKm = odometerKm?.takeIf { it in 0..2_000_000 },
    )
}

private fun String.clean(max: Int) = take(max).trim()
private fun String.html() = replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
    .replace("\"", "&quot;")
private fun String.urlComponent() = URLEncoder.encode(this, Charsets.UTF_8).replace("+", "%20")
private val coverPattern = Regex("^https?://[^\\s'\"()<>]+$", RegexOption.IGNORE_CASE)
private fun cleanCover(value: String) = value.clean(2_000).takeIf(coverPattern::matches).orEmpty()

private val random = SecureRandom()
private fun secureToken(): String = ByteArray(24).also(random::nextBytes).joinToString("") { "%02x".format(it) }
private fun recoveryCode(): String = ByteArray(8).also(random::nextBytes).joinToString("") { "%02x".format(it) }.uppercase()
private fun String.sha256(): String = java.security.MessageDigest.getInstance("SHA-256")
    .digest(toByteArray())
    .joinToString("") { "%02x".format(it) }

package com.autoflex.shared

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MetaResponse(
    val brands: List<String>,
    val topics: List<String>,
    @SerialName("knowledge_labels") val knowledgeLabels: List<String> = emptyList(),
)

@Serializable
data class StatsResponse(
    val posts: Int,
    val comments: Int,
)

@Serializable
data class HealthResponse(
    val status: String,
    val version: String,
    @SerialName("service_center_status") val serviceCenterStatus: String,
)

@Serializable
data class PostSummary(
    val id: Long,
    val title: String,
    val author: String,
    val brand: String,
    val topic: String,
    @SerialName("knowledge_label") val knowledgeLabel: String = "Owner note",
    val model: String = "",
    val variant: String = "",
    val city: String = "",
    @SerialName("odometer_km") val odometerKm: Int? = null,
    val cover: String? = null,
    val views: Int,
    val likes: Int,
    @SerialName("fix_confirmation_count") val fixConfirmationCount: Int = 0,
    @SerialName("helpful_count") val helpfulCount: Int = 0,
    @SerialName("stale_count") val staleCount: Int = 0,
    @SerialName("is_pinned") val isPinned: Boolean = false,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    val excerpt: String,
    @SerialName("comment_count") val commentCount: Int,
)

@Serializable
data class PostsResponse(
    val posts: List<PostSummary>,
    val limit: Int,
    val offset: Int,
    @SerialName("has_more") val hasMore: Boolean,
)

@Serializable
data class ModelSummary(
    val brand: String,
    val model: String,
    @SerialName("post_count") val postCount: Int,
    @SerialName("known_issue_count") val knownIssueCount: Int = 0,
    @SerialName("fix_count") val fixCount: Int = 0,
    @SerialName("cost_note_count") val costNoteCount: Int = 0,
    @SerialName("latest_post_at") val latestPostAt: String,
)

@Serializable
data class ModelsResponse(val models: List<ModelSummary>)

@Serializable
data class Comment(
    val id: Long,
    val author: String,
    val body: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class Post(
    val id: Long,
    val title: String,
    val body: String,
    val author: String,
    val brand: String,
    val topic: String,
    @SerialName("knowledge_label") val knowledgeLabel: String = "Owner note",
    val model: String = "",
    val variant: String = "",
    val city: String = "",
    @SerialName("odometer_km") val odometerKm: Int? = null,
    val cover: String? = null,
    val views: Int,
    val likes: Int,
    @SerialName("fix_confirmation_count") val fixConfirmationCount: Int = 0,
    @SerialName("helpful_count") val helpfulCount: Int = 0,
    @SerialName("stale_count") val staleCount: Int = 0,
    @SerialName("is_pinned") val isPinned: Boolean = false,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("can_edit") val canEdit: Boolean = false,
    val comments: List<Comment> = emptyList(),
)

@Serializable
data class PostDraft(
    val title: String = "",
    val body: String = "",
    val author: String = "",
    val brand: String = "General",
    val topic: String = "Discussion",
    val cover: String = "",
    val knowledgeLabel: String = "Owner note",
    val model: String = "",
    val variant: String = "",
    val city: String = "",
    @SerialName("odometer_km") val odometerKm: Int? = null,
)

@Serializable
data class CreatePostRequest(
    val title: String,
    val body: String,
    val author: String = "",
    val brand: String = "General",
    val topic: String = "Discussion",
    val cover: String = "",
    @SerialName("profile_token") val profileToken: String = "",
    @SerialName("actor_token") val actorToken: String = "",
    @SerialName("knowledge_label") val knowledgeLabel: String = "Owner note",
    val model: String = "",
    val variant: String = "",
    val city: String = "",
    @SerialName("odometer_km") val odometerKm: Int? = null,
)

@Serializable
data class UpdatePostRequest(
    @SerialName("edit_token") val editToken: String = "",
    val title: String,
    val body: String,
    val author: String = "",
    val brand: String = "General",
    val topic: String = "Discussion",
    val cover: String = "",
    @SerialName("profile_token") val profileToken: String = "",
    @SerialName("actor_token") val actorToken: String = "",
    @SerialName("knowledge_label") val knowledgeLabel: String = "Owner note",
    val model: String = "",
    val variant: String = "",
    val city: String = "",
    @SerialName("odometer_km") val odometerKm: Int? = null,
)

@Serializable
data class CreatePostResponse(
    val id: Long,
    @SerialName("edit_token") val editToken: String,
)

@Serializable
data class EditTokenRequest(
    @SerialName("edit_token") val editToken: String = "",
    @SerialName("profile_token") val profileToken: String = "",
)

@Serializable
data class SaveTokenRequest(@SerialName("save_token") val saveToken: String)

@Serializable
data class BlockTokenRequest(val reason: String = "")

@Serializable
data class FixConfirmationRequest(@SerialName("actor_token") val actorToken: String)

@Serializable
data class FixConfirmationResponse(@SerialName("fix_confirmation_count") val fixConfirmationCount: Int)

@Serializable
data class QualitySignalRequest(@SerialName("actor_token") val actorToken: String)

@Serializable
data class QualitySignalResponse(
    @SerialName("helpful_count") val helpfulCount: Int,
    @SerialName("stale_count") val staleCount: Int,
    @SerialName("is_pinned") val isPinned: Boolean,
)

@Serializable
data class PinPostRequest(@SerialName("is_pinned") val isPinned: Boolean = true)

@Serializable
data class CreateProfileRequest(
    @SerialName("display_name") val displayName: String,
    @SerialName("save_token") val saveToken: String = "",
)

@Serializable
data class RecoverProfileRequest(@SerialName("recovery_code") val recoveryCode: String)

@Serializable
data class ProfileResponse(
    @SerialName("display_name") val displayName: String,
    @SerialName("profile_token") val profileToken: String,
    @SerialName("recovery_code") val recoveryCode: String? = null,
)

@Serializable
data class ServiceCenterStatusResponse(
    val status: String,
    @SerialName("owned_by") val ownedBy: String,
)

@Serializable
data class CommentRequest(
    val author: String = "",
    val body: String,
    @SerialName("actor_token") val actorToken: String = "",
)

@Serializable
data class LikeResponse(val likes: Int)

@Serializable
data class ReportPostRequest(
    val reporter: String = "",
    val reason: String,
    @SerialName("actor_token") val actorToken: String = "",
)

@Serializable
data class ReportPostResponse(val id: Long)

@Serializable
data class FeedbackRequest(
    val name: String = "",
    val message: String,
    val context: String = "",
    @SerialName("actor_token") val actorToken: String = "",
)

@Serializable
data class FeedbackResponse(val id: Long)

@Serializable
data class ClientErrorRequest(
    val message: String,
    val source: String = "",
    val stack: String = "",
    val path: String = "",
    @SerialName("actor_token") val actorToken: String = "",
)

@Serializable
data class ClientErrorResponse(val id: Long)

@Serializable
data class UploadResponse(val url: String)

@Serializable
data class ReportSummary(
    val id: Long,
    @SerialName("post_id") val postId: Long,
    @SerialName("post_title") val postTitle: String,
    val reporter: String,
    val reason: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("owner_blocked") val ownerBlocked: Boolean = false,
    @SerialName("is_pinned") val isPinned: Boolean = false,
)

@Serializable
data class ReportsResponse(
    val reports: List<ReportSummary>,
    val limit: Int,
    val offset: Int,
    @SerialName("has_more") val hasMore: Boolean,
)

@Serializable
data class FeedbackSummary(
    val id: Long,
    val name: String,
    val message: String,
    val context: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class FeedbacksResponse(
    val feedback: List<FeedbackSummary>,
    val limit: Int,
    val offset: Int,
    @SerialName("has_more") val hasMore: Boolean,
)

@Serializable
data class ClientErrorSummary(
    val id: Long,
    val message: String,
    val source: String,
    val stack: String,
    val path: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class ClientErrorsResponse(
    val errors: List<ClientErrorSummary>,
    val limit: Int,
    val offset: Int,
    @SerialName("has_more") val hasMore: Boolean,
)

@Serializable
data class OkResponse(val ok: Boolean = true)

@Serializable
data class ErrorResponse(val error: String)

object AutoflexMeta {
    val brands = listOf(
        "General", "Maruti Suzuki", "Tata", "Mahindra", "Hyundai", "Toyota",
        "Honda", "Kia", "Volkswagen", "Skoda", "BMW", "Mercedes-Benz", "MG", "Other",
    )

    val topics = listOf(
        "Discussion", "New Launches", "DIY & Optimization", "Ownership Review",
        "Tech Talk", "Troubleshooting", "Buying Advice",
    )

    val knowledgeLabels = listOf("Owner note", "Review", "Known issue", "Fix", "Cost note", "Travelogue")
}

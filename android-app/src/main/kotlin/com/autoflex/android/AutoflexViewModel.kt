package com.autoflex.android

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.autoflex.android.data.AutoflexApi
import com.autoflex.android.data.OwnershipStore
import com.autoflex.shared.CreatePostRequest
import com.autoflex.shared.MetaResponse
import com.autoflex.shared.Post
import com.autoflex.shared.PostDraft
import com.autoflex.shared.PostSummary
import com.autoflex.shared.StatsResponse
import com.autoflex.shared.UpdatePostRequest
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class EditorState(val postId: Long? = null, val draft: PostDraft = PostDraft())

data class AutoflexState(
    val posts: List<PostSummary> = emptyList(),
    val meta: MetaResponse = MetaResponse(emptyList(), emptyList()),
    val stats: StatsResponse = StatsResponse(0, 0),
    val selectedPost: Post? = null,
    val selectedOwned: Boolean = false,
    val brand: String = "All",
    val topic: String = "All",
    val sort: String = "latest",
    val query: String = "",
    val hasMorePosts: Boolean = false,
    val loading: Boolean = true,
    val loadingMore: Boolean = false,
    val working: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
    val editor: EditorState? = null,
)

class AutoflexViewModel(application: Application) : AndroidViewModel(application) {
    private val api = AutoflexApi()
    private val ownership = OwnershipStore(application)
    private val mutableState = MutableStateFlow(AutoflexState())
    val state = mutableState.asStateFlow()
    private var searchJob: Job? = null
    private val pageSize = 20

    init {
        refreshAll()
    }

    fun refreshAll() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching {
            val meta = api.meta()
            val stats = api.stats()
            val current = mutableState.value
            val feed = api.posts(current.brand, current.topic, current.sort, current.query, pageSize, 0)
            Triple(meta, stats, feed)
        }.onSuccess { (meta, stats, feed) ->
            mutableState.update {
                it.copy(meta = meta, stats = stats, posts = feed.posts, hasMorePosts = feed.hasMore, loading = false)
            }
        }.onFailure(::showError)
    }

    fun refreshFeed() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching {
            val current = mutableState.value
            api.posts(current.brand, current.topic, current.sort, current.query, pageSize, 0)
        }.onSuccess { feed ->
            mutableState.update { it.copy(posts = feed.posts, hasMorePosts = feed.hasMore, loading = false) }
        }
            .onFailure(::showError)
    }

    fun loadMorePosts() = viewModelScope.launch {
        val current = mutableState.value
        if (current.loading || current.loadingMore || !current.hasMorePosts) return@launch
        mutableState.update { it.copy(loadingMore = true, error = null) }
        runCatching {
            api.posts(current.brand, current.topic, current.sort, current.query, pageSize, current.posts.size)
        }.onSuccess { feed ->
            mutableState.update {
                it.copy(posts = it.posts + feed.posts, hasMorePosts = feed.hasMore, loadingMore = false)
            }
        }.onFailure(::showError)
    }

    fun setBrand(value: String) {
        mutableState.update { it.copy(brand = value) }
        refreshFeed()
    }

    fun setTopic(value: String) {
        mutableState.update { it.copy(topic = value) }
        refreshFeed()
    }

    fun setSort(value: String) {
        mutableState.update { it.copy(sort = value) }
        refreshFeed()
    }

    fun setQuery(value: String) {
        mutableState.update { it.copy(query = value) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch { delay(250); refreshFeed() }
    }

    fun openPost(id: Long) = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching { api.post(id) }
            .onSuccess { post ->
                mutableState.update {
                    it.copy(selectedPost = post, selectedOwned = ownership.owns(id), loading = false)
                }
            }
            .onFailure(::showError)
    }

    fun closePost() {
        mutableState.update { it.copy(selectedPost = null, selectedOwned = false) }
        refreshFeed()
    }

    fun like() = withSelected { post ->
        val likes = api.like(post.id).likes
        mutableState.update { it.copy(selectedPost = post.copy(likes = likes)) }
    }

    fun addComment(author: String, body: String, onSuccess: () -> Unit) {
        if (body.isBlank()) return
        withSelected { post ->
            val comment = api.comment(post.id, author, body)
            mutableState.update { it.copy(selectedPost = post.copy(comments = post.comments + comment)) }
            onSuccess()
        }
    }

    fun reportPost(reporter: String, reason: String, onSuccess: () -> Unit) {
        if (reason.isBlank()) return
        withSelected { post ->
            api.report(post.id, reporter, reason)
            mutableState.update { it.copy(notice = "Thanks. This report is saved for moderation.") }
            onSuccess()
        }
    }

    fun openNewPost() {
        mutableState.update { it.copy(editor = EditorState(), error = null) }
    }

    fun openEditPost() {
        val post = mutableState.value.selectedPost ?: return
        mutableState.update {
            it.copy(
                editor = EditorState(
                    postId = post.id,
                    draft = PostDraft(post.title, post.body, post.author, post.brand, post.topic, post.cover.orEmpty()),
                ),
                error = null,
            )
        }
    }

    fun updateDraft(draft: PostDraft) {
        mutableState.update { state -> state.copy(editor = state.editor?.copy(draft = draft)) }
    }

    fun closeEditor() {
        mutableState.update { it.copy(editor = null, error = null) }
    }

    fun savePost() = viewModelScope.launch {
        val editor = mutableState.value.editor ?: return@launch
        val draft = editor.draft
        if (draft.title.isBlank() || draft.body.isBlank()) {
            mutableState.update { it.copy(error = "Title and body are required") }
            return@launch
        }
        mutableState.update { it.copy(working = true, error = null) }
        runCatching {
            if (editor.postId == null) {
                val created = api.create(
                    CreatePostRequest(draft.title, draft.body, draft.author, draft.brand, draft.topic, draft.cover),
                )
                ownership.save(created.id, created.editToken)
                created.id
            } else {
                val token = checkNotNull(ownership.token(editor.postId)) { "Ownership token not found" }
                api.update(
                    editor.postId,
                    UpdatePostRequest(token, draft.title, draft.body, draft.author, draft.brand, draft.topic, draft.cover),
                )
                editor.postId
            }
        }.onSuccess { id ->
            mutableState.update { it.copy(editor = null, working = false) }
            openPost(id)
        }.onFailure(::showError)
    }

    fun deletePost() = withSelected { post ->
        val token = checkNotNull(ownership.token(post.id)) { "Ownership token not found" }
        api.delete(post.id, token)
        ownership.remove(post.id)
        mutableState.update { it.copy(selectedPost = null, selectedOwned = false) }
        refreshFeed()
    }

    fun dismissError() = mutableState.update { it.copy(error = null) }
    fun dismissNotice() = mutableState.update { it.copy(notice = null) }

    private fun withSelected(action: suspend (Post) -> Unit) = viewModelScope.launch {
        val post = mutableState.value.selectedPost ?: return@launch
        mutableState.update { it.copy(working = true, error = null) }
        runCatching { action(post) }
            .onSuccess { mutableState.update { it.copy(working = false) } }
            .onFailure(::showError)
    }

    private fun showError(error: Throwable) {
        mutableState.update {
            it.copy(
                loading = false,
                loadingMore = false,
                working = false,
                error = error.message ?: "Could not reach Autoflex",
            )
        }
    }
}

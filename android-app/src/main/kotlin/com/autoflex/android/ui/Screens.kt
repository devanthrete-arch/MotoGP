package com.autoflex.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import com.autoflex.android.AutoflexState
import com.autoflex.android.AutoflexViewModel
import com.autoflex.shared.Comment
import com.autoflex.shared.Post
import com.autoflex.shared.PostDraft
import com.autoflex.shared.PostSummary
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

@Composable
fun AutoflexApp(state: AutoflexState, viewModel: AutoflexViewModel) {
    Box(Modifier.fillMaxSize()) {
        if (state.selectedPost == null) {
            FeedScreen(state, viewModel)
        } else {
            PostScreen(state, viewModel)
        }
        state.editor?.let { editor ->
            EditorDialog(
                title = if (editor.postId == null) "Write a post" else "Edit post",
                draft = editor.draft,
                brands = state.meta.brands,
                topics = state.meta.topics,
                busy = state.working,
                onDraftChange = viewModel::updateDraft,
                onDismiss = viewModel::closeEditor,
                onSave = viewModel::savePost,
            )
        }
        state.error?.let { message ->
            AlertDialog(
                onDismissRequest = viewModel::dismissError,
                title = { Text("Something went wrong") },
                text = { Text(message) },
                confirmButton = { TextButton(onClick = viewModel::dismissError) { Text("OK") } },
            )
        }
        state.notice?.let { message ->
            AlertDialog(
                onDismissRequest = viewModel::dismissNotice,
                title = { Text("Saved") },
                text = { Text(message) },
                confirmButton = { TextButton(onClick = viewModel::dismissNotice) { Text("OK") } },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeedScreen(state: AutoflexState, viewModel: AutoflexViewModel) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Brand() },
                actions = { Button(onClick = viewModel::openNewPost) { Text("Write") } },
                modifier = Modifier.statusBarsPadding(),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(bottom = 28.dp),
        ) {
            item {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Text("Where car people think out loud.", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text(
                        "${state.stats.posts} posts · ${state.stats.comments} comments · full ownership, zero gatekeeping",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(16.dp))
                    OutlinedTextField(
                        value = state.query,
                        onValueChange = viewModel::setQuery,
                        label = { Text("Search posts, brands, authors") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = state.sort == "latest", onClick = { viewModel.setSort("latest") }, label = { Text("Latest") })
                        FilterChip(selected = state.sort == "popular", onClick = { viewModel.setSort("popular") }, label = { Text("Popular") })
                    }
                    FilterRow("Topic", listOf("All") + state.meta.topics, state.topic, viewModel::setTopic)
                    FilterRow("Brand", listOf("All") + state.meta.brands, state.brand, viewModel::setBrand)
                }
            }
            when {
                state.loading -> item { Loading() }
                state.posts.isEmpty() -> item { EmptyFeed(viewModel::openNewPost) }
                else -> {
                    items(state.posts, key = PostSummary::id) { post -> PostCard(post) { viewModel.openPost(post.id) } }
                    if (state.hasMorePosts) item { LoadMore(state.loadingMore, viewModel::loadMorePosts) }
                }
            }
        }
    }
}

@Composable
private fun LoadMore(loading: Boolean, onClick: () -> Unit) = Box(
    Modifier.fillMaxWidth().padding(18.dp),
    contentAlignment = Alignment.Center,
) {
    OutlinedButton(onClick = onClick, enabled = !loading) {
        if (loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Load more")
    }
}

@Composable
private fun FilterRow(label: String, values: List<String>, selected: String, onSelect: (String) -> Unit) {
    Text(label, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 12.dp))
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(values) { value -> FilterChip(selected = selected == value, onClick = { onSelect(value) }, label = { Text(value) }) }
    }
}

@Composable
private fun PostCard(post: PostSummary, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 7.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        if (post.cover != null) {
            AsyncImage(model = post.cover, contentDescription = null, modifier = Modifier.fillMaxWidth().height(180.dp))
        }
        Column(Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Tag(post.brand)
                Tag(post.topic, muted = true)
            }
            Text(post.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
            Text(post.excerpt + if (post.excerpt.length >= 280) "…" else "", maxLines = 3, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(12.dp))
            Text(
                "${post.author} · ${timeAgo(post.createdAt)} · ♥ ${post.likes} · 💬 ${post.commentCount} · 👁 ${post.views}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PostScreen(state: AutoflexState, viewModel: AutoflexViewModel) {
    val post = state.selectedPost ?: return
    var deleteConfirmation by remember { mutableStateOf(false) }
    var reportOpen by remember { mutableStateOf(false) }
    var commentAuthor by rememberSaveable(post.id) { mutableStateOf("") }
    var commentBody by rememberSaveable(post.id) { mutableStateOf("") }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Brand() },
                navigationIcon = { TextButton(onClick = viewModel::closePost) { Text("‹ Back") } },
                modifier = Modifier.statusBarsPadding(),
            )
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(bottom = 32.dp)) {
            if (post.cover != null) item { AsyncImage(post.cover, null, Modifier.fillMaxWidth().height(260.dp)) }
            item {
                Column(Modifier.padding(16.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Tag(post.brand); Tag(post.topic, true) }
                    Text(post.title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                    Text("By ${post.author} · ${timeAgo(post.createdAt)} · 👁 ${post.views}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Button(onClick = viewModel::like, enabled = !state.working) { Text("♥ Like (${post.likes})") }
                        OutlinedButton(onClick = { reportOpen = true }, enabled = !state.working) { Text("Report") }
                        if (state.selectedOwned) {
                            OutlinedButton(onClick = viewModel::openEditPost) { Text("Edit") }
                            OutlinedButton(onClick = { deleteConfirmation = true }) { Text("Delete") }
                        }
                    }
                    MarkdownLite(post.body)
                    Spacer(Modifier.height(24.dp))
                    Text("Discussion (${post.comments.size})", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                }
            }
            items(post.comments, key = Comment::id) { CommentCard(it) }
            item {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(commentAuthor, { commentAuthor = it }, label = { Text("Your name (optional)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(commentBody, { commentBody = it }, label = { Text("Add to the discussion") }, minLines = 3, modifier = Modifier.fillMaxWidth())
                    Button(
                        onClick = { viewModel.addComment(commentAuthor, commentBody) { commentBody = "" } },
                        enabled = commentBody.isNotBlank() && !state.working,
                    ) { Text("Post comment") }
                }
            }
        }
    }
    if (deleteConfirmation) {
        AlertDialog(
            onDismissRequest = { deleteConfirmation = false },
            title = { Text("Delete this post?") },
            text = { Text("This also removes its comments and cannot be undone.") },
            dismissButton = { TextButton(onClick = { deleteConfirmation = false }) { Text("Cancel") } },
            confirmButton = { TextButton(onClick = { deleteConfirmation = false; viewModel.deletePost() }) { Text("Delete") } },
        )
    }
    if (reportOpen) {
        ReportDialog(
            busy = state.working,
            onDismiss = { reportOpen = false },
            onReport = { reporter, reason -> viewModel.reportPost(reporter, reason) { reportOpen = false } },
        )
    }
}

@Composable
private fun ReportDialog(
    busy: Boolean,
    onDismiss: () -> Unit,
    onReport: (String, String) -> Unit,
) {
    var reporter by rememberSaveable { mutableStateOf("") }
    var reason by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Report post") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = reporter,
                    onValueChange = { reporter = it },
                    label = { Text("Your name (optional)") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("What should moderators review?") },
                    minLines = 3,
                )
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        confirmButton = {
            TextButton(
                onClick = { onReport(reporter, reason) },
                enabled = reason.isNotBlank() && !busy,
            ) { Text("Submit") }
        },
    )
}

@Composable
private fun CommentCard(comment: Comment) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text("${comment.author} · ${timeAgo(comment.createdAt)}", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelLarge)
            Text(comment.body, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
private fun EditorDialog(
    title: String,
    draft: PostDraft,
    brands: List<String>,
    topics: List<String>,
    busy: Boolean,
    onDraftChange: (PostDraft) -> Unit,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().statusBarsPadding(), color = MaterialTheme.colorScheme.background) {
            LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        TextButton(onClick = onDismiss) { Text("Cancel") }
                    }
                }
                item { DraftField("Title", draft.title, { onDraftChange(draft.copy(title = it)) }, singleLine = true) }
                item { DraftField("Your name", draft.author, { onDraftChange(draft.copy(author = it)) }, singleLine = true) }
                item { ChoiceMenu("Brand", draft.brand, brands) { onDraftChange(draft.copy(brand = it)) } }
                item { ChoiceMenu("Topic", draft.topic, topics) { onDraftChange(draft.copy(topic = it)) } }
                item { DraftField("Cover image URL (optional)", draft.cover, { onDraftChange(draft.copy(cover = it)) }, singleLine = true) }
                item { DraftField("Body", draft.body, { onDraftChange(draft.copy(body = it)) }, minLines = 12) }
                item {
                    Button(onClick = onSave, enabled = draft.title.isNotBlank() && draft.body.isNotBlank() && !busy, modifier = Modifier.fillMaxWidth()) {
                        if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Publish")
                    }
                }
            }
        }
    }
}

@Composable
private fun DraftField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    singleLine: Boolean = false,
    minLines: Int = 1,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = singleLine,
        minLines = minLines,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun ChoiceMenu(label: String, value: String, values: List<String>, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) { Text("$label: $value") }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            values.forEach { option -> DropdownMenuItem(text = { Text(option) }, onClick = { expanded = false; onSelect(option) }) }
        }
    }
}

@Composable
private fun MarkdownLite(body: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        body.lines().forEach { raw ->
            val line = raw.trim()
            when {
                line.isEmpty() -> Spacer(Modifier.height(2.dp))
                line.startsWith("### ") -> Text(inline(line.drop(4)), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                line.startsWith("## ") -> Text(inline(line.drop(3)), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                line.startsWith("# ") -> Text(inline(line.drop(2)), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                line.startsWith("- ") || line.startsWith("* ") -> Row { Text("•  "); Text(inline(line.drop(2))) }
                else -> Text(inline(line), lineHeight = 25.sp)
            }
        }
    }
}

private fun inline(value: String): AnnotatedString = buildAnnotatedString {
    val pattern = Regex("(\\*\\*.+?\\*\\*|\\*.+?\\*|`.+?`)")
    var cursor = 0
    pattern.findAll(value).forEach { match ->
        append(value.substring(cursor, match.range.first))
        val token = match.value
        val style = when {
            token.startsWith("**") -> SpanStyle(fontWeight = FontWeight.Bold)
            token.startsWith("*") -> SpanStyle(fontStyle = FontStyle.Italic)
            else -> SpanStyle(background = Color(0x33222222), fontWeight = FontWeight.Medium)
        }
        val trim = if (token.startsWith("**")) 2 else 1
        pushStyle(style); append(token.substring(trim, token.length - trim)); pop()
        cursor = match.range.last + 1
    }
    append(value.substring(cursor))
}

@Composable
private fun Tag(text: String, muted: Boolean = false) {
    AssistChip(onClick = {}, label = { Text(text) }, enabled = false)
}

@Composable
private fun Brand() {
    Row {
        Text("Auto", fontWeight = FontWeight.ExtraBold)
        Text("flex", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun Loading() = Box(Modifier.fillMaxWidth().padding(64.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }

@Composable
private fun EmptyFeed(onWrite: () -> Unit) = Column(
    Modifier.fillMaxWidth().padding(64.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
) {
    Text("No posts found", style = MaterialTheme.typography.titleLarge)
    Spacer(Modifier.height(12.dp))
    Button(onClick = onWrite) { Text("Write the first post") }
}

private fun timeAgo(timestamp: String): String = runCatching {
    val time = LocalDateTime.parse(timestamp.replace(' ', 'T')).toInstant(ZoneOffset.UTC)
    val seconds = (Instant.now().epochSecond - time.epochSecond).coerceAtLeast(0)
    when {
        seconds >= 31_536_000 -> "${seconds / 31_536_000}y ago"
        seconds >= 2_592_000 -> "${seconds / 2_592_000}mo ago"
        seconds >= 86_400 -> "${seconds / 86_400}d ago"
        seconds >= 3_600 -> "${seconds / 3_600}h ago"
        seconds >= 60 -> "${seconds / 60}m ago"
        else -> "just now"
    }
}.getOrDefault(timestamp)

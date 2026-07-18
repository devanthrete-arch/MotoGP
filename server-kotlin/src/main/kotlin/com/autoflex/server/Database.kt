package com.autoflex.server

import com.autoflex.shared.Comment
import com.autoflex.shared.ClientErrorSummary
import com.autoflex.shared.FeedbackSummary
import com.autoflex.shared.Post
import com.autoflex.shared.PostDraft
import com.autoflex.shared.PostSummary
import com.autoflex.shared.QualitySignalResponse
import com.autoflex.shared.ReportSummary
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.sql.Connection
import java.sql.DriverManager
import java.sql.ResultSet

class AutoflexDatabase(path: Path) : AutoCloseable {
    private val connection: Connection

    init {
        path.parent?.let { Files.createDirectories(it) }
        connection = DriverManager.getConnection("jdbc:sqlite:${path.toAbsolutePath()}")
        connection.createStatement().use {
            it.execute("PRAGMA journal_mode = WAL")
            it.execute("PRAGMA foreign_keys = ON")
            listOf(
                """
                CREATE TABLE IF NOT EXISTS posts (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  body TEXT NOT NULL,
                  author TEXT NOT NULL DEFAULT 'Anonymous',
                  brand TEXT NOT NULL DEFAULT 'General',
                  topic TEXT NOT NULL DEFAULT 'Discussion',
                  knowledge_label TEXT NOT NULL DEFAULT 'Owner note',
                  model TEXT NOT NULL DEFAULT '',
                  variant TEXT NOT NULL DEFAULT '',
                  city TEXT NOT NULL DEFAULT '',
                  odometer_km INTEGER,
                  cover TEXT,
                  edit_token TEXT NOT NULL,
                  owner_token TEXT,
                  views INTEGER NOT NULL DEFAULT 0,
                  likes INTEGER NOT NULL DEFAULT 0,
                  is_pinned INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS comments (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  post_id INTEGER NOT NULL,
                  author TEXT NOT NULL DEFAULT 'Anonymous',
                  body TEXT NOT NULL,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS post_reports (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  post_id INTEGER NOT NULL,
                  reporter TEXT NOT NULL DEFAULT 'Anonymous',
                  reason TEXT NOT NULL,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS product_feedback (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL DEFAULT 'Anonymous',
                  message TEXT NOT NULL,
                  context TEXT NOT NULL DEFAULT '',
                  actor_token TEXT,
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS client_errors (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  message TEXT NOT NULL,
                  source TEXT NOT NULL DEFAULT '',
                  stack TEXT NOT NULL DEFAULT '',
                  path TEXT NOT NULL DEFAULT '',
                  actor_token TEXT,
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS saved_posts (
                  save_token TEXT NOT NULL,
                  post_id INTEGER NOT NULL,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  PRIMARY KEY (save_token, post_id),
                  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS profiles (
                  profile_token TEXT PRIMARY KEY,
                  display_name TEXT NOT NULL,
                  recovery_hash TEXT NOT NULL UNIQUE,
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS blocked_tokens (
                  token TEXT PRIMARY KEY,
                  reason TEXT NOT NULL,
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS post_quality_signals (
                  post_id INTEGER NOT NULL,
                  actor_token TEXT NOT NULL,
                  signal TEXT NOT NULL,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  PRIMARY KEY (post_id, actor_token, signal),
                  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
                """.trimIndent(),
                """
                CREATE TABLE IF NOT EXISTS fix_confirmations (
                  post_id INTEGER NOT NULL,
                  actor_token TEXT NOT NULL,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  PRIMARY KEY (post_id, actor_token),
                  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
                """.trimIndent(),
                "CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)",
                "CREATE INDEX IF NOT EXISTS idx_post_reports_post ON post_reports(post_id)",
                "CREATE INDEX IF NOT EXISTS idx_product_feedback_created ON product_feedback(created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_errors(created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_fix_confirmations_post ON fix_confirmations(post_id)",
                "CREATE INDEX IF NOT EXISTS idx_post_quality_signals_post ON post_quality_signals(post_id)",
                "CREATE INDEX IF NOT EXISTS idx_saved_posts_token ON saved_posts(save_token, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)",
            ).forEach { sql -> it.execute(sql) }
        }
        ensureColumn("posts", "owner_token", "TEXT")
        ensureColumn("posts", "knowledge_label", "TEXT NOT NULL DEFAULT 'Owner note'")
        ensureColumn("posts", "model", "TEXT NOT NULL DEFAULT ''")
        ensureColumn("posts", "variant", "TEXT NOT NULL DEFAULT ''")
        ensureColumn("posts", "city", "TEXT NOT NULL DEFAULT ''")
        ensureColumn("posts", "odometer_km", "INTEGER")
        ensureColumn("posts", "is_pinned", "INTEGER NOT NULL DEFAULT 0")
        connection.createStatement().use { it.execute("CREATE INDEX IF NOT EXISTS idx_posts_model ON posts(brand, model, updated_at DESC)") }
    }

    @Synchronized
    fun listPosts(
        brand: String?,
        topic: String?,
        query: String?,
        sort: String?,
        limit: Int,
        offset: Int,
        model: String? = null,
    ): List<PostSummary> {
        val conditions = mutableListOf<String>()
        val values = mutableListOf<String>()
        brand?.takeIf { it != "All" }?.let { conditions += "brand = ?"; values += it }
        topic?.takeIf { it != "All" }?.let { conditions += "topic = ?"; values += it }
        model?.takeIf(String::isNotBlank)?.let { conditions += "model = ?"; values += it }
        query?.takeIf(String::isNotBlank)?.let {
            conditions += "(title LIKE ? OR body LIKE ? OR author LIKE ? OR model LIKE ? OR variant LIKE ? OR city LIKE ?)"
            repeat(6) { values += "%$it%" }
        }
        val order = if (sort == "popular") {
            "is_pinned DESC, likes DESC, views DESC, created_at DESC"
        } else {
            "is_pinned DESC, created_at DESC"
        }
        val where = if (conditions.isEmpty()) "" else "WHERE ${conditions.joinToString(" AND ")}"
        val sql = """
            SELECT p.id, p.title, p.author, p.brand, p.topic, p.knowledge_label,
                   p.model, p.variant, p.city, p.odometer_km,
                   p.cover, p.views, p.likes, p.is_pinned,
                   p.created_at, p.updated_at, substr(p.body, 1, 280) excerpt,
                   (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) comment_count,
                   (SELECT COUNT(*) FROM fix_confirmations f WHERE f.post_id = p.id) fix_confirmation_count,
                   (SELECT COUNT(*) FROM post_quality_signals q WHERE q.post_id = p.id AND q.signal = 'helpful') helpful_count,
                   (SELECT COUNT(*) FROM post_quality_signals q WHERE q.post_id = p.id AND q.signal = 'stale') stale_count
            FROM posts p $where ORDER BY $order LIMIT ? OFFSET ?
        """.trimIndent()
        return connection.prepareStatement(sql).use { statement ->
            values.forEachIndexed { index, value -> statement.setString(index + 1, value) }
            statement.setInt(values.size + 1, limit)
            statement.setInt(values.size + 2, offset)
            statement.executeQuery().use { results -> buildList { while (results.next()) add(results.toSummary()) } }
        }
    }

    @Synchronized
    fun listSavedPosts(saveToken: String, limit: Int, offset: Int): List<PostSummary> {
        val sql = """
            SELECT p.id, p.title, p.author, p.brand, p.topic, p.knowledge_label,
                   p.model, p.variant, p.city, p.odometer_km,
                   p.cover, p.views, p.likes, p.is_pinned,
                   p.created_at, p.updated_at, substr(p.body, 1, 280) excerpt,
                   (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) comment_count,
                   (SELECT COUNT(*) FROM fix_confirmations f WHERE f.post_id = p.id) fix_confirmation_count,
                   (SELECT COUNT(*) FROM post_quality_signals q WHERE q.post_id = p.id AND q.signal = 'helpful') helpful_count,
                   (SELECT COUNT(*) FROM post_quality_signals q WHERE q.post_id = p.id AND q.signal = 'stale') stale_count
            FROM saved_posts s
            JOIN posts p ON p.id = s.post_id
            WHERE s.save_token = ?
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        """.trimIndent()
        return connection.prepareStatement(sql).use {
            it.setString(1, saveToken)
            it.setInt(2, limit)
            it.setInt(3, offset)
            it.executeQuery().use { results -> buildList { while (results.next()) add(results.toSummary()) } }
        }
    }

    @Synchronized
    fun confirmFix(postId: Long, actorToken: String): Int? {
        val label = connection.prepareStatement("SELECT knowledge_label FROM posts WHERE id = ?").use {
            it.setLong(1, postId)
            it.executeQuery().use { result -> if (result.next()) result.getString("knowledge_label") else null }
        } ?: return null
        if (label != "Fix") return null
        connection.prepareStatement(
            "INSERT OR IGNORE INTO fix_confirmations (post_id, actor_token) VALUES (?, ?)",
        ).use {
            it.setLong(1, postId)
            it.setString(2, actorToken)
            it.executeUpdate()
        }
        return fixConfirmationCount(postId)
    }

    @Synchronized
    fun addQualitySignal(postId: Long, actorToken: String, signal: String): QualitySignalResponse? {
        if (signal !in setOf("helpful", "stale") || !postExists(postId)) return null
        connection.prepareStatement(
            "INSERT OR IGNORE INTO post_quality_signals (post_id, actor_token, signal) VALUES (?, ?, ?)",
        ).use {
            it.setLong(1, postId)
            it.setString(2, actorToken)
            it.setString(3, signal)
            it.executeUpdate()
        }
        return qualitySummary(postId)
    }

    @Synchronized
    fun setPinned(postId: Long, isPinned: Boolean): QualitySignalResponse? {
        val changed = connection.prepareStatement("UPDATE posts SET is_pinned = ? WHERE id = ?").use {
            it.setInt(1, if (isPinned) 1 else 0)
            it.setLong(2, postId)
            it.executeUpdate()
        }
        return if (changed > 0) qualitySummary(postId) else null
    }

    @Synchronized
    fun listModels(): List<com.autoflex.shared.ModelSummary> {
        val sql = """
            SELECT brand, model, COUNT(*) post_count,
                   SUM(CASE WHEN knowledge_label = 'Known issue' THEN 1 ELSE 0 END) known_issue_count,
                   SUM(CASE WHEN knowledge_label = 'Fix' THEN 1 ELSE 0 END) fix_count,
                   SUM(CASE WHEN knowledge_label = 'Cost note' THEN 1 ELSE 0 END) cost_note_count,
                   MAX(updated_at) latest_post_at
            FROM posts
            WHERE model <> ''
            GROUP BY brand, model
            ORDER BY post_count DESC, latest_post_at DESC
        """.trimIndent()
        return connection.prepareStatement(sql).use {
            it.executeQuery().use { results -> buildList { while (results.next()) add(results.toModelSummary()) } }
        }
    }

    @Synchronized
    fun getPost(id: Long, incrementViews: Boolean = true): Post? {
        val post = connection.prepareStatement("SELECT * FROM posts WHERE id = ?").use {
            it.setLong(1, id)
            it.executeQuery().use { results -> if (results.next()) results.toPost() else null }
        } ?: return null
        if (incrementViews) {
            connection.prepareStatement("UPDATE posts SET views = views + 1 WHERE id = ?").use {
                it.setLong(1, id)
                it.executeUpdate()
            }
        }
        val comments = connection.prepareStatement(
            "SELECT id, author, body, created_at FROM comments WHERE post_id = ? ORDER BY created_at ASC",
        ).use {
            it.setLong(1, id)
            it.executeQuery().use { results -> buildList { while (results.next()) add(results.toComment()) } }
        }
        return post.copy(
            views = post.views + if (incrementViews) 1 else 0,
            fixConfirmationCount = fixConfirmationCount(id),
            helpfulCount = qualityCount(id, "helpful"),
            staleCount = qualityCount(id, "stale"),
            comments = comments,
        )
    }

    @Synchronized
    fun createPost(draft: PostDraft, token: String, ownerToken: String? = null): Long = connection.prepareStatement(
        """INSERT INTO posts (title, body, author, brand, topic, knowledge_label, model, variant, city,
           odometer_km, cover, edit_token, owner_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        java.sql.Statement.RETURN_GENERATED_KEYS,
    ).use {
        it.setString(1, draft.title)
        it.setString(2, draft.body)
        it.setString(3, draft.author)
        it.setString(4, draft.brand)
        it.setString(5, draft.topic)
        it.setString(6, draft.knowledgeLabel)
        it.setString(7, draft.model)
        it.setString(8, draft.variant)
        it.setString(9, draft.city)
        it.setObject(10, draft.odometerKm)
        it.setString(11, draft.cover.takeIf(String::isNotBlank))
        it.setString(12, token)
        it.setString(13, ownerToken)
        it.executeUpdate()
        it.generatedKeys.use { keys -> check(keys.next()); keys.getLong(1) }
    }

    @Synchronized
    fun ownsPost(id: Long, token: String): Boolean = ownsPost(id, token, "")

    @Synchronized
    fun ownsPost(id: Long, editToken: String, profileToken: String): Boolean {
        val stored = connection.prepareStatement("SELECT edit_token, owner_token FROM posts WHERE id = ?").use {
            it.setLong(1, id)
            it.executeQuery().use { result ->
                if (result.next()) result.getString("edit_token") to result.getString("owner_token") else null
            }
        } ?: return false
        return (editToken.isNotBlank() && stored.first.secureEquals(editToken)) ||
            (profileToken.isNotBlank() && stored.second?.secureEquals(profileToken) == true)
    }

    @Synchronized
    fun updatePost(id: Long, draft: PostDraft) {
        connection.prepareStatement(
            """UPDATE posts SET title=?, body=?, author=?, brand=?, topic=?, knowledge_label=?,
               model=?, variant=?, city=?, odometer_km=?, cover=?,
               updated_at=datetime('now') WHERE id=?""",
        ).use {
            it.setString(1, draft.title)
            it.setString(2, draft.body)
            it.setString(3, draft.author)
            it.setString(4, draft.brand)
            it.setString(5, draft.topic)
            it.setString(6, draft.knowledgeLabel)
            it.setString(7, draft.model)
            it.setString(8, draft.variant)
            it.setString(9, draft.city)
            it.setObject(10, draft.odometerKm)
            it.setString(11, draft.cover.takeIf(String::isNotBlank))
            it.setLong(12, id)
            it.executeUpdate()
        }
    }

    @Synchronized
    fun deletePost(id: Long): Boolean = connection.prepareStatement("DELETE FROM posts WHERE id = ?").use {
        it.setLong(1, id)
        it.executeUpdate() > 0
    }

    @Synchronized
    fun deleteReport(id: Long): Boolean {
        return connection.prepareStatement("DELETE FROM post_reports WHERE id = ?").use {
            it.setLong(1, id)
            it.executeUpdate() > 0
        }
    }

    @Synchronized
    fun blockPostOwner(postId: Long, reason: String): Boolean {
        val token = connection.prepareStatement("SELECT owner_token FROM posts WHERE id = ?").use {
            it.setLong(1, postId)
            it.executeQuery().use { result -> if (result.next()) result.getString("owner_token") else null }
        }?.takeIf(String::isNotBlank) ?: return false
        connection.prepareStatement(
            "INSERT OR REPLACE INTO blocked_tokens (token, reason) VALUES (?, ?)",
        ).use {
            it.setString(1, token)
            it.setString(2, reason)
            it.executeUpdate()
        }
        return true
    }

    @Synchronized
    fun isBlocked(token: String): Boolean = connection.prepareStatement(
        "SELECT 1 FROM blocked_tokens WHERE token = ?",
    ).use {
        it.setString(1, token)
        it.executeQuery().use(ResultSet::next)
    }

    @Synchronized
    fun likePost(id: Long): Int? {
        val changed = connection.prepareStatement("UPDATE posts SET likes = likes + 1 WHERE id = ?").use {
            it.setLong(1, id)
            it.executeUpdate()
        }
        if (changed == 0) return null
        return connection.prepareStatement("SELECT likes FROM posts WHERE id = ?").use {
            it.setLong(1, id)
            it.executeQuery().use { result -> result.next(); result.getInt(1) }
        }
    }

    @Synchronized
    fun addComment(postId: Long, author: String, body: String): Comment? {
        if (!postExists(postId)) return null
        val id = connection.prepareStatement(
            "INSERT INTO comments (post_id, author, body) VALUES (?, ?, ?)",
            java.sql.Statement.RETURN_GENERATED_KEYS,
        ).use {
            it.setLong(1, postId)
            it.setString(2, author)
            it.setString(3, body)
            it.executeUpdate()
            it.generatedKeys.use { keys -> keys.next(); keys.getLong(1) }
        }
        return connection.prepareStatement(
            "SELECT id, author, body, created_at FROM comments WHERE id = ?",
        ).use {
            it.setLong(1, id)
            it.executeQuery().use { result -> result.next(); result.toComment() }
        }
    }

    @Synchronized
    fun reportPost(postId: Long, reporter: String, reason: String): Long? {
        if (!postExists(postId)) return null
        return connection.prepareStatement(
            "INSERT INTO post_reports (post_id, reporter, reason) VALUES (?, ?, ?)",
            java.sql.Statement.RETURN_GENERATED_KEYS,
        ).use {
            it.setLong(1, postId)
            it.setString(2, reporter)
            it.setString(3, reason)
            it.executeUpdate()
            it.generatedKeys.use { keys -> keys.next(); keys.getLong(1) }
        }
    }

    @Synchronized
    fun addFeedback(name: String, message: String, context: String, actorToken: String?): Long {
        return connection.prepareStatement(
            "INSERT INTO product_feedback (name, message, context, actor_token) VALUES (?, ?, ?, ?)",
            java.sql.Statement.RETURN_GENERATED_KEYS,
        ).use {
            it.setString(1, name)
            it.setString(2, message)
            it.setString(3, context)
            it.setString(4, actorToken)
            it.executeUpdate()
            it.generatedKeys.use { keys -> keys.next(); keys.getLong(1) }
        }
    }

    @Synchronized
    fun listFeedback(limit: Int, offset: Int): List<FeedbackSummary> {
        return connection.prepareStatement(
            "SELECT id, name, message, context, created_at FROM product_feedback ORDER BY created_at DESC LIMIT ? OFFSET ?",
        ).use {
            it.setInt(1, limit)
            it.setInt(2, offset)
            it.executeQuery().use { result -> buildList { while (result.next()) add(result.toFeedbackSummary()) } }
        }
    }

    @Synchronized
    fun addClientError(message: String, source: String, stack: String, path: String, actorToken: String?): Long {
        return connection.prepareStatement(
            "INSERT INTO client_errors (message, source, stack, path, actor_token) VALUES (?, ?, ?, ?, ?)",
            java.sql.Statement.RETURN_GENERATED_KEYS,
        ).use {
            it.setString(1, message)
            it.setString(2, source)
            it.setString(3, stack)
            it.setString(4, path)
            it.setString(5, actorToken)
            it.executeUpdate()
            it.generatedKeys.use { keys -> keys.next(); keys.getLong(1) }
        }
    }

    @Synchronized
    fun listClientErrors(limit: Int, offset: Int): List<ClientErrorSummary> {
        return connection.prepareStatement(
            "SELECT id, message, source, stack, path, created_at FROM client_errors ORDER BY created_at DESC LIMIT ? OFFSET ?",
        ).use {
            it.setInt(1, limit)
            it.setInt(2, offset)
            it.executeQuery().use { result -> buildList { while (result.next()) add(result.toClientErrorSummary()) } }
        }
    }

    @Synchronized
    fun reportCount(postId: Long): Int = connection.prepareStatement(
        "SELECT COUNT(*) FROM post_reports WHERE post_id = ?",
    ).use {
        it.setLong(1, postId)
        it.executeQuery().use { result -> result.next(); result.getInt(1) }
    }

    @Synchronized
    fun fixConfirmationCount(postId: Long): Int = connection.prepareStatement(
        "SELECT COUNT(*) FROM fix_confirmations WHERE post_id = ?",
    ).use {
        it.setLong(1, postId)
        it.executeQuery().use { result -> result.next(); result.getInt(1) }
    }

    @Synchronized
    fun qualitySummary(postId: Long): QualitySignalResponse? {
        val pinned = connection.prepareStatement("SELECT is_pinned FROM posts WHERE id = ?").use {
            it.setLong(1, postId)
            it.executeQuery().use { result -> if (result.next()) result.getBoolean("is_pinned") else null }
        } ?: return null
        return QualitySignalResponse(
            helpfulCount = qualityCount(postId, "helpful"),
            staleCount = qualityCount(postId, "stale"),
            isPinned = pinned,
        )
    }

    @Synchronized
    fun qualityCount(postId: Long, signal: String): Int = connection.prepareStatement(
        "SELECT COUNT(*) FROM post_quality_signals WHERE post_id = ? AND signal = ?",
    ).use {
        it.setLong(1, postId)
        it.setString(2, signal)
        it.executeQuery().use { result -> result.next(); result.getInt(1) }
    }

    @Synchronized
    fun listReports(limit: Int, offset: Int): List<ReportSummary> {
        val sql = """
            SELECT r.id, r.post_id, p.title post_title, r.reporter, r.reason, r.created_at, p.is_pinned,
                   EXISTS(SELECT 1 FROM blocked_tokens b WHERE b.token = p.owner_token) owner_blocked
            FROM post_reports r
            JOIN posts p ON p.id = r.post_id
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        """.trimIndent()
        return connection.prepareStatement(sql).use {
            it.setInt(1, limit)
            it.setInt(2, offset)
            it.executeQuery().use { result -> buildList { while (result.next()) add(result.toReportSummary()) } }
        }
    }

    @Synchronized
    fun savePost(postId: Long, saveToken: String): Boolean {
        if (!postExists(postId)) return false
        connection.prepareStatement(
            "INSERT OR IGNORE INTO saved_posts (save_token, post_id) VALUES (?, ?)",
        ).use {
            it.setString(1, saveToken)
            it.setLong(2, postId)
            it.executeUpdate()
        }
        return true
    }

    @Synchronized
    fun unsavePost(postId: Long, saveToken: String) {
        connection.prepareStatement("DELETE FROM saved_posts WHERE save_token = ? AND post_id = ?").use {
            it.setString(1, saveToken)
            it.setLong(2, postId)
            it.executeUpdate()
        }
    }

    @Synchronized
    fun createProfile(displayName: String, profileToken: String, recoveryHash: String): Profile {
        connection.prepareStatement(
            "INSERT OR REPLACE INTO profiles (profile_token, display_name, recovery_hash) VALUES (?, ?, ?)",
        ).use {
            it.setString(1, profileToken)
            it.setString(2, displayName)
            it.setString(3, recoveryHash)
            it.executeUpdate()
        }
        return Profile(displayName, profileToken)
    }

    @Synchronized
    fun recoverProfile(recoveryHash: String): Profile? = connection.prepareStatement(
        "SELECT display_name, profile_token FROM profiles WHERE recovery_hash = ?",
    ).use {
        it.setString(1, recoveryHash)
        it.executeQuery().use { result ->
            if (result.next()) Profile(result.getString("display_name"), result.getString("profile_token")) else null
        }
    }

    @Synchronized
    fun deleteProfile(profileToken: String) {
        connection.prepareStatement("DELETE FROM posts WHERE owner_token = ?").use {
            it.setString(1, profileToken)
            it.executeUpdate()
        }
        connection.prepareStatement("DELETE FROM saved_posts WHERE save_token = ?").use {
            it.setString(1, profileToken)
            it.executeUpdate()
        }
        connection.prepareStatement("DELETE FROM blocked_tokens WHERE token = ?").use {
            it.setString(1, profileToken)
            it.executeUpdate()
        }
        connection.prepareStatement("DELETE FROM profiles WHERE profile_token = ?").use {
            it.setString(1, profileToken)
            it.executeUpdate()
        }
    }

    @Synchronized
    fun stats(): Pair<Int, Int> = count("posts") to count("comments")

    private fun postExists(id: Long): Boolean = connection.prepareStatement("SELECT 1 FROM posts WHERE id = ?").use {
        it.setLong(1, id)
        it.executeQuery().use(ResultSet::next)
    }

    private fun count(table: String): Int = connection.createStatement().use {
        it.executeQuery("SELECT COUNT(*) FROM $table").use { result -> result.next(); result.getInt(1) }
    }

    private fun ensureColumn(table: String, column: String, type: String) {
        val exists = connection.createStatement().use {
            it.executeQuery("PRAGMA table_info($table)").use { result ->
                generateSequence { if (result.next()) result.getString("name") else null }.any(column::equals)
            }
        }
        if (!exists) connection.createStatement().use { it.execute("ALTER TABLE $table ADD COLUMN $column $type") }
    }

    override fun close() = connection.close()
}

data class Profile(val displayName: String, val profileToken: String)

private fun ResultSet.toSummary() = PostSummary(
    id = getLong("id"), title = getString("title"), author = getString("author"),
    brand = getString("brand"), topic = getString("topic"), knowledgeLabel = getString("knowledge_label"),
    model = getString("model"),
    variant = getString("variant"), city = getString("city"), odometerKm = getIntOrNull("odometer_km"),
    cover = getString("cover"),
    views = getInt("views"), likes = getInt("likes"), createdAt = getString("created_at"),
    updatedAt = getString("updated_at"), excerpt = getString("excerpt"),
    commentCount = getInt("comment_count"),
    fixConfirmationCount = getInt("fix_confirmation_count"),
    helpfulCount = getInt("helpful_count"),
    staleCount = getInt("stale_count"),
    isPinned = getBoolean("is_pinned"),
)

private fun ResultSet.toModelSummary() = com.autoflex.shared.ModelSummary(
    brand = getString("brand"), model = getString("model"),
    postCount = getInt("post_count"), knownIssueCount = getInt("known_issue_count"),
    fixCount = getInt("fix_count"), costNoteCount = getInt("cost_note_count"),
    latestPostAt = getString("latest_post_at"),
)

private fun ResultSet.toPost() = Post(
    id = getLong("id"), title = getString("title"), body = getString("body"),
    author = getString("author"), brand = getString("brand"), topic = getString("topic"),
    knowledgeLabel = getString("knowledge_label"),
    model = getString("model"), variant = getString("variant"), city = getString("city"),
    odometerKm = getIntOrNull("odometer_km"),
    cover = getString("cover"), views = getInt("views"), likes = getInt("likes"),
    isPinned = getBoolean("is_pinned"),
    createdAt = getString("created_at"), updatedAt = getString("updated_at"),
)

private fun ResultSet.toComment() = Comment(
    id = getLong("id"), author = getString("author"), body = getString("body"),
    createdAt = getString("created_at"),
)

private fun ResultSet.toReportSummary() = ReportSummary(
    id = getLong("id"), postId = getLong("post_id"), postTitle = getString("post_title"),
    reporter = getString("reporter"), reason = getString("reason"), createdAt = getString("created_at"),
    ownerBlocked = getBoolean("owner_blocked"),
    isPinned = getBoolean("is_pinned"),
)

private fun ResultSet.toFeedbackSummary() = FeedbackSummary(
    id = getLong("id"), name = getString("name"), message = getString("message"),
    context = getString("context"), createdAt = getString("created_at"),
)

private fun ResultSet.toClientErrorSummary() = ClientErrorSummary(
    id = getLong("id"), message = getString("message"), source = getString("source"),
    stack = getString("stack"), path = getString("path"), createdAt = getString("created_at"),
)

private fun String.secureEquals(other: String) = MessageDigest.isEqual(toByteArray(), other.toByteArray())

private fun ResultSet.getIntOrNull(column: String): Int? {
    val value = getInt(column)
    return if (wasNull()) null else value
}

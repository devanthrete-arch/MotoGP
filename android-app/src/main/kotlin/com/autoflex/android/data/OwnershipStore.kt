package com.autoflex.android.data

import android.content.Context

class OwnershipStore(context: Context) {
    private val preferences = context.getSharedPreferences("autoflex_ownership", Context.MODE_PRIVATE)

    fun token(postId: Long): String? = preferences.getString(postId.toString(), null)
    fun owns(postId: Long): Boolean = token(postId) != null
    fun save(postId: Long, token: String) = preferences.edit().putString(postId.toString(), token).apply()
    fun remove(postId: Long) = preferences.edit().remove(postId.toString()).apply()
}

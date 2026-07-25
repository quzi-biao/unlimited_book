package com.flipbook.ai.flipbook.migrated.db

import android.content.Context
import com.google.gson.Gson
import com.google.gson.JsonNull
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@PublishedApi
internal const val STORE_NAME = "flipbook_store"

@PublishedApi
internal val gson = Gson()

data class NsEntry(
    val key: String,
    val value: Any?,
)

/** 对应 WebView: db/nativeStore.js */
suspend fun nsSet(context: Context, key: String, value: Any?) = withContext(Dispatchers.IO) {
    val encoded = if (value == null) null else gson.toJson(value)
    context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE)
        .edit()
        .apply {
            if (encoded == null) remove(key) else putString(key, encoded)
        }
        .apply()
}

/** 对应 WebView: db/nativeStore.js */
suspend inline fun <reified T> nsGet(context: Context, key: String): T? = withContext(Dispatchers.IO) {
    val raw = context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE).getString(key, null) ?: return@withContext null
    runCatching {
        gson.fromJson<T>(raw, object : TypeToken<T>() {}.type)
    }.getOrNull()
}

/** 对应 WebView: db/nativeStore.js */
suspend fun nsDelete(context: Context, key: String) = withContext(Dispatchers.IO) {
    context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE)
        .edit()
        .remove(key)
        .apply()
}

/** 对应 WebView: db/nativeStore.js */
suspend fun nsSetMany(context: Context, entries: List<NsEntry>) = withContext(Dispatchers.IO) {
    if (entries.isEmpty()) return@withContext
    val editor = context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE).edit()
    entries.forEach { (key, value) ->
        val encoded = if (value == null) null else gson.toJson(value)
        if (encoded == null) editor.remove(key) else editor.putString(key, encoded)
    }
    editor.apply()
}

/** 对应 WebView: db/nativeStore.js */
suspend fun nsGetByPrefix(context: Context, prefix: String): List<NsEntry> = withContext(Dispatchers.IO) {
    val prefs = context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE)
    prefs.all.keys
        .filter { it.startsWith(prefix) }
        .sorted()
        .mapNotNull { key ->
            val raw = prefs.getString(key, null)
            if (raw == null) {
                NsEntry(key = key, value = null)
            } else {
                runCatching {
                    val parsed = JsonParser.parseString(raw)
                    val value: Any? = if (parsed is JsonNull) null else gson.fromJson(raw, Any::class.java)
                    NsEntry(key = key, value = value)
                }.getOrNull()
            }
        }
}

/** 对应 WebView: db/nativeStore.js */
suspend fun nsDeleteByPrefix(context: Context, prefix: String) = withContext(Dispatchers.IO) {
    val prefs = context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE)
    val editor = prefs.edit()
    prefs.all.keys.filter { it.startsWith(prefix) }.forEach(editor::remove)
    editor.apply()
}

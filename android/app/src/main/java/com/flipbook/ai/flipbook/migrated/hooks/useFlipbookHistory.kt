package com.flipbook.ai.flipbook.migrated.hooks

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

private const val PREF = "flipbook_history"
private const val KEY = "flipbook-history-state"
private const val MAX_HISTORY = 40
private val gson = Gson()

data class HistoryEntry(
    val query: String = "",
    val url: String? = null,
    val pageId: String? = null,
)

data class StoredHistory(
    val history: List<HistoryEntry> = emptyList(),
    val cursor: Int = -1,
    val bookId: String? = null,
    val bookTitle: String = "",
)

fun saveHistoryState(
    context: Context,
    history: List<HistoryEntry>,
    cursor: Int,
    bookId: String?,
    bookTitle: String,
) {
    val trimmed = history.takeLast(MAX_HISTORY)
    val newCursor = cursor.coerceIn(-1, trimmed.lastIndex)
    val payload = StoredHistory(
        history = trimmed,
        cursor = newCursor,
        bookId = bookId,
        bookTitle = bookTitle,
    )
    context.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY, gson.toJson(payload))
        .apply()
}

private fun parseStoredHistory(context: Context): StoredHistory? {
    val raw = context.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(KEY, null) ?: return null
    return runCatching {
        gson.fromJson(raw, object : TypeToken<StoredHistory>() {}.type) as StoredHistory
    }.getOrNull()
}

/** 对应 WebView: hooks/useFlipbookHistory.js */
class FlipbookHistoryState internal constructor(
    context: Context,
) {
    private val appContext = context.applicationContext
    private val stored = parseStoredHistory(appContext)

    var history by mutableStateOf(stored?.history ?: emptyList())
        private set
    var cursor by mutableIntStateOf(stored?.cursor ?: -1)
        private set
    var initialBookId: String? = stored?.bookId
        private set
    var initialBookTitle: String = stored?.bookTitle ?: ""
        private set
    var initialImageUrl: String? = stored?.history?.getOrNull(stored.cursor.coerceAtLeast(0))?.url
        private set

    fun updateHistory(newHistory: List<HistoryEntry>) {
        history = newHistory
    }

    fun updateCursor(newCursor: Int) {
        cursor = newCursor
    }

    fun persist(bookId: String?, bookTitle: String) {
        saveHistoryState(
            context = appContext,
            history = history,
            cursor = cursor,
            bookId = bookId,
            bookTitle = bookTitle,
        )
    }
}

@Composable
fun rememberFlipbookHistoryState(): FlipbookHistoryState {
    val context = LocalContext.current.applicationContext
    return remember(context) { FlipbookHistoryState(context) }
}

package com.flipbook.ai.flipbook.migrated.hooks

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.db.BookRecord
import com.flipbook.ai.flipbook.migrated.db.getBookTree
import com.flipbook.ai.flipbook.migrated.db.getBooks
import com.flipbook.ai.flipbook.migrated.db.saveBookPages
import com.flipbook.ai.flipbook.migrated.db.saveBookTree
import com.flipbook.ai.flipbook.migrated.db.saveBooks
import com.flipbook.ai.flipbook.migrated.utils.flattenTree
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

private suspend fun prefetchPageTrees(context: Context, books: List<BookRecord>) {
    if (books.isEmpty()) return
    books.forEach { book ->
        if (book.id.isBlank()) return@forEach
        runCatching {
            val existing = getBookTree(context, book.id)
            if (existing != null) return@runCatching
            val server = booksApi.pages(context, book.id)
            saveBookTree(context, book.id, server.tree)
            saveBookPages(context, book.id, flattenTree(server.tree))
        }
    }
}

class UseBooksState internal constructor(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    var books by mutableStateOf<List<BookRecord>>(emptyList())
        private set
    var loading by mutableStateOf(true)
        private set

    private var started by mutableStateOf(false)
    private var requestSeq by mutableIntStateOf(0)

    fun ensureStarted() {
        if (started) return
        started = true
        scope.launch { initLoad() }
    }

    fun refresh() {
        scope.launch { syncFromServer(showLoading = true) }
    }

    private suspend fun initLoad() {
        runCatching { getBooks(context) }
            .onSuccess { local ->
                if (local.isNotEmpty()) {
                    books = local
                    loading = false
                    syncFromServer(showLoading = false)
                } else {
                    syncFromServer(showLoading = true)
                }
            }
            .onFailure {
                syncFromServer(showLoading = true)
            }
    }

    private suspend fun syncFromServer(showLoading: Boolean) {
        val seq = ++requestSeq
        if (showLoading) loading = true
        runCatching { booksApi.list(context).books }
            .onSuccess { fresh ->
                saveBooks(context, fresh)
                if (seq == requestSeq) books = fresh
                prefetchPageTrees(context, fresh)
            }
            .onFailure {
                // 保持本地缓存，不清空列表。
            }
        if (seq == requestSeq) loading = false
    }
}

/** 对应 WebView: hooks/useBooks.js */
@Composable
fun rememberUseBooksState(): UseBooksState {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    val state = remember(context, scope) { UseBooksState(context, scope) }
    LaunchedEffect(state) { state.ensureStarted() }
    return state
}

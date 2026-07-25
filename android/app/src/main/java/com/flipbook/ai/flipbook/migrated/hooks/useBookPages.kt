package com.flipbook.ai.flipbook.migrated.hooks

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.flipbook.migrated.api.PageNode
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.db.getBookTree
import com.flipbook.ai.flipbook.migrated.db.saveBookPages
import com.flipbook.ai.flipbook.migrated.db.saveBookTree
import com.flipbook.ai.flipbook.migrated.utils.flattenTree
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** 对应 WebView: hooks/useBookPages.js */
class BookPagesState internal constructor(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    var tree by mutableStateOf<List<PageNode>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf("")
        private set
    private var activeBookId: String? = null

    fun bind(bookId: String?) {
        if (activeBookId == bookId) return
        activeBookId = bookId
        if (bookId.isNullOrBlank()) {
            tree = emptyList()
            loading = false
            error = ""
            return
        }
        scope.launch { load(bookId) }
    }

    fun reload() {
        val id = activeBookId ?: return
        scope.launch { syncFromServer(id, showLoading = true) }
    }

    private suspend fun load(bookId: String) {
        loading = true
        error = ""
        runCatching { getBookTree(context, bookId) }
            .onSuccess { cached ->
                if (!cached.isNullOrEmpty()) {
                    tree = cached
                    loading = false
                    syncFromServer(bookId, showLoading = false)
                } else {
                    syncFromServer(bookId, showLoading = true)
                }
            }
            .onFailure {
                syncFromServer(bookId, showLoading = true)
            }
    }

    private suspend fun syncFromServer(bookId: String, showLoading: Boolean) {
        if (showLoading) loading = true
        runCatching { booksApi.pages(context, bookId).tree }
            .onSuccess { fresh ->
                tree = fresh
                saveBookTree(context, bookId, fresh)
                saveBookPages(context, bookId, flattenTree(fresh))
                error = ""
            }
            .onFailure { err ->
                if (showLoading) error = err.message ?: "加载失败"
            }
        loading = false
    }
}

@Composable
fun rememberBookPagesState(bookId: String?): BookPagesState {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    val state = remember(context, scope) { BookPagesState(context, scope) }
    LaunchedEffect(bookId) { state.bind(bookId) }
    return state
}

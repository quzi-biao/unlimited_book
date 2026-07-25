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
import coil.ImageLoader
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.db.getPagesByBook
import com.flipbook.ai.flipbook.migrated.db.saveBookPages
import com.flipbook.ai.flipbook.migrated.db.saveBookTree
import com.flipbook.ai.flipbook.migrated.utils.FlatPageNode
import com.flipbook.ai.flipbook.migrated.utils.flattenTree
import com.flipbook.ai.flipbook.migrated.utils.treeNeighbor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class FlipbookOpenPage(
    val imageUrl: String?,
    val pageId: String,
    val bookId: String?,
    val title: String?,
    val bookTitle: String?,
)

data class FlipbookRegionBox(
    val x: Float,
    val y: Float,
    val w: Float,
    val h: Float,
)

data class FlipbookViewportSize(
    val w: Float,
    val h: Float,
)

data class FlipbookRegionAnnotation(
    val id: String?,
    val x: Float,
    val y: Float,
    val w: Float,
    val h: Float,
    val explanation: String?,
    val exploredPageId: String? = null,
)

/** 对应 WebView: hooks/useFlipbook.js */
class FlipbookState internal constructor(
    private val context: Context,
    private val scope: CoroutineScope,
    imageLoader: ImageLoader,
    private val historyState: FlipbookHistoryState,
    private val exploreQueueState: ExploreQueueState,
) {
    private val taskRunner = FlipbookTaskRunner(
        context = context,
        scope = scope,
        imageLoader = imageLoader,
        onFlatPageAppended = { bookId, entry ->
            if (currentBookId == bookId) {
                scope.launch(Dispatchers.Main.immediate) {
                    bookFlat = bookFlat + entry
                }
            }
        },
    )

    // Landing 已移除，始终显示 Viewport
    var showLanding by mutableStateOf(false)
        private set
    var imageUrl by mutableStateOf(historyState.initialImageUrl)
        private set
    var imageVisible by mutableStateOf(!historyState.initialImageUrl.isNullOrBlank())
        private set
    var progress by mutableStateOf(15f)
        private set
    var errorMsg by mutableStateOf("")
        private set

    var shelfOpen by mutableStateOf(false)
        private set

    var currentBookId by mutableStateOf(historyState.initialBookId)
        private set
    var currentBookTitle by mutableStateOf(historyState.initialBookTitle)
        private set

    var bookFlat by mutableStateOf<List<FlatPageNode>>(emptyList())
        private set

    var queueError by mutableStateOf("")
        private set
    private var queueErrorJob: Job? = null

    val history: List<HistoryEntry> get() = historyState.history
    val cursor: Int get() = historyState.cursor

    val currentPageId: String?
        get() = if (cursor >= 0) history.getOrNull(cursor)?.pageId else null

    val currentQuery: String
        get() = if (cursor >= 0) history.getOrNull(cursor)?.query.orEmpty() else ""

    val currentPageTitle: String
        get() = bookFlat.firstOrNull { it.id == currentPageId }?.title ?: currentQuery

    val exploreQueue: List<ExploreTask>
        get() = exploreQueueState.queue

    val exploreProcessing: Boolean
        get() = exploreQueueState.isProcessing

    fun updateShelfOpen(open: Boolean) {
        shelfOpen = open
    }

    fun persistHistory() {
        historyState.persist(bookId = currentBookId, bookTitle = currentBookTitle)
    }

    fun processExploreQueue() {
        exploreQueueState.process(::runExploreTask)
    }

    fun loadCurrentBookPages() {
        val bookId = currentBookId
        if (bookId.isNullOrBlank()) {
            bookFlat = emptyList()
            return
        }
        scope.launch {
            val local = runCatching { getPagesByBook(context, bookId) }.getOrDefault(emptyList())
            if (local.isNotEmpty()) {
                onMain {
                    bookFlat = local.map {
                        FlatPageNode(
                            id = it.id,
                            imageUrl = it.imageUrl,
                            prompt = it.prompt,
                            title = it.title,
                        )
                    }
                }
            }
            refreshBookFlat(bookId)
        }
    }

    fun browse(
        rawQuery: String,
        isNewSearch: Boolean = true,
        parentPageId: String? = null,
    ) {
        val query = rawQuery.trim()
        if (query.isBlank()) return

        val dedupeKey = "topic-$query-${currentBookId ?: "new"}-${parentPageId ?: "root"}"
        val result = exploreQueueState.addTask(
            ExploreTask(
                type = "topic",
                dedupeKey = dedupeKey,
                bookTitle = if (isNewSearch) query else currentBookTitle,
                sourcePageTitle = query,
                payload = mapOf(
                    "query" to query,
                    "isNewSearch" to isNewSearch,
                    "bookId" to currentBookId,
                    "parentPageId" to parentPageId,
                ),
            ),
        )
        if (result == "queue_full") {
            showQueueError("队列已满（最多5个），请等待完成后再探索")
        }
    }

    fun cancelExploreTask(taskId: String) {
        exploreQueueState.cancelTask(taskId)
    }

    fun retryExploreTask(taskId: String) {
        exploreQueueState.retryTask(taskId)
        processExploreQueue()
    }

    fun dismissExploreTask(taskId: String) {
        exploreQueueState.dismissTask(taskId)
    }

    fun navGo(delta: Int) {
        jumpTo(cursor + delta)
    }

    fun viewportNavGo(delta: Int) {
        treeNavGo(delta)
    }

    fun doReload() {
        if (cursor < 0) return
        val query = history.getOrNull(cursor)?.query.orEmpty()
        if (query.isBlank()) return
        browse(query, isNewSearch = false)
    }

    fun goToLanding() {
        // Landing 已移除，此方法保留签名但不再跳转
    }

    fun handleNavigateToPage(targetPageId: String) {
        val histIdx = history.indexOfFirst { it.pageId == targetPageId }
        if (histIdx >= 0) {
            jumpTo(histIdx)
            return
        }

        val page = bookFlat.firstOrNull { it.id == targetPageId } ?: return
        appendHistory(
            entry = HistoryEntry(
                query = page.title ?: page.prompt.orEmpty(),
                url = page.imageUrl,
                pageId = page.id,
            ),
            replaceAsCrossBook = false,
        )
        transitionToImage(page.imageUrl)
    }

    fun openBookPage(page: FlipbookOpenPage) {
        if (currentPageId == page.pageId) {
            showLanding = false
            imageVisible = true
            return
        }

        val isSameBook = page.bookId.isNullOrBlank() || page.bookId == currentBookId
        if (!isSameBook) {
            val entry = HistoryEntry(
                query = page.title ?: page.imageUrl.orEmpty(),
                url = page.imageUrl,
                pageId = page.pageId,
            )
            setHistoryAndCursor(listOf(entry), 0)
            currentBookId = page.bookId
            currentBookTitle = page.bookTitle.orEmpty()
            showLanding = false
            imageUrl = page.imageUrl
            imageVisible = true
            loadCurrentBookPages()
            return
        }

        val existIdx = history.indexOfFirst { it.pageId == page.pageId }
        if (existIdx >= 0) {
            jumpTo(existIdx)
            showLanding = false
            return
        }

        appendHistory(
            entry = HistoryEntry(
                query = page.title ?: page.imageUrl.orEmpty(),
                url = page.imageUrl,
                pageId = page.pageId,
            ),
            replaceAsCrossBook = false,
        )
        if (!page.bookTitle.isNullOrBlank()) currentBookTitle = page.bookTitle
        showLanding = false
        imageUrl = page.imageUrl
        imageVisible = true
    }

    fun handleRegionSelect(
        imageBase64: String?,
        box: FlipbookRegionBox,
        vpSize: FlipbookViewportSize,
        annotation: FlipbookRegionAnnotation?,
    ) {
        val bookId = currentBookId
        if (bookId.isNullOrBlank()) {
            errorMsg = "当前页面无关联书籍，无法深入探索"
            return
        }
        val exploredPageId = annotation?.exploredPageId
        if (!exploredPageId.isNullOrBlank()) {
            handleNavigateToPage(exploredPageId)
            return
        }

        val dedupeKey = annotation?.id?.let { "ann-$it" }
            ?: "region-$bookId-${currentPageId}-${box.x.toInt()}-${box.y.toInt()}-${box.w.toInt()}-${box.h.toInt()}"

        val result = exploreQueueState.addTask(
            ExploreTask(
                type = "expand",
                dedupeKey = dedupeKey,
                bookTitle = currentBookTitle,
                sourcePageTitle = currentPageTitle,
                payload = mapOf(
                    "imageBase64" to imageBase64,
                    "box" to mapOf("x" to box.x, "y" to box.y, "w" to box.w, "h" to box.h),
                    "vpSize" to mapOf("w" to vpSize.w, "h" to vpSize.h),
                    "annotation" to annotation?.let {
                        mapOf(
                            "id" to it.id,
                            "x" to it.x,
                            "y" to it.y,
                            "w" to it.w,
                            "h" to it.h,
                            "explanation" to it.explanation,
                            "exploredPageId" to it.exploredPageId,
                        )
                    },
                    "identification" to mapOf(
                        "type" to "scene",
                        "description" to (annotation?.explanation ?: "A detailed region from the current illustration."),
                    ),
                    "bookId" to bookId,
                    "curParentPageId" to currentPageId,
                    "curImageUrl" to imageUrl,
                ),
            ),
        )

        if (result == "queue_full") {
            showQueueError("队列已满（最多5个），请等待完成后再探索")
        }
    }

    private fun treeNavGo(delta: Int) {
        val pageId = currentPageId ?: return
        var target = treeNeighbor(bookFlat, pageId, delta)
        if (target == null && bookFlat.isNotEmpty()) {
            target = if (delta > 0) bookFlat.first() else bookFlat.last()
        }
        target ?: return

        val existIdx = history.indexOfFirst { it.pageId == target.id }
        if (existIdx >= 0) {
            jumpTo(existIdx)
            return
        }

        appendHistory(
            entry = HistoryEntry(
                query = target.title ?: target.prompt.orEmpty(),
                url = target.imageUrl,
                pageId = target.id,
            ),
            replaceAsCrossBook = false,
        )
        transitionToImage(target.imageUrl)
    }

    private fun jumpTo(index: Int) {
        if (index < 0 || index >= history.size) return
        val entry = history[index]
        historyState.updateCursor(index)
        transitionToImage(entry.url)
    }

    private fun appendHistory(entry: HistoryEntry, replaceAsCrossBook: Boolean) {
        val newHistory = if (replaceAsCrossBook) {
            listOf(entry)
        } else {
            history.take(cursor + 1) + entry
        }
        val newCursor = newHistory.lastIndex
        setHistoryAndCursor(newHistory, newCursor)
    }

    private fun setHistoryAndCursor(newHistory: List<HistoryEntry>, newCursor: Int) {
        historyState.updateHistory(newHistory)
        historyState.updateCursor(newCursor)
    }

    private fun showQueueError(msg: String) {
        queueError = msg
        queueErrorJob?.cancel()
        queueErrorJob = scope.launch {
            delay(3000)
            queueError = ""
        }
    }

    private fun transitionToImage(url: String?) {
        imageVisible = false
        scope.launch {
            delay(200)
            imageUrl = url
            imageVisible = true
            showLanding = false
        }
    }

    private suspend fun refreshBookFlat(bookId: String) {
        runCatching { booksApi.pages(context, bookId) }
            .onSuccess { remote ->
                val flat = flattenTree(remote.tree)
                saveBookTree(context, bookId, remote.tree)
                saveBookPages(context, bookId, flat)
                onMain {
                    if (currentBookId == bookId) bookFlat = flat
                }
            }
    }

    private suspend fun runExploreTask(task: ExploreTask): Map<String, Any?> {
        return taskRunner.run(task)
    }

    private suspend fun onMain(block: () -> Unit) {
        withContext(Dispatchers.Main.immediate) { block() }
    }
}

@Composable
fun rememberFlipbookState(): FlipbookState {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    val imageLoader = remember(context) { ImageLoader.Builder(context).build() }
    val historyState = rememberFlipbookHistoryState()
    val exploreQueueState = rememberExploreQueueState()

    val state = remember(context, scope, imageLoader, historyState, exploreQueueState) {
        FlipbookState(
            context = context,
            scope = scope,
            imageLoader = imageLoader,
            historyState = historyState,
            exploreQueueState = exploreQueueState,
        )
    }

    LaunchedEffect(state.currentBookId) {
        state.loadCurrentBookPages()
    }

    LaunchedEffect(
        state.history,
        state.cursor,
        state.currentBookId,
        state.currentBookTitle,
    ) {
        state.persistHistory()
    }

    LaunchedEffect(exploreQueueState.queue) {
        state.processExploreQueue()
    }

    return state
}

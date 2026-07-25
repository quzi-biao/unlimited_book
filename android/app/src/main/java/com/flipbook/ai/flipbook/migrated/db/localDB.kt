package com.flipbook.ai.flipbook.migrated.db

import android.content.Context
import com.flipbook.ai.flipbook.migrated.api.PageNode
import com.flipbook.ai.flipbook.migrated.utils.FlatPageNode
import com.google.gson.annotations.SerializedName
import java.time.Instant

data class BookCount(
    @SerializedName("pages")
    val pages: Int = 0,
)

data class BookRecord(
    @SerializedName("id")
    val id: String,
    @SerializedName("title")
    val title: String? = null,
    @SerializedName("updatedAt")
    val updatedAt: String? = null,
    @SerializedName("coverUrl")
    val coverUrl: String? = null,
    @SerializedName("_pageCount")
    val pageCount: Int? = null,
    @SerializedName("_savedAt")
    val savedAt: Long? = null,
    @SerializedName("_count")
    val count: BookCount? = null,
)

data class PageRecord(
    @SerializedName("id")
    val id: String,
    @SerializedName("bookId")
    val bookId: String,
    @SerializedName("imageUrl")
    val imageUrl: String? = null,
    @SerializedName("prompt")
    val prompt: String? = null,
    @SerializedName("title")
    val title: String? = null,
    @SerializedName("_order")
    val order: Int? = null,
    @SerializedName("_savedAt")
    val savedAt: Long? = null,
)

data class AnnotationRecord(
    @SerializedName("id")
    val id: String,
    @SerializedName("pageId")
    val pageId: String,
    @SerializedName("x")
    val x: Float = 0f,
    @SerializedName("y")
    val y: Float = 0f,
    @SerializedName("w")
    val w: Float = 0f,
    @SerializedName("h")
    val h: Float = 0f,
    @SerializedName("explanation")
    val explanation: String? = null,
    @SerializedName("exploredPageId")
    val exploredPageId: String? = null,
    @SerializedName("_savedAt")
    val savedAt: Long? = null,
)

/** 对应 WebView: db/localDB.js */
suspend fun saveBooks(context: Context, books: List<BookRecord>) {
    if (books.isEmpty()) return
    val now = System.currentTimeMillis()
    nsSet(context, "books", books.map { it.copy(savedAt = now) })
}

/** 对应 WebView: db/localDB.js */
suspend fun saveBook(context: Context, book: BookRecord) {
    val all = nsGet<List<BookRecord>>(context, "books")?.toMutableList() ?: mutableListOf()
    val idx = all.indexOfFirst { it.id == book.id }
    val entry = book.copy(savedAt = System.currentTimeMillis())
    if (idx >= 0) all[idx] = entry else all += entry
    nsSet(context, "books", all)
}

/** 对应 WebView: db/localDB.js */
suspend fun getBooks(context: Context): List<BookRecord> {
    val all = nsGet<List<BookRecord>>(context, "books") ?: emptyList()
    return all
        .map { b -> b.copy(count = BookCount(pages = b.pageCount ?: 0)) }
        .sortedByDescending { parseDateEpoch(it.updatedAt) }
}

/** 对应 WebView: db/localDB.js */
suspend fun getBook(context: Context, id: String): BookRecord? {
    val all = nsGet<List<BookRecord>>(context, "books") ?: emptyList()
    return all.firstOrNull { it.id == id }
}

/** 对应 WebView: db/localDB.js */
suspend fun saveBookTree(context: Context, bookId: String, tree: List<PageNode>) {
    if (bookId.isBlank()) return
    nsSet(context, "tree:$bookId", tree)
}

/** 对应 WebView: db/localDB.js */
suspend fun getBookTree(context: Context, bookId: String): List<PageNode>? {
    return nsGet(context, "tree:$bookId")
}

/** 对应 WebView: db/localDB.js */
suspend fun deleteBook(context: Context, bookId: String) {
    val pages = nsGet<List<PageRecord>>(context, "pages:$bookId") ?: emptyList()
    for (page in pages) {
        val anns = nsGet<List<AnnotationRecord>>(context, "anns:${page.id}") ?: emptyList()
        val annEntries = anns.map { NsEntry(key = "ann:${it.id}", value = null) }
        if (annEntries.isNotEmpty()) nsSetMany(context, annEntries)
        nsDelete(context, "anns:${page.id}")
        nsDelete(context, "page_bk:${page.id}")
    }
    nsDelete(context, "pages:$bookId")
    nsDelete(context, "tree:$bookId")
    nsDeleteByPrefix(context, "expl:")

    val all = nsGet<List<BookRecord>>(context, "books") ?: emptyList()
    nsSet(context, "books", all.filterNot { it.id == bookId })
}

/** 对应 WebView: db/localDB.js */
suspend fun savePage(context: Context, page: PageRecord) {
    if (page.id.isBlank() || page.bookId.isBlank()) return
    val pages = nsGet<List<PageRecord>>(context, "pages:${page.bookId}")?.toMutableList() ?: mutableListOf()
    val idx = pages.indexOfFirst { it.id == page.id }
    val entry = page.copy(savedAt = System.currentTimeMillis())
    if (idx >= 0) pages[idx] = entry else pages += entry
    nsSetMany(
        context,
        listOf(
            NsEntry("pages:${page.bookId}", pages),
            NsEntry("page_bk:${page.id}", page.bookId),
        ),
    )
}

/** 对应 WebView: db/localDB.js */
suspend fun saveBookPages(context: Context, bookId: String, flatPages: List<FlatPageNode>) {
    if (bookId.isBlank()) return
    val now = System.currentTimeMillis()
    val pages = flatPages.mapIndexed { i, p ->
        PageRecord(
            id = p.id,
            bookId = bookId,
            imageUrl = p.imageUrl,
            prompt = p.prompt,
            title = p.title,
            order = i,
            savedAt = now,
        )
    }
    val entries = buildList {
        add(NsEntry("pages:$bookId", pages))
        pages.forEach { add(NsEntry("page_bk:${it.id}", bookId)) }
    }
    nsSetMany(context, entries)

    val all = nsGet<List<BookRecord>>(context, "books")?.toMutableList() ?: mutableListOf()
    val idx = all.indexOfFirst { it.id == bookId }
    if (idx >= 0) {
        val old = all[idx]
        all[idx] = old.copy(
            pageCount = pages.size,
            coverUrl = old.coverUrl ?: pages.firstOrNull()?.imageUrl,
            savedAt = now,
        )
        nsSet(context, "books", all)
    }
}

/** 对应 WebView: db/localDB.js */
suspend fun getPagesByBook(context: Context, bookId: String): List<PageRecord> {
    val pages = nsGet<List<PageRecord>>(context, "pages:$bookId") ?: emptyList()
    return pages.sortedBy { it.order ?: 0 }
}

/** 对应 WebView: db/localDB.js */
suspend fun getPage(context: Context, id: String): PageRecord? {
    val bookId = nsGet<String>(context, "page_bk:$id") ?: return null
    val pages = nsGet<List<PageRecord>>(context, "pages:$bookId") ?: emptyList()
    return pages.firstOrNull { it.id == id }
}

/** 对应 WebView: db/localDB.js */
suspend fun saveAnnotation(context: Context, ann: AnnotationRecord) {
    if (ann.id.isBlank() || ann.pageId.isBlank()) return
    val entry = ann.copy(savedAt = System.currentTimeMillis())
    val anns = nsGet<List<AnnotationRecord>>(context, "anns:${ann.pageId}")?.toMutableList() ?: mutableListOf()
    val idx = anns.indexOfFirst { it.id == ann.id }
    if (idx >= 0) anns[idx] = entry else anns += entry
    nsSetMany(
        context,
        listOf(
            NsEntry("anns:${ann.pageId}", anns),
            NsEntry("ann:${ann.id}", entry),
        ),
    )
}

/** 对应 WebView: db/localDB.js */
suspend fun saveAnnotations(context: Context, annotations: List<AnnotationRecord>) {
    if (annotations.isEmpty()) return
    val byPage = annotations.groupBy { it.pageId }
    val entries = mutableListOf<NsEntry>()
    byPage.forEach { (pageId, group) ->
        val existing = nsGet<List<AnnotationRecord>>(context, "anns:$pageId")?.toMutableList() ?: mutableListOf()
        group.forEach { ann ->
            val stamped = ann.copy(savedAt = System.currentTimeMillis())
            val idx = existing.indexOfFirst { it.id == stamped.id }
            if (idx >= 0) existing[idx] = stamped else existing += stamped
            entries += NsEntry("ann:${stamped.id}", stamped)
        }
        entries += NsEntry("anns:$pageId", existing)
    }
    nsSetMany(context, entries)
}

/** 对应 WebView: db/localDB.js */
suspend fun getAnnotationsByPage(context: Context, pageId: String): List<AnnotationRecord> {
    return nsGet(context, "anns:$pageId") ?: emptyList()
}

/** 对应 WebView: db/localDB.js */
suspend fun updateAnnotation(context: Context, id: String, patch: Map<String, Any?>) {
    val existing = nsGet<AnnotationRecord>(context, "ann:$id") ?: return
    val updated = existing.copy(
        explanation = patch["explanation"] as? String ?: existing.explanation,
        exploredPageId = patch["exploredPageId"] as? String ?: existing.exploredPageId,
        savedAt = System.currentTimeMillis(),
    )
    val anns = nsGet<List<AnnotationRecord>>(context, "anns:${existing.pageId}")?.toMutableList() ?: mutableListOf()
    val idx = anns.indexOfFirst { it.id == id }
    if (idx >= 0) anns[idx] = updated
    nsSetMany(
        context,
        listOf(
            NsEntry("ann:$id", updated),
            NsEntry("anns:${existing.pageId}", anns),
        ),
    )
}

/** 对应 WebView: db/localDB.js */
suspend fun deleteAnnotation(context: Context, id: String) {
    val ann = nsGet<AnnotationRecord>(context, "ann:$id") ?: return
    val anns = (nsGet<List<AnnotationRecord>>(context, "anns:${ann.pageId}") ?: emptyList())
        .filterNot { it.id == id }
    nsDelete(context, "ann:$id")
    nsSet(context, "anns:${ann.pageId}", anns)
}

/** 对应 WebView: db/localDB.js */
suspend fun saveExplanation(context: Context, pageId: String, lang: String = "zh", text: String) {
    if (pageId.isBlank() || text.isBlank()) return
    nsSet(context, "expl:$pageId:$lang", text)
}

/** 对应 WebView: db/localDB.js */
suspend fun getExplanation(context: Context, pageId: String, lang: String = "zh"): String? {
    return nsGet(context, "expl:$pageId:$lang")
}

private fun parseDateEpoch(raw: String?): Long {
    if (raw.isNullOrBlank()) return 0L
    return runCatching { Instant.parse(raw).toEpochMilli() }.getOrElse { 0L }
}

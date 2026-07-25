package com.flipbook.ai.flipbook.migrated.hooks

import android.content.Context
import coil.ImageLoader
import com.flipbook.ai.flipbook.migrated.api.aiApi
import com.flipbook.ai.flipbook.migrated.api.annotationsApi
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.api.PageNode
import com.flipbook.ai.flipbook.migrated.api.preloadImg
import com.flipbook.ai.flipbook.migrated.db.BookRecord
import com.flipbook.ai.flipbook.migrated.db.PageRecord
import com.flipbook.ai.flipbook.migrated.db.saveBook
import com.flipbook.ai.flipbook.migrated.db.savePage
import com.flipbook.ai.flipbook.migrated.db.updateAnnotation
import com.flipbook.ai.flipbook.migrated.utils.FlatPageNode
import com.flipbook.ai.flipbook.migrated.utils.cacheFromNetwork
import com.google.gson.JsonObject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Instant

internal class FlipbookTaskRunner(
    private val context: Context,
    private val scope: CoroutineScope,
    private val imageLoader: ImageLoader,
    private val onFlatPageAppended: (bookId: String, entry: FlatPageNode) -> Unit,
) {
    suspend fun run(task: ExploreTask): Map<String, Any?> {
        return if (task.type == "topic") runTopicTask(task) else runExpandTask(task)
    }

    private suspend fun runTopicTask(task: ExploreTask): Map<String, Any?> {
        val query = task.payload["query"].asStr().orEmpty().trim()
        if (query.isBlank()) error("话题为空")

        val bookId = task.payload["bookId"].asStr()
        val parentPageId = task.payload["parentPageId"].asStr()
        val isNewSearch = task.payload["isNewSearch"].asBool(default = true)

        val body = mutableMapOf<String, Any?>(
            "query" to query,
            "theme" to "dark",
            "mode" to "book",
            "parentPageId" to parentPageId,
        )
        if (!isNewSearch && !bookId.isNullOrBlank()) {
            body["bookId"] = bookId
        }

        val json = aiApi.generateImage(context, body)
        val url = json.str("imageUrl") ?: error("生成结果缺少 imageUrl")
        val pageId = json.str("pageId") ?: error("生成结果缺少 pageId")
        val newBookId = json.str("bookId") ?: bookId ?: error("生成结果缺少 bookId")
        val pageTitle = json.str("pageTitle") ?: query

        if (isNewSearch) {
            saveBook(
                context,
                BookRecord(
                    id = newBookId,
                    title = query,
                    updatedAt = Instant.now().toString(),
                    coverUrl = url,
                ),
            )
        }

        savePage(
            context,
            PageRecord(
                id = pageId,
                bookId = newBookId,
                imageUrl = url,
                prompt = query,
                title = pageTitle,
                order = System.currentTimeMillis().toInt(),
            ),
        )

        withTimeoutOrNull(12_000) {
            preloadImg(context, imageLoader, url)
        }
        scope.launch { cacheFromNetwork(context, url) }

        onFlatPageAppended(
            newBookId,
            FlatPageNode(
                id = pageId,
                imageUrl = url,
                prompt = query,
                title = pageTitle,
            ),
        )

        return mapOf(
            "imageUrl" to url,
            "pageId" to pageId,
            "pageTitle" to pageTitle,
            "bookId" to newBookId,
        )
    }

    private suspend fun runExpandTask(task: ExploreTask): Map<String, Any?> {
        val payload = task.payload
        var imageBase64 = payload["imageBase64"].asStr()
        val box = payload["box"].asMap().orEmpty()
        val vpSize = payload["vpSize"].asMap().orEmpty()
        val annotation = payload["annotation"].asMap()
        val identification = payload["identification"].asMap().orEmpty()

        val bookId = payload["bookId"].asStr() ?: error("缺少 bookId")
        val curParentPageId = payload["curParentPageId"].asStr()
        val curImageUrl = payload["curImageUrl"].asStr()

        val annX = annotation?.get("x").asFloat()
        val annY = annotation?.get("y").asFloat()
        val annW = annotation?.get("w").asFloat()
        val annH = annotation?.get("h").asFloat()
        if (imageBase64.isNullOrBlank() && curImageUrl != null && annX != null && annY != null && annW != null && annH != null) {
            val cropped = aiApi.cropRegion(
                context,
                mapOf(
                    "imageUrl" to curImageUrl,
                    "region" to mapOf(
                        "x1" to annX,
                        "y1" to annY,
                        "x2" to (annX + annW),
                        "y2" to (annY + annH),
                    ),
                ),
            )
            imageBase64 = cropped.str("imageBase64")
        }

        if (imageBase64.isNullOrBlank()) {
            error("未获得裁剪图，请重新框选")
        }

        val boxX = box["x"].asFloat() ?: 0f
        val boxY = box["y"].asFloat() ?: 0f
        val boxW = box["w"].asFloat() ?: 0f
        val boxH = box["h"].asFloat() ?: 0f
        val vpW = (vpSize["w"].asFloat() ?: 1f).coerceAtLeast(1f)
        val vpH = (vpSize["h"].asFloat() ?: 1f).coerceAtLeast(1f)

        val selectionRegion = mapOf(
            "x" to (boxX / vpW),
            "y" to (boxY / vpH),
            "w" to (boxW / vpW),
            "h" to (boxH / vpH),
        )
        val responseResult = runCatching {
            aiApi.expandRegion(
                context,
                mapOf(
                    "selectionImageBase64" to imageBase64,
                    "identification" to identification,
                    "theme" to "dark",
                    "style" to "illustration",
                    "bookId" to bookId,
                    "parentPageId" to curParentPageId,
                    "selectionRegion" to selectionRegion,
                ),
            )
        }

        val response = responseResult.fold(
            onSuccess = { json ->
                mapOf(
                    "imageUrl" to json.str("imageUrl"),
                    "pageId" to json.str("pageId"),
                    "pageTitle" to json.str("pageTitle"),
                    "bookId" to bookId,
                )
            },
            onFailure = {
                recoverLatestChildPage(bookId, curParentPageId, selectionRegion) ?: throw it
            },
        )

        val url = response["imageUrl"].asStr() ?: error("深入探索结果缺少 imageUrl")
        val pageId = response["pageId"].asStr() ?: error("深入探索结果缺少 pageId")
        val pageTitle = response["pageTitle"].asStr() ?: "深入探索"
        val annotationId = annotation?.get("id").asStr()
        val result = mapOf(
            "imageUrl" to url,
            "pageId" to pageId,
            "pageTitle" to pageTitle,
            "bookId" to bookId,
            "annotationId" to annotationId,
            "exploredPageId" to pageId,
        )

        runCatching {
            savePage(
                context,
                PageRecord(
                    id = pageId,
                    bookId = bookId,
                    imageUrl = url,
                    prompt = identification["description"].asStr().orEmpty(),
                    title = pageTitle,
                    order = System.currentTimeMillis().toInt(),
                ),
            )
        }

        if (!annotationId.isNullOrBlank() && !curParentPageId.isNullOrBlank()) {
            runCatching { updateAnnotation(context, annotationId, mapOf("exploredPageId" to pageId)) }
            runCatching {
                annotationsApi.update(
                    context = context,
                    pageId = curParentPageId,
                    id = annotationId,
                    body = mapOf("exploredPageId" to pageId),
                )
            }
        }

        withTimeoutOrNull(12_000) {
            preloadImg(context, imageLoader, url)
        }
        scope.launch { cacheFromNetwork(context, url) }

        runCatching {
            onFlatPageAppended(
                bookId,
                FlatPageNode(
                    id = pageId,
                    imageUrl = url,
                    prompt = identification["description"].asStr(),
                    title = pageTitle,
                ),
            )
        }

        return result
    }

    private suspend fun recoverLatestChildPage(
        bookId: String,
        parentPageId: String?,
        selectionRegion: Map<String, Any?>,
    ): Map<String, Any?>? {
        if (parentPageId.isNullOrBlank()) return null
        return runCatching {
            val recovered = flattenPageNodes(booksApi.pages(context, bookId).tree)
                .lastOrNull { node ->
                    node.parentPageId == parentPageId && regionMatches(selectionRegion, node.selectionRegion)
                }
                ?: return@runCatching null
            mapOf(
                "imageUrl" to recovered.imageUrl,
                "pageId" to recovered.id,
                "pageTitle" to (recovered.title ?: "深入探索"),
                "bookId" to bookId,
            )
        }.getOrNull()
    }

    private fun regionMatches(expected: Map<String, Any?>, actual: com.flipbook.ai.flipbook.migrated.api.SelectionRegion?): Boolean {
        actual ?: return false
        fun close(a: Float?, b: Float): Boolean = a != null && kotlin.math.abs(a - b) <= 0.0005f
        return close(expected["x"].asFloat(), actual.x) &&
            close(expected["y"].asFloat(), actual.y) &&
            close(expected["w"].asFloat(), actual.w) &&
            close(expected["h"].asFloat(), actual.h)
    }

    private fun flattenPageNodes(nodes: List<PageNode>): List<PageNode> {
        val result = mutableListOf<PageNode>()
        fun walk(items: List<PageNode>) {
            items.forEach { node ->
                result += node
                if (node.children.isNotEmpty()) walk(node.children)
            }
        }
        walk(nodes)
        return result
    }
}

internal fun Any?.asMap(): Map<String, Any?>? {
    if (this !is Map<*, *>) return null
    return this.entries.associate { (k, v) -> k.toString() to v }
}

internal fun Any?.asStr(): String? {
    return when (this) {
        null -> null
        is String -> this
        else -> this.toString()
    }?.takeIf { it.isNotBlank() }
}

internal fun Any?.asFloat(): Float? {
    return when (this) {
        is Number -> this.toFloat()
        is String -> this.toFloatOrNull()
        else -> null
    }
}

internal fun Any?.asBool(default: Boolean = false): Boolean {
    return when (this) {
        is Boolean -> this
        is Number -> this.toInt() != 0
        is String -> this.equals("true", ignoreCase = true) || this == "1"
        else -> default
    }
}

internal fun JsonObject.str(key: String): String? {
    val item = get(key) ?: return null
    if (item.isJsonNull) return null
    return item.asString?.takeIf { it.isNotBlank() }
}

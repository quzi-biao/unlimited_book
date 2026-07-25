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
import com.flipbook.ai.flipbook.migrated.api.SelectionRegion
import com.flipbook.ai.flipbook.migrated.api.annotationsApi
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.db.AnnotationRecord
import com.flipbook.ai.flipbook.migrated.db.getAnnotationsByPage
import com.flipbook.ai.flipbook.migrated.db.saveAnnotation
import com.flipbook.ai.flipbook.migrated.db.saveAnnotations
import com.flipbook.ai.flipbook.migrated.db.updateAnnotation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.abs

/** 对应 WebView: hooks/useAnnotations.js */
class AnnotationsState internal constructor(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    var annotations by mutableStateOf<List<AnnotationRecord>>(emptyList())
        private set
    private var pageId: String? = null
    private var bookId: String? = null

    fun bind(newPageId: String?, newBookId: String?) {
        if (pageId == newPageId && bookId == newBookId) return
        pageId = newPageId
        bookId = newBookId
        annotations = emptyList()
        if (newPageId.isNullOrBlank()) return
        scope.launch { load(newPageId, newBookId) }
    }

    fun addAnnotation(annotation: AnnotationRecord) {
        annotations = annotations + annotation
        scope.launch { saveAnnotation(context, annotation) }
    }

    suspend fun refreshAnnotations(): List<AnnotationRecord> {
        val currentPageId = pageId ?: return annotations
        return runCatching { annotationsApi.list(context, currentPageId) }
            .map { remote ->
                val normalized = normalize(currentPageId, bookId, remote)
                annotations = normalized
                saveAnnotations(context, normalized)
                normalized
            }
            .getOrDefault(annotations)
    }

    suspend fun refreshAnnotation(annotationId: String): AnnotationRecord? {
        val currentPageId = pageId ?: return null
        return refreshAnnotations().firstOrNull { it.id == annotationId && it.pageId == currentPageId }
    }

    fun markExplored(annotationId: String, exploredPageId: String) {
        if (annotationId.isBlank() || exploredPageId.isBlank()) return
        annotations = annotations.map { ann ->
            if (ann.id == annotationId) ann.copy(exploredPageId = exploredPageId) else ann
        }
        scope.launch { updateAnnotation(context, annotationId, mapOf("exploredPageId" to exploredPageId)) }
    }

    private suspend fun load(pageId: String, bookId: String?) {
        runCatching { getAnnotationsByPage(context, pageId) }
            .onSuccess { local ->
                if (local.isNotEmpty()) annotations = normalize(pageId, bookId, local)
                runCatching { annotationsApi.list(context, pageId) }
                    .onSuccess { remote ->
                        val normalized = normalize(pageId, bookId, remote)
                        annotations = normalized
                        saveAnnotations(context, normalized)
                    }
            }
            .onFailure {
                runCatching { annotationsApi.list(context, pageId) }
                    .onSuccess { remote ->
                        val normalized = normalize(pageId, bookId, remote)
                        annotations = normalized
                        saveAnnotations(context, normalized)
                    }
            }
    }

    private suspend fun normalize(
        pageId: String,
        bookId: String?,
        source: List<AnnotationRecord>,
    ): List<AnnotationRecord> {
        val base = source.map { it.copy(pageId = pageId) }
        val linked = attachExploredPages(pageId, bookId, base)
        linked.forEach { ann ->
            val exploredPageId = ann.exploredPageId ?: return@forEach
            val original = base.firstOrNull { it.id == ann.id }
            if (original?.exploredPageId.isNullOrBlank()) {
                scope.launch {
                    updateAnnotation(context, ann.id, mapOf("exploredPageId" to exploredPageId))
                    runCatching {
                        annotationsApi.update(
                            context = context,
                            pageId = pageId,
                            id = ann.id,
                            body = mapOf("exploredPageId" to exploredPageId),
                        )
                    }
                }
            }
        }
        return linked
    }

    private suspend fun attachExploredPages(
        pageId: String,
        bookId: String?,
        source: List<AnnotationRecord>,
    ): List<AnnotationRecord> {
        if (bookId.isNullOrBlank() || source.none { it.exploredPageId.isNullOrBlank() }) return source
        val nodes = runCatching { flattenPageNodes(booksApi.pages(context, bookId).tree) }.getOrNull().orEmpty()
        if (nodes.isEmpty()) return source
        return source.map { ann ->
            if (!ann.exploredPageId.isNullOrBlank()) return@map ann
            val matched = nodes.lastOrNull { node ->
                node.parentPageId == pageId && regionMatches(ann, node.selectionRegion)
            }
            if (matched == null) ann else ann.copy(exploredPageId = matched.id)
        }
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

    private fun regionMatches(annotation: AnnotationRecord, region: SelectionRegion?): Boolean {
        region ?: return false
        fun close(a: Float, b: Float): Boolean = abs(a - b) <= 0.0005f
        return close(annotation.x, region.x) &&
            close(annotation.y, region.y) &&
            close(annotation.w, region.w) &&
            close(annotation.h, region.h)
    }
}

@Composable
fun rememberAnnotationsState(pageId: String?, bookId: String?): AnnotationsState {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    val state = remember(context, scope) { AnnotationsState(context, scope) }
    LaunchedEffect(pageId, bookId) { state.bind(pageId, bookId) }
    return state
}

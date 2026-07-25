package com.flipbook.ai.flipbook.migrated.components.shelfpanel

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.PageNode
import com.flipbook.ai.flipbook.migrated.api.pagesApi
import com.flipbook.ai.flipbook.migrated.components.cachedimg.CachedImg
import com.flipbook.ai.flipbook.migrated.hooks.rememberBookPagesState
import com.google.gson.JsonParser

data class BookGraphSelection(
    val imageUrl: String?,
    val pageId: String,
    val bookId: String,
    val title: String,
)

/** 对应 WebView: components/ShelfPanel/BookGraph.jsx */
@Composable
fun BookGraph(
    bookId: String,
    activePageId: String?,
    onSelectPage: (BookGraphSelection) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current.applicationContext
    val pages = rememberBookPagesState(bookId = bookId)
    val expanded = remember { mutableStateMapOf<String, Boolean>() }
    val titleOverrides = remember { mutableStateMapOf<String, String>() }
    val hScroll = rememberScrollState()
    val vScroll = rememberScrollState()

    if (pages.loading) {
        GraphState(text = "加载中...")
        return
    }
    if (pages.error.isNotBlank()) {
        GraphState(text = pages.error, color = Color(0xFFEF4444))
        return
    }
    if (pages.tree.isEmpty()) {
        GraphState(text = "暂无页面")
        return
    }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize(),
    ) {
        val treeWidth = (maxWidth - 20.dp).coerceAtLeast(320.dp)

        Column(
            modifier = Modifier
                .horizontalScroll(hScroll)
                .verticalScroll(vScroll)
                .padding(start = 12.dp, top = 12.dp, end = 8.dp, bottom = 12.dp)
                .width(treeWidth),
        ) {
            pages.tree.forEach { node ->
                GraphNodeItem(
                    node = node,
                    depth = 0,
                    bookId = bookId,
                    context = context,
                    activePageId = activePageId,
                    expanded = expanded,
                    titleOverrides = titleOverrides,
                    onSelectPage = onSelectPage,
                )
            }
        }
    }
}

@Composable
private fun GraphNodeItem(
    node: PageNode,
    depth: Int,
    bookId: String,
    context: Context,
    activePageId: String?,
    expanded: MutableMap<String, Boolean>,
    titleOverrides: MutableMap<String, String>,
    onSelectPage: (BookGraphSelection) -> Unit,
) {
    val isActive = node.id == activePageId
    val hasChildren = node.children.isNotEmpty()
    val isExpanded = expanded[node.id] ?: true
    val nodeTitle = titleOverrides[node.id] ?: displayTitle(node)
    val depthIndent = depthIndent(depth)
    val rowBg = when {
        isActive -> BookGraphStyle.NodeActiveBg
        else -> BookGraphStyle.NodeBg
    }
    val rowBorder = when {
        isActive -> BookGraphStyle.NodeActiveBorder
        else -> BookGraphStyle.NodeBorder
    }

    LaunchedEffect(node.id) {
        if (!needsTitle(node) || titleOverrides.containsKey(node.id)) return@LaunchedEffect
        runCatching { pagesApi.refreshTitle(context, node.id) }
            .getOrNull()
            ?.get("title")
            ?.asString
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?.let { titleOverrides[node.id] = it }
    }

    Column {
        Box(modifier = Modifier.fillMaxWidth()) {
            if (depth > 0) {
                Box(
                    modifier = Modifier
                        .padding(start = depthIndent - 12.dp)
                        .height(24.dp)
                        .width(1.dp)
                        .background(BookGraphStyle.Line),
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 42.dp)
                    .padding(start = depthIndent, bottom = 2.dp)
                    .background(rowBg, RoundedCornerShape(8.dp))
                    .border(1.dp, rowBorder, RoundedCornerShape(8.dp))
                    .clickable {
                        onSelectPage(
                            BookGraphSelection(
                                imageUrl = node.imageUrl,
                                pageId = node.id,
                                bookId = bookId,
                                title = nodeTitle,
                            ),
                        )
                    }
                    .padding(horizontal = 8.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .height(28.dp)
                        .background(BookGraphStyle.ThumbBg, RoundedCornerShape(5.dp))
                        .border(1.dp, BookGraphStyle.ThumbBorder, RoundedCornerShape(5.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (node.imageUrl.isNullOrBlank()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(BookGraphStyle.ThumbEmptyBg, RoundedCornerShape(5.dp))
                                .border(
                                    width = 1.dp,
                                    color = BookGraphStyle.ThumbEmptyBorder,
                                    shape = RoundedCornerShape(5.dp),
                                ),
                        )
                    } else {
                        CachedImg(
                            src = node.imageUrl,
                            alt = "page",
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 8.dp, end = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(1.dp),
                ) {
                    Text(
                        text = nodeTitle,
                        color = if (isActive) BookGraphStyle.LabelActive else BookGraphStyle.Label,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (hasChildren) {
                        Text("${node.children.size} 个子页", color = BookGraphStyle.Sub, fontSize = 10.5.sp)
                    }
                }
                if (hasChildren) {
                    Box(
                        modifier = Modifier
                            .size(22.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .clickable { expanded[node.id] = !isExpanded },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = if (isExpanded) Icons.Rounded.KeyboardArrowDown else Icons.Rounded.KeyboardArrowRight,
                            contentDescription = null,
                            tint = BookGraphStyle.Sub,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                } else {
                    Spacer(Modifier.size(22.dp))
                }
            }
        }

        if (hasChildren && isExpanded) {
            Row(
                modifier = Modifier
                    .padding(start = 20.dp)
                    .height(IntrinsicSize.Min),
            ) {
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .fillMaxHeight()
                        .background(BookGraphStyle.ChildrenLine),
                )
                Column(modifier = Modifier.padding(start = 4.dp)) {
                    node.children.forEach { child ->
                        GraphNodeItem(
                            node = child,
                            depth = depth + 1,
                            bookId = bookId,
                            context = context,
                            activePageId = activePageId,
                            expanded = expanded,
                            titleOverrides = titleOverrides,
                            onSelectPage = onSelectPage,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GraphState(text: String, color: Color = BookGraphStyle.StateText) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text, color = color, fontSize = 12.sp)
    }
}

private fun depthIndent(depth: Int): Dp {
    return (depth * 24).dp
}

private fun displayTitle(node: PageNode): String {
    listOf(node.title, node.pageTitle, node.name)
        .asSequence()
        .mapNotNull { it?.trim() }
        .firstOrNull { it.isNotBlank() && it != "深入探索" }
        ?.let { return ellipsis40(it) }

    val prompt = node.prompt?.trim().orEmpty()
    if (prompt.isBlank()) return "（生成中…）"
    val parsed = runCatching {
        val obj = JsonParser.parseString(prompt).asJsonObject
        obj.get("description")?.asString?.takeIf { it.isNotBlank() }
            ?: obj.get("type")?.asString?.takeIf { it.isNotBlank() }
    }.getOrNull()
    return ellipsis40(parsed ?: prompt)
}

private fun needsTitle(node: PageNode): Boolean {
    return node.title.isNullOrBlank() || node.title == "深入探索"
}

private fun ellipsis40(text: String): String {
    return if (text.length > 40) "${text.take(40)}…" else text
}

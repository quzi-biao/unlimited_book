package com.flipbook.ai.flipbook.migrated.components.shelfpanel

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.PageNode
import com.flipbook.ai.flipbook.migrated.api.pagesApi
import com.flipbook.ai.flipbook.migrated.components.cachedimg.CachedImg
import com.flipbook.ai.flipbook.migrated.hooks.rememberBookPagesState
import com.flipbook.ai.flipbook.migrated.utils.flattenVisibleTree
import com.flipbook.ai.flipbook.migrated.utils.findTreePath
import com.google.gson.JsonParser
import kotlinx.coroutines.flow.first

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
    val pages = key(bookId) { rememberBookPagesState(bookId = bookId) }
    val expanded = remember(bookId) { mutableStateMapOf<String, Boolean>() }
    val titleOverrides = remember(bookId) { mutableStateMapOf<String, String>() }
    val hScroll = key(bookId) { rememberScrollState() }
    val listState = key(bookId) { rememberLazyListState() }
    var positionedCurrentPage by remember(bookId, activePageId) { mutableStateOf(false) }
    val activePath = remember(pages.tree, activePageId) {
        if (activePageId == null) emptyList() else findTreePath(
            roots = pages.tree,
            childrenOf = { it.children },
            matches = { it.id == activePageId },
        )
    }
    val rows by remember(bookId, pages) {
        derivedStateOf {
            flattenVisibleTree(
                roots = pages.tree,
                childrenOf = { it.children },
                isExpanded = { expanded[it.id] ?: true },
            )
        }
    }

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
        val rowWidth = (maxWidth - 20.dp).coerceAtLeast(320.dp)
        val treeWidth = rowWidth + 20.dp + depthIndent(rows.maxOfOrNull { it.depth } ?: 0)
        val density = LocalDensity.current

        LaunchedEffect(activePageId, activePath) {
            if (positionedCurrentPage || activePath.isEmpty()) return@LaunchedEffect
            // 打开目录或切换当前页时展开其祖先；后续手动浏览、折叠不会被拉回。
            activePath.dropLast(1).forEach { expanded[it.id] = true }
            snapshotFlow { listState.layoutInfo.totalItemsCount }
                .first { it > 0 && it == rows.size }
            val index = rows.indexOfFirst { it.node.id == activePageId }
            if (index < 0) return@LaunchedEffect
            listState.scrollToItem(index)
            // 深层目录还需要横向定位，否则当前页虽然在列表内，标题仍可能在屏幕外。
            snapshotFlow { hScroll.maxValue }.first { it != Int.MAX_VALUE }
            hScroll.scrollTo(with(density) { depthIndent(rows[index].depth).roundToPx() })
            positionedCurrentPage = true
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .horizontalScroll(hScroll),
        ) {
            // 每一页是独立的列表行，屏幕外项目无需参与整棵树的布局。
            LazyColumn(
                modifier = Modifier.width(treeWidth).fillMaxHeight(),
                state = listState,
                contentPadding = PaddingValues(start = 12.dp, top = 12.dp, end = 8.dp, bottom = 12.dp),
            ) {
                items(rows, key = { it.node.id }) { row ->
                    GraphNodeItem(
                        node = row.node,
                        depth = row.depth,
                        rowWidth = rowWidth,
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

/** 绘制独立目录行，连接线不参与尺寸测量。 */
@Composable
private fun GraphNodeItem(
    node: PageNode,
    depth: Int,
    rowWidth: Dp,
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

    // 连接线按当前行尺寸绘制，不查询子树的固有宽高。
    Box(modifier = Modifier.fillMaxWidth().drawBehind {
        val step = 24.dp.toPx()
        val stroke = 1.dp.toPx()
        repeat(depth) { level ->
            val x = level * step + step / 2
            drawLine(BookGraphStyle.ChildrenLine, Offset(x, 0f), Offset(x, size.height), stroke)
        }
        if (depth > 0) {
            val y = size.height / 2
            drawLine(BookGraphStyle.Line, Offset(depth * step - step / 2, y), Offset(depth * step, y), stroke)
        }
    }) {
        Row(
            modifier = Modifier
                .padding(start = depthIndent)
                .width(rowWidth)
                .heightIn(min = 42.dp)
                .padding(bottom = 2.dp)
                .background(rowBg, RoundedCornerShape(8.dp))
                .border(1.dp, rowBorder, RoundedCornerShape(8.dp))
                .semantics { selected = isActive }
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
                        contentDescription = if (isExpanded) "收起子页" else "展开子页",
                        tint = BookGraphStyle.Sub,
                        modifier = Modifier.size(14.dp),
                    )
                }
            } else {
                Spacer(Modifier.size(22.dp))
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

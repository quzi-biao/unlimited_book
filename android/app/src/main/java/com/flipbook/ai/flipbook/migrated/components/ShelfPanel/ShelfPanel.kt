package com.flipbook.ai.flipbook.migrated.components.shelfpanel

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.MonetizationOn
import androidx.compose.material.icons.rounded.FormatListBulleted
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.topicsApi
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController
import com.flipbook.ai.flipbook.migrated.hooks.UseBooksState
import com.google.gson.JsonObject
import kotlinx.coroutines.launch

data class ShelfBookSelection(
    val id: String,
    val title: String,
    val coverUrl: String?,
)

data class ShelfTopic(
    val id: String,
    val name: String,
)

internal data class TopicCategory(
    val id: String,
    val name: String,
    val topics: List<ShelfTopic>,
)

/** 对应 WebView: components/ShelfPanel/ShelfPanel.jsx */
@Composable
fun ShelfPanel(
    open: Boolean,
    onClose: () -> Unit,
    books: UseBooksState,
    backdropClosable: Boolean = true,
    /** 是否初始自动展开话题区（书单为空时由外层传 true） */
    initialTopicsOpen: Boolean = false,
    activePageId: String?,
    activeBookId: String?,
    selectedBookId: String?,
    onSelectBook: (ShelfBookSelection?) -> Unit,
    onSelectPage: (BookGraphSelection) -> Unit,
    onSelectTopic: (ShelfTopic) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenWallet: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!open) return
    var topicsOpen by remember { mutableStateOf(false) }
    var categories by remember { mutableStateOf<List<TopicCategory>>(emptyList()) }
    var loadingCats by remember { mutableStateOf(false) }
    var activeCategoryId by remember { mutableStateOf<String?>(null) }
    // 全局引导控制器（由 AppScreen 通过 CompositionLocal 提供）
    val guideController = LocalGuideController.current
    // 是否需要在话题加载完后触发引导（仅触发一次）
    var guidePending by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current.applicationContext

    // 定义在 LaunchedEffect 之前，确保可以从 LaunchedEffect 中调用
    fun loadCategories() {
        if (categories.isNotEmpty() || loadingCats) return
        scope.launch {
            loadingCats = true
            runCatching { topicsApi.getCategories(context) }
                .onSuccess { json -> categories = parseTopicCategories(json) }
            activeCategoryId = categories.firstOrNull()?.id
            loadingCats = false
        }
    }

    LaunchedEffect(open) {
        if (open) {
            books.refresh()
            topicsOpen = false
        }
    }

    // 空书单且初始指定自动展开话题，同时触发分类加载
    LaunchedEffect(books.loading, books.books.size) {
        if (!books.loading && books.books.isEmpty() && initialTopicsOpen && !topicsOpen) {
            topicsOpen = true
            guidePending = true
            loadCategories() // ← 修复：自动展开时也要加载话题分类
        }
    }

    val compact = com.flipbook.ai.flipbook.migrated.components.common.LocalCompactLayout.current
    val topicsContent: @Composable () -> Unit = {
        ShelfTopics(categories, activeCategoryId, loadingCats, guidePending,
            onCategorySelected = { activeCategoryId = it },
            onSelectTopic = {
                guideController?.advanceTo("explore_btn")
                guidePending = false
                onSelectTopic(it)
                onClose()
            },
        )
    }

    // 遮罩 + 面板，对应 JSX backdrop + panel
    Box(modifier = modifier.fillMaxSize()) {
        // 遮罩：透明背景，点击关闭
        Box(
            modifier = if (backdropClosable) {
                Modifier
                    .fillMaxSize()
                    .clickable(onClick = onClose)
            } else {
                Modifier.fillMaxSize()
            },
        )

        // 主面板：对应 JSX .panel / .panelExpanded
        // 背景 rgba(14,16,26,0.96)，圆角 18dp，indigo 渐变描边，外阴影
        Row(
            modifier = Modifier
                .padding(start = 14.dp, end = if (compact) 14.dp else 0.dp, bottom = if (compact) 136.dp else 88.dp)
                .fillMaxHeight(0.84f)
                .align(Alignment.BottomStart)
                .then(if (compact) Modifier.fillMaxWidth() else Modifier.width(if (topicsOpen) 680.dp else 340.dp))
                .background(Color(0xF50E101A), RoundedCornerShape(18.dp))
                .border(1.dp, Color(0x996366F1), RoundedCornerShape(18.dp))
                .clip(RoundedCornerShape(18.dp)),
        ) {
            // ── 左侧：书本列表 (.leftPane) ──
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
            ) {
                // ── Header (.header)：背景带 indigo 渐变 ──
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0x146366F1)),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        // 话题分类按钮（.newBtn / .newBtnActive）：带 ListTree 图标
                        Row(
                            modifier = Modifier
                                .background(
                                    if (topicsOpen) Color(0x406366F1) else Color(0x1A6366F1),
                                    RoundedCornerShape(10.dp),
                                )
                                .border(
                                    1.dp,
                                    if (topicsOpen) Color(0xCC6366F1) else Color(0x596366F1),
                                    RoundedCornerShape(10.dp),
                                )
                                .clickable {
                                    val nextOpen = !topicsOpen
                                    topicsOpen = nextOpen
                                    if (nextOpen) {
                                        onSelectBook(null)
                                        loadCategories()
                                    }
                                }
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(
                                Icons.Rounded.FormatListBulleted,
                                contentDescription = null,
                                tint = if (topicsOpen) Color.White else Color(0xFFA5B4FC),
                                modifier = Modifier.size(15.dp),
                            )
                            Text(
                                "话题分类",
                                color = if (topicsOpen) Color.White else Color(0xFFA5B4FC),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }

                        // 右侧工具图标区 (.userArea)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            // wallet 按键注册引导坐标
                            Box(
                                modifier = Modifier.onGloballyPositioned { coords ->
                                    guideController?.registerTarget("wallet_btn", coords.boundsInRoot())
                                },
                            ) {
                                IconBtn(onClick = onOpenWallet) {
                                    Icon(Icons.Rounded.MonetizationOn, contentDescription = "充学习点数", tint = Color(0xFF9CA3AF), modifier = Modifier.size(16.dp))
                                }
                            }
                            // settings 按键注册引导坐标
                            Box(
                                modifier = Modifier.onGloballyPositioned { coords ->
                                    guideController?.registerTarget("settings_btn", coords.boundsInRoot())
                                },
                            ) {
                                IconBtn(onClick = onOpenSettings) {
                                    Icon(Icons.Rounded.Settings, contentDescription = "音色设置", tint = Color(0xFF9CA3AF), modifier = Modifier.size(16.dp))
                                }
                            }
                            IconBtn(onClick = onClose) {
                                Icon(Icons.Rounded.Close, contentDescription = "关闭", tint = Color(0xFF9CA3AF), modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                    // Header 底部分割线，对应 CSS border-bottom: 1px solid rgba(255,255,255,0.07)
                    Divider(color = Color(0x12FFFFFF), thickness = 1.dp)
                }

                if (compact && topicsOpen) {
                    Box(Modifier.weight(1f)) { topicsContent() }
                } else ShelfBookList(
                    books = books.books,
                    loading = books.loading,
                    activeBookId = activeBookId,
                    selectedBookId = selectedBookId,
                    onSelectBook = { book ->
                        topicsOpen = false
                        onSelectBook(
                            ShelfBookSelection(
                                id = book.id,
                                title = book.title.orEmpty(),
                                coverUrl = book.coverUrl,
                            ),
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
            }

            // 左右分割线，对应 CSS .leftPane border-right
            if (topicsOpen && !compact) {
                Divider(
                    modifier = Modifier
                        .fillMaxHeight()
                        .width(1.dp),
                    color = Color(0x12FFFFFF),
                )
            }

            // ── 右侧：话题分类 (.rightPane) ──
            if (topicsOpen && !compact) {
                Box(Modifier.weight(1f).fillMaxHeight()) { topicsContent() }
            }
        }
    }
}

/**
 * 圆角方形图标按钮，对应 JSX .iconBtn：36x36，border rgba(255,255,255,0.1)，圆角9
 */
@Composable
private fun IconBtn(onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(9.dp))
            .clip(RoundedCornerShape(9.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}

private fun parseTopicCategories(json: JsonObject): List<TopicCategory> {
    val arr = json.getAsJsonArray("categories") ?: return emptyList()
    return arr.mapNotNull { el ->
        val obj = el.asJsonObject
        val id = obj.get("id")?.asString ?: return@mapNotNull null
        val name = obj.get("name")?.asString ?: "未命名分类"
        val topics = obj.getAsJsonArray("topics")?.mapNotNull { t ->
            val to = t.asJsonObject
            val tid = to.get("id")?.asString ?: return@mapNotNull null
            val tname = to.get("name")?.asString ?: return@mapNotNull null
            ShelfTopic(id = tid, name = tname)
        } ?: emptyList()
        TopicCategory(id = id, name = name, topics = topics)
    }
}

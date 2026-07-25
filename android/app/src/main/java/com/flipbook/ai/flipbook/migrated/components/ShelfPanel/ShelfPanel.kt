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
import androidx.compose.material.icons.rounded.BookmarkBorder
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.MonetizationOn
import androidx.compose.material.icons.rounded.FormatListBulleted
import androidx.compose.material.icons.rounded.MenuBook
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
import com.flipbook.ai.flipbook.migrated.components.cachedimg.CachedImg
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController
import com.flipbook.ai.flipbook.migrated.db.BookRecord
import com.flipbook.ai.flipbook.migrated.hooks.rememberUseBooksState
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

private data class TopicCategory(
    val id: String,
    val name: String,
    val topics: List<ShelfTopic>,
)

/** 对应 WebView: components/ShelfPanel/ShelfPanel.jsx */
@Composable
fun ShelfPanel(
    open: Boolean,
    onClose: () -> Unit,
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
    val books = rememberUseBooksState()
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
                .padding(start = 14.dp, bottom = 88.dp)
                .fillMaxHeight(0.84f)
                .align(Alignment.BottomStart)
                .width(if (topicsOpen) 680.dp else 340.dp)
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

                // 书本列表 (.listPane)
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .padding(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(0.dp),
                ) {
                    if (!books.loading && books.books.isEmpty()) {
                        item {
                            Text(
                                "点击右侧话题，探索感兴趣的内容",
                                color = Color(0xFF9CA3AF),
                                fontSize = 13.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 20.dp),
                            )
                        }
                    }
                    items(books.books, key = { it.id }) { book ->
                        ShelfBookRow(
                            book = book,
                            selected = selectedBookId == book.id,
                            isActive = activeBookId == book.id,
                            onClick = {
                                topicsOpen = false
                                onSelectBook(
                                    ShelfBookSelection(
                                        id = book.id,
                                        title = book.title.orEmpty(),
                                        coverUrl = book.coverUrl,
                                    ),
                                )
                            },
                        )
                    }
                }
            }

            // 左右分割线，对应 CSS .leftPane border-right
            if (topicsOpen) {
                Divider(
                    modifier = Modifier
                        .fillMaxHeight()
                        .width(1.dp),
                    color = Color(0x12FFFFFF),
                )
            }

            // ── 右侧：话题分类 (.rightPane) ──
            if (topicsOpen) {
                val active = categories.firstOrNull { it.id == activeCategoryId }

                Row(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .background(Color(0x33000000)),
                ) {
                    // 分类列表 (.categoriesCol)
                    LazyColumn(
                        modifier = Modifier
                            .width(120.dp)
                            .fillMaxHeight()
                            .padding(vertical = 8.dp),
                    ) {
                        if (loadingCats) {
                            item {
                                Text(
                                    "加载中…",
                                    color = Color(0xFF9CA3AF),
                                    fontSize = 14.sp,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                                )
                            }
                        }
                        items(categories, key = { it.id }) { c ->
                            val isCatActive = activeCategoryId == c.id
                            // 对应 .categoryItem / .categoryActive：左侧 3dp 竖条 + indigo bg
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        if (isCatActive) Color(0x1A6366F1) else Color.Transparent,
                                    )
                                    .clickable { activeCategoryId = c.id }
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                // 左侧激活竖条，对应 .categoryActive::before
                                if (isCatActive) {
                                    Box(
                                        modifier = Modifier
                                            .width(3.dp)
                                            .height(16.dp)
                                            .background(Color(0xFF6366F1), RoundedCornerShape(0.dp, 4.dp, 4.dp, 0.dp))
                                            .padding(end = 8.dp),
                                    )
                                    Spacer(Modifier.width(8.dp))
                                }
                                Text(
                                    c.name,
                                    color = if (isCatActive) Color(0xFFE5E7EB) else Color(0xFF9CA3AF),
                                    fontSize = 14.sp,
                                    fontWeight = if (isCatActive) FontWeight.Medium else FontWeight.Normal,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }

                    // 分类/话题间的竖线
                    Divider(
                        modifier = Modifier
                            .fillMaxHeight()
                            .width(1.dp),
                        color = Color(0x0DFFFFFF),
                    )

                    // 话题列表 (.topicsCol)，注册到 topic_list key
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .padding(8.dp)
                            .onGloballyPositioned { coords ->
                                guideController?.registerTarget("topic_list", coords.boundsInRoot())
                            },
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        val topics = active?.topics ?: emptyList()

                        if (topics.isEmpty() && !loadingCats) {
                            item {
                                Text(
                                    "暂无话题",
                                    color = Color(0xFF9CA3AF),
                                    fontSize = 14.sp,
                                    modifier = Modifier.padding(top = 20.dp, start = 14.dp),
                                )
                            }
                        }
                        items(topics, key = { it.id }) { topic ->
                            val isFirstTopic = guidePending && topics.indexOf(topic) == 0
                            // 对应 .topicItem：hover 白色透明 bg，带 ChevronRight
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .then(
                                        // 第一个 topic 注册位置，触发引导
                                        if (isFirstTopic) {
                                            Modifier.onGloballyPositioned { coords ->
                                                val bounds = coords.boundsInRoot()
                                                if (bounds.width > 0f) {
                                                    guideController?.registerTarget("first_topic", bounds)
                                                    // 不再自动 show，由 GuideController 步骤驱动
                                                }
                                            }
                                        } else Modifier
                                    )
                                    .clickable {
                                        guideController?.advanceTo("explore_btn") // 话题点击自动推进到探索任务步骤
                                        guidePending = false
                                        onSelectTopic(topic)
                                        onClose()
                                    }
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                // .topicName
                                Text(
                                    topic.name,
                                    color = Color(0xFFE5E7EB),
                                    fontSize = 14.sp,
                                    modifier = Modifier.weight(1f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                // .topicArrow
                                Icon(
                                    Icons.Rounded.ChevronRight,
                                    contentDescription = null,
                                    tint = Color(0x80FFFFFF),
                                    modifier = Modifier.size(14.dp),
                                )
                            }
                        }
                    }
                }
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

/**
 * 单本书条目，对应 JSX .bookItem / .bookSelected / .bookActive
 *
 * JSX 样式：无 border，hover 白色4%背景，selected 时 indigo 12%背景，
 * active 时左侧 2dp 竖条（accent 色），封面 38x38，书名 14sp，页数 13sp
 */
@Composable
private fun ShelfBookRow(
    book: BookRecord,
    selected: Boolean,
    isActive: Boolean,
    onClick: () -> Unit,
) {
    // 对应 .bookSelected: background rgba(99,102,241,0.12)
    val bg = if (selected) Color(0x1F6366F1) else Color.Transparent

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(bg)
            .clickable(onClick = onClick),
    ) {
        // 对应 .bookActive::before：左侧 2dp accent 竖条，固定高度避免 fillMaxHeight 约束问题
        if (isActive) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .width(2.dp)
                    .height(24.dp)
                    .background(Color(0xFF6366F1), RoundedCornerShape(0.dp, 2.dp, 2.dp, 0.dp)),
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // 封面缩略图 (.bookCover)：38x38，圆角6，bg rgba(255,255,255,0.06)
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .background(Color(0x0FFFFFFF), RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (book.coverUrl.isNullOrBlank()) {
                    // 无封面：显示 BookOpen 图标，对应 JSX <BookOpen size={14} strokeWidth={1.5} />
                    Icon(
                        Icons.Rounded.MenuBook,
                        contentDescription = null,
                        tint = Color(0xFF9CA3AF),
                        modifier = Modifier.size(14.dp),
                    )
                } else {
                    CachedImg(
                        src = book.coverUrl,
                        alt = book.title.orEmpty(),
                        modifier = Modifier.size(38.dp),
                    )
                }
            }

            // 书名 + 页数 (.bookMeta)
            Column(modifier = Modifier.weight(1f).padding(start = 8.dp)) {
                // .bookTitle：14sp，500 weight，color var(--text)
                Text(
                    book.title.orEmpty().ifBlank { "未命名" },
                    color = Color(0xFFE5E7EB),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                // .bookPages：13sp，color var(--muted)
                Text(
                    "${book.count?.pages ?: book.pageCount ?: 0} 页",
                    color = Color(0xFF9CA3AF),
                    fontSize = 13.sp,
                )
            }
        }
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

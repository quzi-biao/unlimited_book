package com.flipbook.ai.flipbook.migrated.components.shelfpanel

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MenuBook
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.cachedimg.CachedImg
import com.flipbook.ai.flipbook.migrated.db.BookRecord

/** 以当前话题作为初始列表位置，首帧直接布局目标条目，避免先显示顶部再滚动。 */
@Composable
internal fun ShelfBookList(
    books: List<BookRecord>,
    loading: Boolean,
    activeBookId: String?,
    selectedBookId: String?,
    onSelectBook: (BookRecord) -> Unit,
    modifier: Modifier = Modifier,
) {
    // 按页面所属话题 ID 定位，不能用子页标题或正在浏览的目录代替。
    val activeIndex = books.indexOfFirst { it.id == activeBookId }
    // 冷启动数据尚未准备好时不创建零位置列表；常规打开直接复用主界面已加载的数据。
    if (loading && (books.isEmpty() || (activeBookId != null && activeIndex < 0))) {
        Box(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Text("加载中…", color = Color(0xFF9CA3AF), fontSize = 13.sp)
        }
        return
    }

    // 同一话题的数据刷新、目录选择不重建滚动状态；关掉重开时重新按当前话题初始化。
    key(activeBookId, activeIndex >= 0) {
        val listState = rememberLazyListState(initialFirstVisibleItemIndex = activeIndex.coerceAtLeast(0))
        LazyColumn(
            state = listState,
            modifier = modifier.padding(vertical = 8.dp),
        ) {
            if (!loading && books.isEmpty()) {
                item {
                    Text(
                        "点击右侧话题，探索感兴趣的内容",
                        color = Color(0xFF9CA3AF),
                        fontSize = 13.sp,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 20.dp),
                    )
                }
            }
            items(books, key = { it.id }) { book ->
                ShelfBookRow(
                    book = book,
                    selected = selectedBookId == book.id,
                    isActive = activeBookId == book.id,
                    onClick = { onSelectBook(book) },
                )
            }
        }
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
    val bg = if (selected || isActive) Color(0x1F6366F1) else Color.Transparent

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(bg)
            .semantics { this.selected = isActive }
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

package com.flipbook.ai.flipbook.migrated.components.landing

import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Book
import androidx.compose.material.icons.rounded.LibraryBooks
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Wallet
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.api.aiApi
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.components.cachedimg.CachedImg
import com.flipbook.ai.flipbook.migrated.components.otaupdate.OtaBadge
import com.flipbook.ai.flipbook.migrated.components.otaupdate.OtaBadgeState
import com.flipbook.ai.flipbook.migrated.db.BookRecord
import com.flipbook.ai.flipbook.migrated.db.getPagesByBook
import com.flipbook.ai.flipbook.migrated.db.saveBookPages
import com.flipbook.ai.flipbook.migrated.db.saveBookTree
import com.flipbook.ai.flipbook.migrated.hooks.rememberUseBooksState
import com.flipbook.ai.flipbook.migrated.utils.flattenTree
import kotlinx.coroutines.launch

data class LandingOpenPage(
    val imageUrl: String?,
    val pageId: String,
    val bookId: String,
    val title: String?,
    val bookTitle: String?,
)

/** 对应 WebView: components/Landing/Landing.jsx */
@Composable
fun LandingPanel(
    visible: Boolean,
    onBrowse: (String) -> Unit,
    onOpenBook: (LandingOpenPage) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenWallet: () -> Unit,
    otaState: OtaBadgeState? = null,
    onOtaUpdate: () -> Unit = {},
    onOtaRestart: () -> Unit = {},
) {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    val booksState = rememberUseBooksState()
    var topics by remember { mutableStateOf(emptyList<String>()) }
    var topicsLoading by remember { mutableStateOf(false) }

    fun fetchTopics() {
        if (topicsLoading) return
        scope.launch {
            topicsLoading = true
            topics = runCatching {
                aiApi.randomTopics(context).topics
            }.getOrElse {
                listOf("火山爆发", "深海生物", "量子纠缠", "宇宙起源", "基因编辑")
            }
            topicsLoading = false
        }
    }

    LaunchedEffect(visible) {
        if (!visible) return@LaunchedEffect
        booksState.refresh()
        if (topics.isEmpty()) fetchTopics()
    }

    AnimatedVisibility(visible = visible) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(LandingStyle.GradientA, LandingStyle.Bg),
                    ),
                )
                .padding(horizontal = 28.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
                if (otaState?.update != null) {
                    OtaBadge(state = otaState, onUpdate = onOtaUpdate, onRestart = onOtaRestart)
                    Spacer(Modifier.width(8.dp))
                }
                TopIcon(Icons.Rounded.Wallet, onOpenWallet)
                Spacer(Modifier.width(8.dp))
                TopIcon(Icons.Rounded.Settings, onOpenSettings)
            }

            Spacer(Modifier.height(18.dp))
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(LandingStyle.GradientB),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Book,
                    contentDescription = null,
                    tint = LandingStyle.Accent,
                    modifier = Modifier.size(28.dp),
                )
            }

            Spacer(Modifier.height(20.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("探索话题", color = LandingStyle.Muted, style = MaterialTheme.typography.labelSmall)
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(LandingStyle.GradientB)
                        .border(1.dp, LandingStyle.Border, RoundedCornerShape(8.dp))
                        .clickable { fetchTopics() },
                    contentAlignment = Alignment.Center,
                ) {
                    if (topicsLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(12.dp),
                            strokeWidth = 1.8.dp,
                            color = LandingStyle.Accent,
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Rounded.Refresh,
                            contentDescription = null,
                            tint = LandingStyle.Muted,
                            modifier = Modifier.size(13.dp),
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val topicList = if (topicsLoading) listOf("...", "...", "...", "...", "...") else topics
                topicList.forEach { topic ->
                    TopicChip(
                        text = topic,
                        enabled = !topicsLoading,
                        onClick = { onBrowse(topic) },
                    )
                }
            }

            if (booksState.loading || booksState.books.isNotEmpty()) {
                Spacer(Modifier.height(20.dp))
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.LibraryBooks, contentDescription = null, tint = LandingStyle.Muted, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("继续探索", color = LandingStyle.Muted, style = MaterialTheme.typography.labelSmall)
                }
                Spacer(Modifier.height(12.dp))

                if (booksState.loading) {
                    Text("加载中...", color = LandingStyle.Muted, style = MaterialTheme.typography.labelSmall)
                }

                LazyVerticalGrid(
                    columns = GridCells.Adaptive(120.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(310.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(booksState.books, key = { it.id }) { book ->
                        BookCard(
                            context = context,
                            book = book,
                            onOpen = onOpenBook,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BookCard(
    context: Context,
    book: BookRecord,
    onOpen: (LandingOpenPage) -> Unit,
) {
    val scope = rememberCoroutineScope()
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(LandingStyle.GradientB)
            .border(1.dp, LandingStyle.Border, RoundedCornerShape(10.dp))
            .clickable {
                scope.launch {
                    openBookFromCacheOrServer(context = context, book = book, onOpen = onOpen)
                }
            }
            .padding(10.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(LandingStyle.Border),
                contentAlignment = Alignment.Center,
            ) {
                if (book.coverUrl.isNullOrBlank()) {
                    Icon(Icons.Rounded.Book, contentDescription = null, tint = LandingStyle.Muted, modifier = Modifier.size(20.dp))
                } else {
                    CachedImg(
                        src = book.coverUrl,
                        alt = book.title ?: "",
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
            Text(
                text = (book.title ?: "").ifBlank { "未命名" },
                color = LandingStyle.Text,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "${book.count?.pages ?: book.pageCount ?: 0} 页",
                color = LandingStyle.Muted,
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

private suspend fun openBookFromCacheOrServer(
    context: Context,
    book: BookRecord,
    onOpen: (LandingOpenPage) -> Unit,
) {
    val localPages = getPagesByBook(context, book.id)
    if (localPages.isNotEmpty()) {
        val first = localPages.first()
        onOpen(
            LandingOpenPage(
                imageUrl = first.imageUrl,
                pageId = first.id,
                bookId = book.id,
                title = first.title ?: book.title,
                bookTitle = book.title,
            ),
        )
        return
    }

    runCatching {
        val remote = booksApi.pages(context, book.id)
        val first = remote.tree.firstOrNull() ?: return@runCatching
        onOpen(
            LandingOpenPage(
                imageUrl = first.imageUrl,
                pageId = first.id,
                bookId = book.id,
                title = first.title ?: book.title,
                bookTitle = book.title,
            ),
        )
        saveBookTree(context, book.id, remote.tree)
        saveBookPages(context, book.id, flattenTree(remote.tree))
    }
}

@Composable
private fun TopIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(LandingStyle.GradientB)
            .border(1.dp, LandingStyle.Border, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = LandingStyle.Muted, modifier = Modifier.size(17.dp))
    }
}

@Composable
private fun TopicChip(
    text: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .height(38.dp)
            .clip(RoundedCornerShape(50.dp))
            .background(LandingStyle.GradientB)
            .border(1.dp, LandingStyle.Border, RoundedCornerShape(50.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = LandingStyle.Text, style = MaterialTheme.typography.bodySmall)
    }
}

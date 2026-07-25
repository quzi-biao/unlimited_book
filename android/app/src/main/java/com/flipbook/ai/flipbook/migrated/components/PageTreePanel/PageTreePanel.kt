package com.flipbook.ai.flipbook.migrated.components.pagetreepanel

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.shelfpanel.BookGraph
import com.flipbook.ai.flipbook.migrated.components.shelfpanel.BookGraphSelection

data class PageTreeSelection(
    val imageUrl: String?,
    val pageId: String,
    val bookId: String,
    val title: String,
    val bookTitle: String,
)

/** 对应 WebView: components/PageTreePanel/PageTreePanel.jsx */
@Composable
fun PageTreePanel(
    bookId: String?,
    bookTitle: String,
    activePageId: String?,
    shelfOpen: Boolean,
    onSelectPage: (PageTreeSelection) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val realBookId = bookId ?: return
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val maxWidthDp = maxWidth
        val leftPad = if (shelfOpen) 364.dp else 14.dp
        val avail = maxWidthDp - leftPad - 14.dp
        val panelWidth = if (shelfOpen) {
            avail.coerceIn(240.dp, 400.dp)
        } else {
            400.dp.coerceAtMost(maxWidthDp - 28.dp)
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0x03000000))
                .clickable(onClick = onClose),
        )

        Box(
            modifier = Modifier
                .padding(start = if (shelfOpen) 364.dp else 14.dp, bottom = 88.dp)
                .align(Alignment.BottomStart),
        ) {
            Column(
                modifier = Modifier
                    .width(panelWidth)
                    .fillMaxHeight(0.82f)
                    .heightIn(min = 500.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(PageTreePanelStyle.PanelBg)
                    .border(
                        1.dp,
                        brush = Brush.linearGradient(
                            listOf(Color(0xA6A855F7), Color(0x406366F1), Color(0x333B82F6)),
                        ),
                        shape = RoundedCornerShape(18.dp),
                    ),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 2.dp)
                        .background(
                            Brush.horizontalGradient(
                                listOf(
                                    Color.Transparent,
                                    PageTreePanelStyle.TopGlowA,
                                    PageTreePanelStyle.TopGlowB,
                                    PageTreePanelStyle.TopGlowC,
                                    Color.Transparent,
                                ),
                            ),
                        ),
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0x1AA855F7), Color(0x0A6366F1), Color.Transparent),
                            ),
                        )
                        .border(1.dp, PageTreePanelStyle.HeaderBorder, RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        bookTitle.ifBlank { "页面图谱" },
                        color = PageTreePanelStyle.Title,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(7.dp))
                            .background(Color(0x0AFFFFFF), RoundedCornerShape(7.dp))
                            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(7.dp))
                            .clickable(onClick = onClose)
                            .padding(5.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "关闭",
                            tint = PageTreePanelStyle.HeaderIconHover,
                        )
                    }
                }
                Box(modifier = Modifier.fillMaxSize()) {
                    BookGraph(
                        bookId = realBookId,
                        activePageId = activePageId,
                        onSelectPage = { page: BookGraphSelection ->
                            onSelectPage(
                                PageTreeSelection(
                                    imageUrl = page.imageUrl,
                                    pageId = page.pageId,
                                    bookId = page.bookId,
                                    title = page.title,
                                    bookTitle = bookTitle,
                                ),
                            )
                            onClose()
                        },
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }
    }
}

package com.flipbook.ai.flipbook.migrated.components.toolbar

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.LibraryBooks
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController

/** 左上角目录、书名及页名，长标题省略且不影响底部搜索空间。 */
@Composable
fun PhoneReaderNavigation(
    shelfOpen: Boolean, bookTitle: String, pageTitle: String,
    onShelf: () -> Unit, onBook: () -> Unit, onPage: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val guide = LocalGuideController.current
    Box(modifier) {
        Row(
            Modifier.widthIn(max = 420.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(48.dp).phoneHeaderChrome()
                .onGloballyPositioned { guide?.registerTarget("toolbar_shelf_btn", it.boundsInRoot()) }
                .clickable(role = Role.Button, onClick = onShelf), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Rounded.LibraryBooks, contentDescription = "目录",
                    tint = if (shelfOpen) Color(0xFFF0C060) else Color(0xFFE8EAF0), modifier = Modifier.size(20.dp))
            }
            if (bookTitle.isNotBlank()) NavigationTitle(bookTitle, onBook,
                Modifier.weight(1f, fill = false).widthIn(max = 140.dp)
                    .onGloballyPositioned { guide?.registerTarget("toolbar_book_name", it.boundsInRoot()) })
            if (pageTitle.isNotBlank()) NavigationTitle(pageTitle, onPage,
                Modifier.weight(1.15f, fill = false).widthIn(max = 160.dp)
                    .onGloballyPositioned { guide?.registerTarget("toolbar_page_name", it.boundsInRoot()) })
        }
    }
}

/** 书名与页名分别放入独立胶囊，长标题省略但保留完整无障碍语义。 */
@Composable
private fun NavigationTitle(title: String, onClick: () -> Unit, modifier: Modifier) {
    Box(modifier.height(48.dp).phoneHeaderChrome()
        .clickable(role = Role.Button, onClick = onClick).padding(horizontal = 12.dp),
        contentAlignment = Alignment.CenterStart) {
        Text(title, color = Color(0xFFE8EAF0),
            fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

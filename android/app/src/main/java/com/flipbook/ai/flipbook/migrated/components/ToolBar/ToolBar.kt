package com.flipbook.ai.flipbook.migrated.components.toolbar

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.LibraryBooks
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController

/**
 * 对应 WebView: components/ToolBar/ToolBar.jsx
 */
@Composable
fun ToolBar(
    hidden: Boolean,
    shelfOpen: Boolean,
    onShelfOpen: () -> Unit,
    currentBookTitle: String,
    currentPageTitle: String,
    onBookTreeOpen: () -> Unit,
    onPageNameClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val alpha = animateFloatAsState(
        targetValue = if (hidden) 0f else 1f,
        animationSpec = tween(durationMillis = 250),
        label = "toolbar-alpha",
    )
    val translateY = animateFloatAsState(
        targetValue = if (hidden) 14f else 0f,
        animationSpec = tween(durationMillis = 250),
        label = "toolbar-translation",
    )

    val guideController = LocalGuideController.current

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = 20.dp, end = 20.dp, bottom = 20.dp)
            .graphicsLayer {
                this.alpha = alpha.value
                translationY = translateY.value
            },
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircleButton(
                active = shelfOpen,
                onClick = onShelfOpen,
                modifier = Modifier.onGloballyPositioned { coords ->
                    guideController?.registerTarget("toolbar_shelf_btn", coords.boundsInRoot())
                },
            )
            if (currentBookTitle.isNotBlank()) {
                Spacer(Modifier.width(12.dp))
                PillButton(
                    text = currentBookTitle,
                    bgActive = ToolBarStyle.BookPillBg,
                    textColor = ToolBarStyle.BookPillText,
                    onClick = onBookTreeOpen,
                    modifier = Modifier.onGloballyPositioned { coords ->
                        guideController?.registerTarget("toolbar_book_name", coords.boundsInRoot())
                    },
                )
            }
            if (currentPageTitle.isNotBlank()) {
                Spacer(Modifier.width(12.dp))
                PillButton(
                    text = currentPageTitle,
                    bgActive = ToolBarStyle.PagePillBg,
                    textColor = ToolBarStyle.PagePillText,
                    onClick = onPageNameClick,
                    modifier = Modifier.onGloballyPositioned { coords ->
                        guideController?.registerTarget("toolbar_page_name", coords.boundsInRoot())
                    },
                )
            }
        }

        Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun CircleButton(
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (active) ToolBarStyle.CircleButtonActiveBg else ToolBarStyle.CircleButtonBg
    val fg = if (active) ToolBarStyle.CircleButtonActiveText else ToolBarStyle.CircleButtonText
    Box(
        modifier = modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(bg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Rounded.LibraryBooks,
            contentDescription = "主题列表",
            tint = fg,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun PillButton(
    text: String,
    bgActive: androidx.compose.ui.graphics.Color,
    textColor: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(bgActive)
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = 13.5.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

package com.flipbook.ai.flipbook.migrated.components.viewport

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.utils.AnnotationCenterGroup
import com.flipbook.ai.flipbook.migrated.utils.AnnotationItem
import com.flipbook.ai.flipbook.migrated.utils.groupByCenter

/** 对应 WebView: components/Viewport/AnnotationDots.jsx */
@Composable
fun AnnotationDots(
    annotations: List<AnnotationItem>,
    activeId: String?,
    ttsState: String,
    ttsSrcId: String?,
    calloutOpen: Boolean,
    vpW: Float,
    vpH: Float,
    onDotClick: (AnnotationCenterGroup) -> Unit,
    modifier: Modifier = Modifier,
) {
    val groups = groupByCenter(annotations)
    val density = LocalDensity.current
    groups.forEach { group ->
        val isActive = group.items.any { it.id == activeId }
        val isTtsPlaying = ttsState == "playing" && group.items.any { it.id == ttsSrcId } && !calloutOpen
        val isTtsPaused = ttsState == "paused" && group.items.any { it.id == ttsSrcId } && !calloutOpen
        val isMulti = group.items.size > 1
        val cx = group.cx * vpW
        val cy = group.cy * vpH
        val bg = when {
            isTtsPlaying -> ViewportStyle.DotPlaying
            isTtsPaused -> ViewportStyle.DotPaused
            isActive -> ViewportStyle.DotActive
            else -> ViewportStyle.DotBg
        }
        val border = when {
            isActive -> Color.White
            else -> ViewportStyle.DotBorder
        }
        val dotSize = if (isMulti) 18.dp else 14.dp
        val hitSize = 34.dp

        with(density) {
            Box(
                modifier = modifier
                    .offset {
                        IntOffset(
                            (cx - hitSize.toPx() / 2f).toInt(),
                            (cy - hitSize.toPx() / 2f).toInt(),
                        )
                    }
                    .size(hitSize)
                    .clickable { onDotClick(group) },
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(dotSize)
                        .background(bg, CircleShape)
                        .border(2.dp, border, CircleShape),
                )
            }
        }
    }
}

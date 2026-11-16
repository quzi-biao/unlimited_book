package com.flipbook.ai.flipbook.migrated.components.viewport

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.utils.NormalizedBox

/** 对应 WebView: components/Viewport/RegionHighlight.jsx */
@Composable
fun RegionHighlight(
    box: NormalizedBox?,
    vpW: Float,
    vpH: Float,
    isActive: Boolean,
    ttsState: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (box == null) return
    val density = LocalDensity.current
    val isPlaying = isActive && ttsState == "playing"
    with(density) {
        Box(
            modifier = modifier
                .offset { IntOffset((box.x * vpW).toInt(), (box.y * vpH).toInt()) }
                .size((box.w * vpW).coerceAtLeast(1f).toDp(), (box.h * vpH).coerceAtLeast(1f).toDp())
                .background(Color.Transparent, RoundedCornerShape(6.dp))
                .border(1.5.dp, ViewportStyle.RegionBorder, RoundedCornerShape(6.dp))
                .then(
                    if (isActive) Modifier.clickable(onClick = onClick) else Modifier,
                ),
        ) {
            if (isActive) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = (-6).dp, y = (-6).dp)
                        .size(22.dp)
                        .background(Color(0xE6000000), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isPlaying) {
                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                            repeat(3) {
                                Box(
                                    modifier = Modifier
                                        .size(width = 2.dp, height = 8.dp)
                                        .background(Color(0xFF10B981), RoundedCornerShape(2.dp)),
                                )
                            }
                        }
                    } else {
                        Icon(
                            imageVector = Icons.Rounded.PlayArrow,
                            contentDescription = "播放",
                            tint = Color.White,
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }
            }
        }
    }
}

package com.flipbook.ai.flipbook.migrated.components.explorequeue

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.common.BreathingGlow
import com.flipbook.ai.flipbook.migrated.hooks.ExploreTask

/** 对应 WebView: components/ExploreQueue/ExploreQueueBtn.jsx */
@Composable
fun ExploreQueueBtn(
    queue: List<ExploreTask>,
    isProcessing: Boolean,
    panelOpen: Boolean,
    onToggle: () -> Unit,
    errorTip: String = "",
    modifier: Modifier = Modifier,
) {
    if (queue.isEmpty()) return
    val total = queue.size
    val doneCount = queue.count { it.status == "done" }
    val hasActive = queue.any { it.status == "waiting" || it.status == "exploring" }
    val hasDone = doneCount > 0
    val label = if (hasActive) "探索任务" else "探索结果"
    val accent = if (hasDone) Color(0xFFFB923C) else Color(0xFF818CF8)
    val countColor = if (hasDone) Color(0xFFFB923C) else Color(0xFF818CF8)
    val cardBg = if (hasDone) Color(0xE12D1405) else Color(0xD916122E)
    val borderColor = if (hasDone) Color(0x8CFB923C) else Color(0x736366F1)
    
    val infiniteTransition = rememberInfiniteTransition(label = "explore-btn-anim")
    
    val spin = infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "explore-btn-spin-angle",
    )

    Box(modifier = modifier, contentAlignment = Alignment.TopEnd) {
        if (errorTip.isNotBlank()) {
            Box(
                modifier = Modifier
                    .padding(end = 144.dp, top = 2.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xCCEF4444))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Text(errorTip, color = Color.White, fontSize = 11.sp)
            }
        }

        Box(contentAlignment = Alignment.Center) {
            BreathingGlow(
                color = if (hasDone) Color(0xFFFB923C) else Color(0xFF6366F1),
                modifier = Modifier.matchParentSize(),
                durationMs = if (hasDone) 1600 else 1900,
            )

            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(if (panelOpen) Color(0xFF111827) else cardBg)
                    .clickable(onClick = onToggle)
                    .border(1.dp, borderColor, RoundedCornerShape(20.dp))
                    .padding(horizontal = 14.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (isProcessing) {
                    Icon(
                        Icons.Rounded.Refresh,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.rotate(spin.value).size(16.dp),
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .width(7.dp)
                            .height(7.dp)
                            .clip(RoundedCornerShape(99.dp))
                            .background(accent.copy(alpha = 0.75f)),
                    )
                }
                Text(label, color = if (hasDone) Color(0xFFFED7AA) else Color(0xFFC7D2FE), fontSize = 13.sp)
                Spacer(Modifier.width(1.dp))
                Text("($doneCount/$total)", color = countColor, fontSize = 12.sp)
            }
        }
    }
}

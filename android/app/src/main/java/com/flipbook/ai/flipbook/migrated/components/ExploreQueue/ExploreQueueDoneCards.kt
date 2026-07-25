package com.flipbook.ai.flipbook.migrated.components.explorequeue

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.hooks.ExploreTask
import kotlinx.coroutines.delay

/** 对应 WebView: components/ExploreQueue/ExploreQueueDoneCards.jsx */
@Composable
fun ExploreQueueDoneCards(
    tasks: List<ExploreTask>,
    onView: (ExploreTask) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (tasks.isEmpty()) return
    val stackWidth = 280.dp
    Column(
        modifier = modifier.width(stackWidth),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        tasks.forEachIndexed { i, task ->
            val pageTitle = task.result?.get("pageTitle") as? String ?: task.sourcePageTitle ?: "深入探索"
            val bookTitle = task.bookTitle.orEmpty()
            var visible by remember(task.id) { mutableStateOf(false) }
            val alpha by animateFloatAsState(
                targetValue = if (visible) 1f else 0f,
                animationSpec = tween(durationMillis = 220, easing = FastOutSlowInEasing),
                label = "done-card-alpha",
            )
            LaunchedEffect(task.id) {
                delay((i * 60L).coerceAtMost(240L))
                visible = true
            }
            Row(
                modifier = Modifier
                    .alpha(alpha)
                    .shadow(
                        elevation = 10.dp,
                        shape = RoundedCornerShape(14.dp),
                        ambientColor = Color(0x59FB923C),
                        spotColor = Color(0x59FB923C),
                    )
                    .background(Color(0xD11E0F05), RoundedCornerShape(14.dp))
                    .border(1.dp, Color(0x73FB923C), RoundedCornerShape(14.dp))
                    .clickable { onView(task) }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // 圆圈背景包裹 Check 图标，对应 JSX .iconWrap
                Box(
                    modifier = Modifier
                        .size(22.dp)
                        .background(Color(0x40FB923C), CircleShape)
                        .border(1.dp, Color(0x66FB923C), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Rounded.Check,
                        contentDescription = null,
                        tint = Color(0xFFFB923C),
                        modifier = Modifier.size(11.dp),
                    )
                }
                Column(modifier = Modifier.weight(1f).padding(start = 10.dp, end = 8.dp)) {
                    Text(pageTitle, color = Color(0xFFFED7AA), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (bookTitle.isNotBlank()) {
                        Text(bookTitle, color = Color(0x8CFED7AA), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Text("查看 →", color = Color(0xFFFB923C), fontSize = 12.sp)
            }
        }
    }
}

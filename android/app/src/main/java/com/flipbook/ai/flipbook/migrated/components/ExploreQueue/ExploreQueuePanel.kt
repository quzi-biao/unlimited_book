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
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.hooks.ExploreTask

private val statusOrder = mapOf("done" to 0, "exploring" to 1, "waiting" to 2, "failed" to 3)
private val statusLabels = mapOf(
    "done" to "已完成",
    "exploring" to "探索中",
    "waiting" to "等待中",
    "failed" to "探索失败",
)

/** 对应 WebView: components/ExploreQueue/ExploreQueuePanel.jsx */
@Composable
fun ExploreQueuePanel(
    open: Boolean,
    queue: List<ExploreTask>,
    onClose: () -> Unit,
    onView: (ExploreTask) -> Unit,
    onCancel: (String) -> Unit,
    onRetry: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!open || queue.isEmpty()) return
    val tasks = queue.sortedWith(compareBy<ExploreTask> { statusOrder[it.status] ?: 9 }.thenBy { it.createdAt })

    Box(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xF2111827), RoundedCornerShape(14.dp))
                .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(14.dp))
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("探索任务队列", color = Color(0xFFE5E7EB), fontSize = 13.sp)
                Text("${queue.size} 个任务", color = Color(0xFF9CA3AF), fontSize = 11.sp)
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(tasks, key = { it.id }) { task ->
                    TaskRow(task = task, onView = onView, onCancel = onCancel, onRetry = onRetry)
                }
            }
        }
    }
}

@Composable
private fun TaskRow(
    task: ExploreTask,
    onView: (ExploreTask) -> Unit,
    onCancel: (String) -> Unit,
    onRetry: (String) -> Unit,
) {
    val spin = rememberInfiniteTransition(label = "explore-row-spin").animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "explore-row-spin-angle",
    )
    val badgeColor = when (task.status) {
        "done" -> Color(0xFF10B981)
        "exploring" -> Color(0xFF6366F1)
        "failed" -> Color(0xFFEF4444)
        else -> Color(0xFFF59E0B)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0x12000000), RoundedCornerShape(10.dp))
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .background(badgeColor.copy(alpha = 0.18f), RoundedCornerShape(20.dp))
                .padding(horizontal = 7.dp, vertical = 3.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                when (task.status) {
                    "done" -> Icon(Icons.Rounded.Check, contentDescription = null, tint = badgeColor, modifier = Modifier.size(10.dp))
                    "exploring" -> Icon(
                        Icons.Rounded.Refresh,
                        contentDescription = null,
                        tint = badgeColor,
                        modifier = Modifier
                            .size(10.dp)
                            .rotate(spin.value),
                    )
                    "failed" -> Icon(Icons.Rounded.Close, contentDescription = null, tint = badgeColor, modifier = Modifier.size(10.dp))
                }
                Text(statusLabels[task.status] ?: task.status, color = badgeColor, fontSize = 10.sp)
            }
        }
        Column(modifier = Modifier.weight(1f).padding(start = 8.dp, end = 8.dp)) {
            Text(task.bookTitle.orEmpty().ifBlank { "未命名" }, color = Color(0xFFE5E7EB), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(task.sourcePageTitle.orEmpty().ifBlank { "—" }, color = Color(0xFF9CA3AF), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        when (task.status) {
            "done" -> ActionText("查看") { onView(task) }
            "waiting" -> ActionText("取消") { onCancel(task.id) }
            "failed" -> {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionText("重试") { onRetry(task.id) }
                    ActionText("取消") { onCancel(task.id) }
                }
            }
        }
    }
}

@Composable
private fun ActionText(label: String, onClick: () -> Unit) {
    Text(
        text = label,
        color = Color(0xFFA5B4FC),
        fontSize = 11.sp,
        modifier = Modifier
            .background(Color(0x1A6366F1), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp)
            .run { this }, // keep style chain explicit
    )
}

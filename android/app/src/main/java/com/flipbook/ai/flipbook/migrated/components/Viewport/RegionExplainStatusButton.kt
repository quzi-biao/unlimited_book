package com.flipbook.ai.flipbook.migrated.components.viewport

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
internal fun RegionExplainStatusButton(
    status: RegionExplainStatus,
    onView: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val done = status == RegionExplainStatus.Done
    val failed = status == RegionExplainStatus.Failed
    val bg = when (status) {
        RegionExplainStatus.Loading -> Color(0xFF6366F1)
        RegionExplainStatus.Done -> Color(0xFFF59E0B)
        RegionExplainStatus.Failed -> Color(0xFFEF4444)
    }

    Box(
        modifier = modifier
            .size(34.dp)
            .clip(CircleShape)
            .background(bg)
            .clickable(enabled = true, onClick = onView),
        contentAlignment = Alignment.Center,
    ) {
        when {
            status == RegionExplainStatus.Loading -> CircularProgressIndicator(
                color = Color.White,
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp),
            )
            done -> Icon(
                imageVector = Icons.Rounded.Check,
                contentDescription = "解读完成",
                tint = Color.White,
                modifier = Modifier.size(18.dp),
            )
            failed -> Icon(
                imageVector = Icons.Rounded.Close,
                contentDescription = "解读失败",
                tint = Color.White,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

package com.flipbook.ai.flipbook.migrated.components.viewport

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.utils.NormalizedBox
import kotlin.math.PI
import kotlin.math.roundToInt

/** 对应 WebView: components/Viewport/SelectionBox.jsx */
@Composable
fun SelectionBox(
    selBox: NormalizedBox?,
    vpW: Float,
    vpH: Float,
    confirmProgress: Float,
    modifier: Modifier = Modifier,
) {
    if (selBox == null || selBox.w <= 0.004f || selBox.h <= 0.004f) return
    val density = LocalDensity.current
    with(density) {
        val widthDp = (selBox.w * vpW).coerceAtLeast(1f).toDp()
        val heightDp = (selBox.h * vpH).coerceAtLeast(1f).toDp()
        val leftPx = (selBox.x * vpW).roundToInt()
        val topPx = (selBox.y * vpH).roundToInt()

        Box(
            modifier = modifier
                .offset { IntOffset(leftPx, topPx) }
                .size(widthDp, heightDp)
                .background(ViewportStyle.SelectionBg, RoundedCornerShape(2.dp))
                .border(1.5.dp, ViewportStyle.SelectionBorder, RoundedCornerShape(2.dp)),
        ) {
            if (confirmProgress > 0f) {
                val clamped = confirmProgress.coerceIn(0f, 1f)
                Canvas(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .offset(y = 52.dp)
                        .size(40.dp),
                ) {
                    drawArc(
                        color = ViewportStyle.SelectionGlow,
                        startAngle = 0f,
                        sweepAngle = 360f,
                        useCenter = false,
                        style = Stroke(width = 3.dp.toPx()),
                        size = Size(size.width, size.height),
                    )
                    drawArc(
                        color = ViewportStyle.SelectionBorder,
                        startAngle = -90f,
                        sweepAngle = (clamped * 2f * PI.toFloat()) * (180f / PI.toFloat()),
                        useCenter = false,
                        style = Stroke(width = 3.dp.toPx()),
                        size = Size(size.width, size.height),
                    )
                }
            }
        }
    }
}

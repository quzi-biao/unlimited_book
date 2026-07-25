package com.flipbook.ai.flipbook.migrated.components.shelfpanel

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * 话题引导动效：扩散圆点 + 提示卡片
 * 当书单为空、首次自动打开话题时展示，引导用户点击感兴趣的话题。
 */
@Composable
fun TopicGuideHint(modifier: Modifier = Modifier) {
    val infinite = rememberInfiniteTransition(label = "guideAnim")

    // 提示卡片的呼吸透明度
    val cardAlpha by infinite.animateFloat(
        initialValue = 0.7f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "cardAlpha",
    )

    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // 提示卡片
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Color(0xFF4C1D95).copy(alpha = cardAlpha * 0.35f),
                    RoundedCornerShape(10.dp),
                )
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // 扩散点动效
                PulseDot(color = Color(0xFFA78BFA))
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "点击感兴趣的话题",
                        color = Color(0xFFE0D7FF),
                        fontSize = 12.sp,
                    )
                    Text(
                        "即可探索相关内容",
                        color = Color(0xFFB0A4D8),
                        fontSize = 11.sp,
                    )
                }
            }
        }

        // 向下指引的扩散箭头
        GuideArrow()
    }
}

/**
 * 扩散圆点动效：中心实点 + 扩散环。
 * 用 Canvas 绘制，循环播放两层错开相位的扩散圆环。
 */
@Composable
fun PulseDot(
    color: Color,
    size: Dp = 20.dp,
    modifier: Modifier = Modifier,
) {
    val infinite = rememberInfiniteTransition(label = "pulseDot")

    // 第一层扩散圆：0→1 scale，1→0 alpha
    val radius1 by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1400), RepeatMode.Restart),
        label = "r1",
    )
    // 第二层扩散圆：错开 700ms 相位
    val radius2 by infinite.animateFloat(
        initialValue = 0.5f,
        targetValue = 1.5f,
        animationSpec = infiniteRepeatable(tween(1400), RepeatMode.Restart),
        label = "r2",
    )

    val maxR = size.value / 2
    Canvas(modifier = modifier.size(size)) {
        val cx = size.toPx() / 2
        val cy = size.toPx() / 2

        // 扩散环1
        if (radius1 < 1f) {
            drawCircle(
                color = color.copy(alpha = (1f - radius1) * 0.5f),
                radius = maxR * (0.5f + radius1),
                style = Stroke(width = 1.5.dp.toPx()),
            )
        }
        // 扩散环2（错位）
        val r2clamped = (radius2 - 0.5f).coerceIn(0f, 1f)
        if (r2clamped < 1f) {
            drawCircle(
                color = color.copy(alpha = (1f - r2clamped) * 0.4f),
                radius = maxR * (0.5f + r2clamped),
                style = Stroke(width = 1.dp.toPx()),
            )
        }
        // 中心实点
        drawCircle(color = color, radius = 4.dp.toPx())
    }
}

/**
 * 向下弹跳箭头，引导用户向下看话题列表。
 */
@Composable
private fun GuideArrow() {
    val infinite = rememberInfiniteTransition(label = "arrow")
    val offsetY by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 5f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "arrowY",
    )
    val alpha by infinite.animateFloat(
        initialValue = 0.5f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "arrowAlpha",
    )

    // 用三角形 Canvas 画箭头
    Canvas(
        modifier = Modifier
            .size(width = 16.dp, height = 8.dp)
            .padding(top = offsetY.dp),
    ) {
        val w = size.width
        val h = size.height
        val path = androidx.compose.ui.graphics.Path().apply {
            moveTo(0f, 0f)
            lineTo(w, 0f)
            lineTo(w / 2f, h)
            close()
        }
        drawPath(path, color = Color(0xFFA78BFA).copy(alpha = alpha))
    }
}

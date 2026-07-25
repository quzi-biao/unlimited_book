package com.flipbook.ai.flipbook.migrated.components.common

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/** 两个引导动画共用的圆圈尺寸系数，保证视觉连贯（步骤10a → 10b 是同一个圆） */
private const val CIRCLE_RATIO = 0.14f

/**
 * 步骤10a：瞄准十字 + 圆形呼吸动画
 *
 * 展示：
 * - 圆形准星（呼吸放大缩小：0.80×→1.20×，1.0s/次）
 * - 十字准线从圆圈内部延伸到圆圈外部
 * - 小圆心点
 *
 * 提示用户：找到屏幕上感兴趣的内容区域。
 */
@Composable
internal fun TargetCrosshairAnimation() {
    val density = LocalDensity.current
    val config = LocalConfiguration.current

    val infiniteTransition = rememberInfiniteTransition(label = "target-anim")

    // 呼吸缩放：0.80 → 1.20 → 0.80，周期 1.0s
    val scale by infiniteTransition.animateFloat(
        initialValue = 0.80f,
        targetValue = 1.20f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "target-scale",
    )

    val screenW = with(density) { config.screenWidthDp.dp.toPx() }
    val screenH = with(density) { config.screenHeightDp.dp.toPx() }

    // 圆圈中心（屏幕 40% 高度，与步骤10b 画圈动画同位置）
    val cx = screenW * 0.5f
    val cy = screenH * 0.40f
    val baseR = minOf(screenW, screenH) * CIRCLE_RATIO
    val r = baseR * scale

    Canvas(modifier = Modifier.fillMaxSize()) {
        val center = Offset(cx, cy)
        val ringColor = Color(0xCCA78BFA)
        val strokeW = 2.5.dp.toPx()

        // ── 圆形准星
        drawCircle(
            color = ringColor,
            radius = r,
            center = center,
            style = Stroke(width = strokeW),
        )

        // ── 圆心小点
        drawCircle(
            color = ringColor,
            radius = strokeW * 1.4f,
            center = center,
        )

        // ── 十字准线（四段：左/右/上/下，从内部间隙延伸到圆外）
        val gap = r * 0.32f      // 与圆心的间距
        val ext = r * 0.48f      // 超出圆环的延伸量
        val cap = StrokeCap.Round

        // 水平 左
        drawLine(ringColor, Offset(cx - r - ext, cy), Offset(cx - gap, cy), strokeW, cap)
        // 水平 右
        drawLine(ringColor, Offset(cx + gap, cy), Offset(cx + r + ext, cy), strokeW, cap)
        // 垂直 上
        drawLine(ringColor, Offset(cx, cy - r - ext), Offset(cx, cy - gap), strokeW, cap)
        // 垂直 下
        drawLine(ringColor, Offset(cx, cy + gap), Offset(cx, cy + r + ext), strokeW, cap)
    }
}

/**
 * 步骤10b：手指画圈选区动画
 *
 * 展示：
 * - 背景虚线圆（始终可见，预示轨迹）
 * - 紫色实弧随手指前进逐步绘制（0→360°，2.4s/圈）
 * - 👉 手指 Emoji（旋转45°，模拟向右下画圈的手势）
 *
 * 提示用户：在感兴趣的区域周围画一个圈。
 */
@Composable
internal fun GestureSelectionAnimation() {
    val density = LocalDensity.current
    val config = LocalConfiguration.current

    val infiniteTransition = rememberInfiniteTransition(label = "gesture-selection")

    // 扫描角度：0→360，周期 2.4s，循环重播
    val sweep by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "gesture-sweep",
    )

    val screenW = with(density) { config.screenWidthDp.dp.toPx() }
    val screenH = with(density) { config.screenHeightDp.dp.toPx() }

    // 圆圈中心（与步骤10a同位置，保证视觉连贯）
    val cx = screenW * 0.5f
    val cy = screenH * 0.40f
    // 正圆（rx = ry = CIRCLE_RATIO），与步骤10a的圆准星大小一致
    val r = minOf(screenW, screenH) * CIRCLE_RATIO

    // 当前手指位置（从顶部顺时针）
    val rad = ((sweep - 90.0) * PI / 180.0).toFloat()
    val fingerX = cx + r * cos(rad)
    val fingerY = cy + r * sin(rad)
    val fingerOffsetPx = with(density) { 18.dp.roundToPx() }

    Box(modifier = Modifier.fillMaxSize()) {
        // ── 圆形选区弧线绘制
        Canvas(modifier = Modifier.fillMaxSize()) {
            val topLeft = Offset(cx - r, cy - r)
            val ovalSize = Size(r * 2f, r * 2f)

            // 背景虚线圆（始终可见，给用户预示轨迹）
            drawArc(
                color = Color(0x44A78BFA),
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = ovalSize,
                style = Stroke(
                    width = 2.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 8f)),
                ),
            )

            // 进度弧线（紫色实线，随手指前进逐步绘制）
            if (sweep > 2f) {
                drawArc(
                    color = Color(0xCCA78BFA),
                    startAngle = -90f,
                    sweepAngle = sweep,
                    useCenter = false,
                    topLeft = topLeft,
                    size = ovalSize,
                    style = Stroke(
                        width = 3.dp.toPx(),
                        cap = StrokeCap.Round,
                    ),
                )
            }
        }

        // ── 手指 Emoji（👉 旋转45°，模拟右下画圈手势）
        Text(
            text = "\uD83D\uDC49", // 👉
            fontSize = 28.sp,
            modifier = Modifier
                .absoluteOffset {
                    IntOffset(
                        x = (fingerX - fingerOffsetPx).roundToInt(),
                        y = (fingerY - fingerOffsetPx).roundToInt(),
                    )
                }
                .rotate(45f),
        )
    }
}

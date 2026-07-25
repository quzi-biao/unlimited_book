package com.flipbook.ai.flipbook.migrated.components.common

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.delay

private val RING_INSET = 2.dp
private val RING_CORNER = 8.dp
private val TOOLTIP_MARGIN = 12.dp
private val TOOLTIP_MAX_WIDTH = 210.dp
private val TOOLTIP_WIDE_WIDTH = 300.dp
private val ARROW_SIZE = 8.dp

/**
 * 全局多步骤引导浮层，挂载在 AppScreen 根 Box 最顶层。
 *
 * 渲染：暗色遮罩打孔高亮目标 + 内嵌呼吸灯 + Tooltip 气泡（含上/下一步按钮）。
 * 当 [controller.activeStep] 为 null 时不渲染任何内容。
 */
@Composable
fun GuideOverlay(controller: GuideController) {
    val step = controller.activeStep ?: return
    val density = LocalDensity.current
    val bounds = step.targetBounds
    // 追踪 tooltip 气泡的实际渲染区域，与 spotlight 区域一起设为触摸穿透
    var tooltipRect by remember { mutableStateOf<Rect?>(null) }

    val infinite = rememberInfiniteTransition(label = "guide")
    val ringAlpha by infinite.animateFloat(
        initialValue = 0.45f, targetValue = 1.0f,
        animationSpec = infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "ring",
    )
    val ripple by infinite.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1400), RepeatMode.Restart),
        label = "ripple",
    )

    Box(modifier = Modifier.fillMaxSize()) {
        // ── 遮罩层 + 打孔 + 呼吸灯 ─────────────────────────────
        if (bounds != null) {
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen },
            ) {
                // 匹配目标元素的实际圆角（圆形按鈕传 22.dp，普通元素使用 RING_CORNER 8.dp）
                val cornerPx = (step.def.highlightCornerRadius ?: RING_CORNER).toPx()
                val insetPx = RING_INSET.toPx()
                drawRect(Color(0xBB000000))
                // 精确打孔：与目标 div 对齐
                drawPath(
                    Path().apply {
                        addRoundRect(RoundRect(bounds.left, bounds.top, bounds.right, bounds.bottom, CornerRadius(cornerPx)))
                    },
                    Color.Transparent, blendMode = BlendMode.Clear,
                )
                // 内嵌呼吸灯（不超出目标 div）
                drawPath(
                    Path().apply {
                        addRoundRect(RoundRect(
                            bounds.left + insetPx, bounds.top + insetPx,
                            bounds.right - insetPx, bounds.bottom - insetPx,
                            CornerRadius((cornerPx - insetPx).coerceAtLeast(0f)),
                        ))
                    },
                    Color(0xFFA78BFA).copy(alpha = ringAlpha),
                    style = Stroke(width = 2.dp.toPx()),
                )
                // 内部扩散圆（约束在 bounds 内）
                val maxR = minOf(bounds.width, bounds.height) / 2f * 0.75f
                drawCircle(
                    Color(0xFFA78BFA).copy(alpha = (1f - ripple) * 0.22f),
                    radius = maxR * ripple,
                    center = Offset(bounds.left + bounds.width / 2f, bounds.top + bounds.height / 2f),
                )
            }
        } else {
            // 无目标时仅显示半透明遮罩
            Box(modifier = Modifier.fillMaxSize().background(Color(0x88000000)))
        }

        // ── 动画层：在遮罩上方、Tooltip 下方 ───────────────────────
        if (step.def.showTargetAnimation) {
            TargetCrosshairAnimation()
        }
        if (step.def.showGestureAnimation) {
            GestureSelectionAnimation()
        }

        // ── Tooltip 气泡 + 边界追踪（用于穿透）─────────────────────
        Box(
            modifier = Modifier.onGloballyPositioned { coords ->
                tooltipRect = coords.boundsInRoot()
            },
        ) {
            TooltipBubble(
                step = step,
                density = density,
                bounds = bounds,
                onPrev = { controller.prev() },
                onNext = { controller.next() },
                onDismiss = { controller.dismiss() },
            )
        }
    }
}

/** 根据 anchor 定位并渲染 Tooltip 气泡 */
@Composable
private fun TooltipBubble(
    step: ActiveGuideStep,
    density: androidx.compose.ui.unit.Density,
    bounds: androidx.compose.ui.geometry.Rect?,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onDismiss: () -> Unit,
) {
    val maxWidth = if (step.def.wideTooltip) TOOLTIP_WIDE_WIDTH else TOOLTIP_MAX_WIDTH
    val marginPx = with(density) { TOOLTIP_MARGIN.toPx() }
    val tooltipW = with(density) { maxWidth.toPx() }
    // 增大高度估算（多行文本 + 进度点 + 按鈕的实际高度大于旧的 120dp）
    val tooltipH = with(density) { 180.dp.toPx() }
    val arrowPx = with(density) { ARROW_SIZE.toPx() }
    val edgePad = with(density) { 8.dp.toPx() }

    val screenHeightPx = with(density) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    val screenWidthPx = with(density) { LocalConfiguration.current.screenWidthDp.dp.toPx() }

    /** 将 tooltip 居中对齐目标元素，并 clamp 到屏幕内 */
    fun centeredLeft(boundsRect: androidx.compose.ui.geometry.Rect): Float =
        (boundsRect.left + boundsRect.width / 2f - tooltipW / 2f)
            .coerceAtLeast(edgePad)
            .coerceAtMost((screenWidthPx - tooltipW - edgePad).coerceAtLeast(edgePad))

    // 计算 tooltip 的 top/left（px）
    val (topPx, leftPx, showTopArrow, showRightArrow, showBottomArrow) = when {
        bounds == null && step.def.showTargetAnimation -> GuideAnchorResult(
            // 瞄准动画：tooltip 在圆圈正下方（56%），与动画同一视觉区域
            top = screenHeightPx * 0.56f,
            left = edgePad,
            showTop = false, showRight = false, showBottom = false,
        )
        bounds == null && step.def.showGestureAnimation -> GuideAnchorResult(
            // 画圈动画：tooltip 在圆圈正下方（55%），与动画同一视觉区域
            top = screenHeightPx * 0.55f,
            left = edgePad,
            showTop = false, showRight = false, showBottom = false,
        )
        bounds == null -> {
            // 无目标：屏幕 35% 高度处居中，用于纯文字引导步骤
            GuideAnchorResult(
                top = screenHeightPx * 0.35f,
                left = with(density) { 24.dp.toPx() },
                showTop = false, showRight = false, showBottom = false,
            )
        }
        step.def.anchor == TooltipAnchor.Below -> GuideAnchorResult(
            top = bounds.bottom + marginPx + arrowPx,
            left = centeredLeft(bounds),
            showTop = true, showRight = false, showBottom = false,
        )
        step.def.anchor == TooltipAnchor.Above -> GuideAnchorResult(
            // 额外向上偏移 24dp，避免气泡覆盖按鈕
            top = bounds.top - marginPx * 2 - tooltipH - with(density) { 24.dp.toPx() },
            left = centeredLeft(bounds),
            showTop = false, showRight = false, showBottom = true,
        )
        step.def.anchor == TooltipAnchor.Right -> GuideAnchorResult(
            top = bounds.top + bounds.height / 2f - tooltipH / 2f,
            left = bounds.right + marginPx + arrowPx,
            showTop = false, showRight = false, showBottom = false,
        )
        else -> /* Left */ GuideAnchorResult(
            top = bounds.top + bounds.height / 2f - tooltipH / 2f,
            left = bounds.left - marginPx - tooltipW - arrowPx,
            showTop = false, showRight = true, showBottom = false,
        )
    }

    val topDp: Dp = with(density) { topPx.toDp() }.coerceAtLeast(4.dp)
    val leftDp: Dp = with(density) { leftPx.toDp() }.coerceAtLeast(4.dp)

    // 关闭按键倒计时：step 切换时重置为 10s，倒计时到 0 后出现关闭按键
    var dismissSecondsLeft by remember(step.def.id) {
        mutableStateOf(if (step.def.showDismiss) 10 else 0)
    }
    LaunchedEffect(step.def.id) {
        if (step.def.showDismiss && dismissSecondsLeft > 0) {
            repeat(dismissSecondsLeft) {
                delay(1000L)
                dismissSecondsLeft--
            }
        }
    }

    Box(modifier = Modifier.padding(top = topDp, start = leftDp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // ── 气泡主体 ──
            Column(
                modifier = Modifier
                    .widthIn(min = TOOLTIP_MAX_WIDTH, max = maxWidth)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF1E1650))
                    .border(1.dp, Color(0x666366F1), RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp)
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
            ) {
                // 标题行：扩散点 + 标签 + 步骤进度
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PulseDotSmall()
                        Spacer(Modifier.width(8.dp))
                        Text("操作引导", color = Color(0xFFA78BFA), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Text(
                        "${step.stepIndex + 1} / ${step.totalSteps}",
                        color = Color(0xFF6B7280),
                        fontSize = 10.sp,
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(step.def.message, color = Color(0xFFE0D7FF), fontSize = 13.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(10.dp))
                // 步骤进度点
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    repeat(step.totalSteps) { i ->
                        Box(
                            modifier = Modifier
                                .size(if (i == step.stepIndex) 8.dp else 6.dp)
                                .clip(CircleShape)
                                .background(if (i == step.stepIndex) Color(0xFFA78BFA) else Color(0xFF3D3270)),
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                // 按钮区（showPrev/showNext 控制可见性）
                val showPrevBtn = step.def.showPrev && !step.isFirst
                val showNextBtn = step.def.showNext
                if (showPrevBtn || showNextBtn) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = if (showPrevBtn && showNextBtn) Arrangement.SpaceBetween else if (showPrevBtn) Arrangement.Start else Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (showPrevBtn) {
                            Text(
                                "← 上一步",
                                color = Color(0xFF8B8FB8),
                                fontSize = 12.sp,
                                modifier = Modifier.clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null,
                                    onClick = onPrev,
                                ),
                            )
                        }
                        if (showNextBtn) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFF6366F1))
                                    .clickable(onClick = onNext)
                                    .padding(horizontal = 16.dp, vertical = 6.dp),
                            ) {
                                Text(
                                    step.def.nextLabel,
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                )
                            }
                        }
                    }
                } else if (step.def.showDismiss) {
                    // 关闭按键：倒计时结束后才出现（showDismiss 步骤专用）
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (dismissSecondsLeft <= 0) {
                            // 倒计时结束：显示真正的关闭按键
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0x226366F1))
                                    .border(1.dp, Color(0x446366F1), RoundedCornerShape(8.dp))
                                    .clickable(
                                        interactionSource = remember { MutableInteractionSource() },
                                        indication = null,
                                        onClick = onDismiss,
                                    )
                                    .padding(horizontal = 16.dp, vertical = 6.dp),
                            ) {
                                Text("关闭", color = Color(0xFFA78BFA), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                        } else {
                            // 倒计时阶段：显示倒计时文字提示
                            Text(
                                "${dismissSecondsLeft}s 后可关闭",
                                color = Color(0xFF6B7280),
                                fontSize = 11.sp,
                            )
                        }
                    }
                } else {
                    // 无按鈕：等待用户操作推进（话题点击 / 任务完成）
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        WaitingDots()
                        Text("等待中…请按提示操作", color = Color(0xFF6B7280), fontSize = 11.sp)
                    }
                }
            }
            // 左侧 anchor → 气泡右侧向右三角箭头指向目标
            if (showRightArrow) {
                Canvas(modifier = Modifier.width(ARROW_SIZE).height(ARROW_SIZE * 2)) {
                    val w = size.width; val h = size.height
                    drawPath(Path().apply { moveTo(0f, 0f); lineTo(w, h / 2f); lineTo(0f, h); close() }, Color(0xFF1E1650))
                }
            }
        }
        // Above anchor → 气泡下方向下三角
        if (showBottomArrow) {
            Canvas(modifier = Modifier.align(Alignment.BottomStart).padding(start = 20.dp).width(ARROW_SIZE * 2).height(ARROW_SIZE)) {
                val w = size.width; val h = size.height
                drawPath(Path().apply { moveTo(0f, 0f); lineTo(w, 0f); lineTo(w / 2f, h); close() }, Color(0xFF1E1650))
            }
        }
        // Below anchor → 气泡上方向上三角
        if (showTopArrow) {
            Canvas(modifier = Modifier.align(Alignment.TopStart).padding(start = 20.dp).width(ARROW_SIZE * 2).height(ARROW_SIZE)) {
                val w = size.width; val h = size.height
                drawPath(Path().apply { moveTo(w / 2f, 0f); lineTo(w, h); lineTo(0f, h); close() }, Color(0xFF1E1650))
            }
        }
    }
}

/** 辅助数据类，存储 tooltip 定位计算结果 */
private data class GuideAnchorResult(
    val top: Float,
    val left: Float,
    val showTop: Boolean,
    val showRight: Boolean,
    val showBottom: Boolean,
)

/** 小版本扩散点（嵌在 Tooltip 标题行） */
@Composable
private fun PulseDotSmall() {
    val infinite = rememberInfiniteTransition(label = "dot")
    val r by infinite.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Restart),
        label = "dotR",
    )
    Canvas(modifier = Modifier.size(14.dp)) {
        val cx = size.width / 2f; val cy = size.height / 2f
        drawCircle(Color(0xFFA78BFA).copy(alpha = (1f - r) * 0.5f), radius = 7.dp.toPx() * r, center = Offset(cx, cy))
        drawCircle(Color(0xFFA78BFA), radius = 3.5.dp.toPx(), center = Offset(cx, cy))
    }
}

/** 三点闪烁动画，表示「等待用户操作」状态 */
@Composable
private fun WaitingDots() {
    val infinite = rememberInfiniteTransition(label = "wait")
    val phase by infinite.animateFloat(
        initialValue = 0f, targetValue = 3f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Restart),
        label = "phase",
    )
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(3) { i ->
            val alpha = if (phase.toInt() == i) 1f else 0.25f
            Box(
                modifier = Modifier
                    .size(5.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF6366F1).copy(alpha = alpha)),
            )
        }
    }
}


package com.flipbook.ai.flipbook.migrated.components.common

import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun BreathingGlow(
    color: Color,
    size: Dp? = null,
    alphaRange: ClosedFloatingPointRange<Float> = 0.1f..0.3f, // Perfectly balanced base alpha
    scaleRange: ClosedFloatingPointRange<Float> = 1f..1.06f,
    durationMs: Int = 2200,
    cornerRadius: Dp = 20.dp,
    blurRadius: Dp = 10.dp,
    padding: Dp = 12.dp,
    modifier: Modifier = Modifier,
) {
    val pulse = rememberInfiniteTransition(label = "breathing-glow").animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = durationMs, easing = EaseInOut),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "breathing-glow-pulse",
    )
    val currentAlpha = alphaRange.start + (alphaRange.endInclusive - alphaRange.start) * pulse.value
    val currentScale = scaleRange.start + (scaleRange.endInclusive - scaleRange.start) * pulse.value

    val finalModifier = if (size != null) modifier.size(size) else modifier

    Canvas(
        modifier = finalModifier
            .layout { measurable, constraints ->
                val padPx = padding.roundToPx()
                val expandedWidth = constraints.maxWidth + padPx * 2
                val expandedHeight = constraints.maxHeight + padPx * 2
                val placeable = measurable.measure(
                    constraints.copy(
                        minWidth = expandedWidth,
                        maxWidth = expandedWidth,
                        minHeight = expandedHeight,
                        maxHeight = expandedHeight
                    )
                )
                layout(constraints.maxWidth, constraints.maxHeight) {
                    placeable.place(-padPx, -padPx)
                }
            }
    ) {
        val padPx = padding.toPx()
        val baseW = this.size.width - padPx * 2
        val baseH = this.size.height - padPx * 2
        
        val scaledW = baseW * currentScale
        val scaledH = baseH * currentScale
        
        val cx = this.size.width / 2f
        val cy = this.size.height / 2f
        
        val maxSpread = blurRadius.toPx()
        val rectRadius = cornerRadius.toPx() * currentScale
        
        val layers = 24
        val step = maxSpread / layers

        for (i in layers downTo 1) {
            val spread = i * step
            // Balanced quadratic falloff: an ideal middle ground between cubic (too faint) and linear (too deep)
            val progress = i.toFloat() / layers
            val layerAlpha = currentAlpha * (0.04f + 0.12f * (1f - progress) * (1f - progress))
            
            val drawW = scaledW + spread * 2
            val drawH = scaledH + spread * 2
            
            drawRoundRect(
                color = color.copy(alpha = layerAlpha),
                topLeft = Offset(cx - drawW / 2f, cy - drawH / 2f),
                size = Size(drawW, drawH),
                cornerRadius = CornerRadius(rectRadius + spread, rectRadius + spread)
            )
        }
    }
}

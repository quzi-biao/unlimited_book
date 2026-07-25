package com.flipbook.ai.flipbook.migrated.components.viewport

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke

data class ViewportPoint(
    val x: Float,
    val y: Float,
)

/** 对应 WebView: components/Viewport/LassoOverlay.jsx */
@Composable
fun LassoOverlay(
    points: List<ViewportPoint>,
    nearClose: Boolean,
    drawing: Boolean,
    modifier: Modifier = Modifier,
) {
    if (!drawing || points.size < 2) return

    val strokeColor = if (nearClose) ViewportStyle.LassoGreen else ViewportStyle.LassoBlue
    val fillColor = if (nearClose) ViewportStyle.LassoGreenFill else ViewportStyle.LassoBlueFill

    Canvas(modifier = modifier) {
        val path = Path().apply {
            moveTo(points.first().x, points.first().y)
            points.drop(1).forEach { p -> lineTo(p.x, p.y) }
        }
        drawPath(path = path, color = strokeColor, style = Stroke(width = 2.5f))

        val first = points.first()
        drawCircle(color = fillColor, radius = if (nearClose) 14f else 8f, center = Offset(first.x, first.y))
        drawCircle(color = strokeColor, radius = if (nearClose) 14f else 8f, center = Offset(first.x, first.y), style = Stroke(width = 2.5f))
    }
}

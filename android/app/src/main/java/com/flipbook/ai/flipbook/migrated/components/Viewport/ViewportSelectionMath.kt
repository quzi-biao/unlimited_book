package com.flipbook.ai.flipbook.migrated.components.viewport

import androidx.compose.ui.geometry.Offset
import com.flipbook.ai.flipbook.migrated.utils.NormalizedBox
import com.flipbook.ai.flipbook.migrated.utils.PixelBox

internal fun clampViewportPoint(raw: Offset, vpW: Float, vpH: Float): Offset {
    return Offset(
        x = raw.x.coerceIn(0f, vpW),
        y = raw.y.coerceIn(0f, vpH),
    )
}

internal fun normalizedFromPoints(start: Offset, end: Offset, vpW: Float, vpH: Float): NormalizedBox {
    val x1 = minOf(start.x, end.x)
    val y1 = minOf(start.y, end.y)
    val x2 = maxOf(start.x, end.x)
    val y2 = maxOf(start.y, end.y)
    return NormalizedBox(
        x = (x1 / vpW).coerceIn(0f, 1f),
        y = (y1 / vpH).coerceIn(0f, 1f),
        w = ((x2 - x1) / vpW).coerceIn(0f, 1f),
        h = ((y2 - y1) / vpH).coerceIn(0f, 1f),
    )
}

internal fun pixelFromNorm(norm: NormalizedBox, vpW: Float, vpH: Float): PixelBox {
    return PixelBox(
        x = norm.x * vpW,
        y = norm.y * vpH,
        w = norm.w * vpW,
        h = norm.h * vpH,
    )
}

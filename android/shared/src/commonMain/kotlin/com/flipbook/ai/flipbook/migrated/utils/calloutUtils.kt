package com.flipbook.ai.flipbook.migrated.utils

import kotlin.math.max
import kotlin.math.min

const val CALLOUT_W = 430f
const val CALLOUT_H = 600f

data class PixelBox(
    val x: Float,
    val y: Float,
    val w: Float,
    val h: Float,
)

data class PixelRect(
    val left: Float,
    val top: Float,
    val width: Float,
    val height: Float,
)

/** 对应 WebView: utils/calloutUtils.js */
fun calcCalloutPos(
    box: PixelBox,
    cw: Float,
    ch: Float,
    calloutW: Float = CALLOUT_W,
    calloutH: Float = CALLOUT_H,
): Pair<Float, Float> {
    val offset = 16f
    val rawLeft = if (box.x + box.w + offset + calloutW <= cw - 8f) {
        box.x + box.w + offset
    } else {
        box.x - calloutW - offset
    }
    val maxLeft = max(8f, cw - calloutW - 8f)
    val left = max(8f, min(rawLeft, maxLeft))
    val top = max(8f, min(box.y, ch - calloutH - 8f))
    return left to top
}

/** 对应 WebView: utils/calloutUtils.js */
fun getImgDisplayRect(
    imgW: Float,
    imgH: Float,
    natW: Float,
    natH: Float,
    imgTopInset: Float = 12f,
): PixelRect? {
    if (natW <= 0f || natH <= 0f) return null
    val natR = natW / natH
    val imgR = imgW / imgH
    val dispW: Float
    val dispH: Float
    val offX: Float
    val offY: Float
    if (natR > imgR) {
        dispW = imgW
        dispH = imgW / natR
        offX = 0f
        offY = (imgH - dispH) / 2f
    } else {
        dispH = imgH
        dispW = imgH * natR
        offX = (imgW - dispW) / 2f
        offY = 0f
    }
    return PixelRect(
        left = offX,
        top = imgTopInset + offY,
        width = dispW,
        height = dispH,
    )
}

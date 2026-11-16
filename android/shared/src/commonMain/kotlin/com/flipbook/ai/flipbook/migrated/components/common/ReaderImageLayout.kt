package com.flipbook.ai.flipbook.migrated.components.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp

/** 当前图片等比显示后的宽度，仅用于悬浮控件排版，不参与生图。 */
class ReaderImageLayout {
    var width: Dp? by mutableStateOf(null)
}

val LocalReaderImageLayout = staticCompositionLocalOf<ReaderImageLayout?> { null }

/** 翻页时清除前图的测量结果；同页显隐不会改变图片区域。 */
@Composable
fun rememberReaderImageLayout(imageKey: String?): ReaderImageLayout =
    remember(imageKey) { ReaderImageLayout() }

/** 搜索与朗读合计占图片宽度的五分之三，居中后左右各留五分之一。 */
fun phoneReaderControlsWidth(containerWidth: Dp, imageWidth: Dp?): Dp =
    minOf(containerWidth, imageWidth ?: containerWidth) * 0.6f

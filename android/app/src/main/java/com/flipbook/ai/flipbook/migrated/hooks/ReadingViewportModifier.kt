package com.flipbook.ai.flipbook.migrated.hooks

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * 布局变化时记录阅读尺寸，输入法临时缩小窗口时保留正常阅读画幅。
 * @param inputFocused 话题输入框是否获得焦点
 * @param onSizeChanged 正常阅读区域尺寸回调
 * @return 只在布局阶段读取尺寸的修饰符
 */
@Composable
fun Modifier.recordReadingViewport(
    inputFocused: Boolean,
    onSizeChanged: (Int, Int) -> Unit,
): Modifier {
    val view = LocalView.current
    return onGloballyPositioned { coordinates ->
        val keyboardVisible = ViewCompat.getRootWindowInsets(view)
            ?.isVisible(WindowInsetsCompat.Type.ime()) == true
        if (!inputFocused && !keyboardVisible) {
            onSizeChanged(coordinates.size.width, coordinates.size.height)
        }
    }
}

package com.flipbook.ai.flipbook.migrated.components.common

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** 窄屏布局由应用入口提供；平板包保持现有宽屏布局。 */
val LocalCompactLayout = staticCompositionLocalOf { false }

/** 手机阅读控件独立于弹窗的窄屏判断，横屏也保持单行工具栏。 */
val LocalPhoneLayout = staticCompositionLocalOf { false }
// 仅用于悬浮控件之间的对齐，不给图片画布预留底部空间。
val PhoneReaderToolbarHeight = 64.dp
val PhoneReaderToolbarBottomInset = 10.dp

/** 提供跨平台的窗口尺寸策略，业务组件不需要读取 Android 配置。 */
@Composable
fun AppLayout(phone: Boolean, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    BoxWithConstraints(modifier.fillMaxSize()) {
        CompositionLocalProvider(
            LocalCompactLayout provides (phone && maxWidth < 720.dp),
            LocalPhoneLayout provides phone,
        ) {
            content()
        }
    }
}

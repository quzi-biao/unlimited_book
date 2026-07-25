package com.flipbook.ai.flipbook.migrated

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.flipbook.migrated.components.splash.AppSplashScreen
import com.flipbook.ai.flipbook.migrated.utils.initDevice

/**
 * 对应 WebView: legacy-webview-src/main.jsx
 *
 * 启动流程：
 *  1. AppSplashScreen 全屏展示「无限之书」概念图 + 动画进度条（固定 3s）
 *  2. 同时后台执行 initDevice（不阻塞 splash）
 *  3. Splash 结束后切换到 AppScreen
 */
@Composable
fun MainEntry() {
    val appContext = LocalContext.current.applicationContext
    var splashDone by remember { mutableStateOf(false) }

    // 后台初始化（不等待，不阻塞 splash 展示）
    LaunchedEffect(Unit) {
        runCatching { initDevice(appContext) }
    }

    if (!splashDone) {
        AppSplashScreen(onReady = { splashDone = true })
    } else {
        AppScreen()
    }
}

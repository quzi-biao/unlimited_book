package com.flipbook.ai.flipbook.migrated.components.common

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember

/** 用安卓本地存储接入共享引导状态，沿用原来的存储键。 */
@Composable
fun rememberGuideController(context: Context): GuideController = remember(context) {
    val prefs = context.applicationContext.getSharedPreferences("onboarding_prefs", Context.MODE_PRIVATE)
    GuideController(prefs.getBoolean("complete", false)) { complete ->
        prefs.edit().putBoolean("complete", complete).apply()
    }
}

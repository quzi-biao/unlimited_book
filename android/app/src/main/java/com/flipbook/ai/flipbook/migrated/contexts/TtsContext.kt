package com.flipbook.ai.flipbook.migrated.contexts

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember

data class TtsMeta(
    val pageId: String? = null,
    val bookTitle: String? = null,
    val pageTitle: String? = null,
)

@Stable
data class TtsState(
    val pageState: String = "idle",
    val annState: String = "idle",
    val annSourceId: String? = null,
    val pageRate: Float = 1f,
    val annRate: Float = 1f,
    val pageMeta: TtsMeta? = null,
    val annMeta: TtsMeta? = null,
)

val LocalTtsState = compositionLocalOf { TtsState() }

@Composable
fun rememberTtsState(): TtsState = remember { TtsState() }

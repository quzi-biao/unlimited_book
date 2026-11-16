package com.flipbook.ai.flipbook.migrated.components.toolbar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** 每个阅读控件独立使用胶囊背景和边框，分组容器保持透明。 */
internal fun Modifier.phoneHeaderChrome(): Modifier =
    clip(CircleShape).background(Color(0xDD202638))
        .border(1.dp, Color(0x2EF0C060), CircleShape)

package com.flipbook.ai.flipbook.migrated.components.annotations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.db.AnnotationRecord
import com.flipbook.ai.flipbook.migrated.hooks.rememberAnnotationsState
import kotlin.math.roundToInt

/** 对应 WebView: components/Annotations/AnnotationLayer.jsx */
@Composable
fun AnnotationLayer(
    pageId: String?,
    hasCurrent: Boolean,
    onDeepExplore: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    if (!hasCurrent || pageId.isNullOrBlank()) return
    val state = rememberAnnotationsState(pageId = pageId, bookId = null)
    val active = remember { mutableStateOf<AnnotationRecord?>(null) }
    val density = LocalDensity.current

    Box(modifier = modifier.fillMaxSize()) {
        state.annotations.forEach { ann ->
            with(density) {
                val x = (ann.x * 1000f).dp.roundToPx()
                val y = (ann.y * 700f).dp.roundToPx()
                Box(
                    modifier = Modifier
                        .offset { IntOffset(x, y) }
                        .size(14.dp)
                        .background(
                            if (active.value?.id == ann.id) Color(0xFF6366F1) else Color(0xE6FFFFFF),
                            CircleShape,
                        )
                        .clickable { active.value = if (active.value?.id == ann.id) null else ann },
                )
            }
        }

        active.value?.let { ann ->
            AnnotationCallout(
                annotations = listOf(ann),
                activeIdx = 0,
                onTabChange = {},
                pending = false,
                onClose = { active.value = null },
                onDeepExplore = onDeepExplore,
                modifier = Modifier
                    .offset(x = 20.dp, y = 20.dp),
            )
        }
    }
}

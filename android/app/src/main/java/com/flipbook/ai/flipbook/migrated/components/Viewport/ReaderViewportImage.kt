package com.flipbook.ai.flipbook.migrated.components.viewport

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import com.flipbook.ai.flipbook.migrated.components.common.LocalReaderImageLayout

/** 复用正在显示的图片尺寸，让底栏跟随等比适配画幅，不重复加载图片。 */
@Composable
internal fun ReaderViewportImage(
    model: String,
    contentDescription: String?,
    onSuccess: (AsyncImagePainter.State.Success) -> Unit,
    modifier: Modifier = Modifier,
) {
    val layout = LocalReaderImageLayout.current
    val density = LocalDensity.current
    var naturalSize by remember(model) { mutableStateOf(Size.Zero) }
    var containerSize by remember { mutableStateOf(IntSize.Zero) }
    LaunchedEffect(layout, naturalSize, containerSize, density) {
        layout?.width = if (naturalSize.width > 0f && naturalSize.height > 0f &&
            containerSize.width > 0 && containerSize.height > 0) {
            val width = minOf(containerSize.width.toFloat(), containerSize.height * naturalSize.width / naturalSize.height)
            with(density) { width.toDp() }
        } else null
    }
    AsyncImage(
        model = model, contentDescription = contentDescription,
        onSuccess = { naturalSize = it.painter.intrinsicSize; onSuccess(it) },
        onError = { naturalSize = Size.Zero },
        modifier = modifier.onSizeChanged { containerSize = it },
    )
}

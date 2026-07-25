package com.flipbook.ai.flipbook.migrated.components.cachedimg

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import com.flipbook.ai.flipbook.migrated.hooks.rememberImageSrc
import coil.compose.AsyncImage

/**
 * 对应 WebView: components/CachedImg/CachedImg.jsx
 * 使用 rememberImageSrc，对齐 Web 版 useImageSrc 的本地优先加载路径。
 */
@Composable
fun CachedImg(
    src: String,
    alt: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
) {
    val displaySrc = rememberImageSrc(src)
    AsyncImage(
        model = displaySrc,
        contentDescription = alt,
        contentScale = contentScale,
        modifier = modifier,
    )
}

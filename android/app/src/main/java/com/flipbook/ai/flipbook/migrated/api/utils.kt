package com.flipbook.ai.flipbook.migrated.api

import android.content.Context
import coil.ImageLoader
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/** 对应 WebView: api/utils.js */
suspend fun preloadImg(context: Context, imageLoader: ImageLoader, url: String) = withContext(Dispatchers.IO) {
    val request = ImageRequest.Builder(context)
        .data(url)
        .allowHardware(false)
        .build()
    imageLoader.execute(request)
}

/** 对应 WebView: api/utils.js */
suspend fun sleep(ms: Long) {
    delay(ms)
}

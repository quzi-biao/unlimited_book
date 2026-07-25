package com.flipbook.ai.flipbook.migrated.api

import android.content.Context
import coil.ImageLoader

/** 对应 WebView: api/flipbook.js */
object FlipbookApi {
    suspend fun preloadImg(context: Context, imageLoader: ImageLoader, url: String) {
        com.flipbook.ai.flipbook.migrated.api.preloadImg(context, imageLoader, url)
    }

    suspend fun sleep(ms: Long) {
        com.flipbook.ai.flipbook.migrated.api.sleep(ms)
    }
}

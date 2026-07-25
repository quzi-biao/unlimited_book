package com.flipbook.ai.flipbook.migrated.hooks

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.flipbook.migrated.utils.cacheFromNetwork
import com.flipbook.ai.flipbook.migrated.utils.getLocalImageUri
import com.flipbook.ai.flipbook.migrated.utils.ossUrl

/** 对应 WebView: hooks/useImageSrc.js */
@Composable
fun rememberImageSrc(imageUrl: String?): String {
    val context = LocalContext.current.applicationContext
    var src by remember(imageUrl) { mutableStateOf(ossUrl(imageUrl)) }

    LaunchedEffect(context, imageUrl) {
        if (imageUrl.isNullOrBlank()) {
            src = ""
            return@LaunchedEffect
        }

        val local = getLocalImageUri(context, imageUrl)
        if (!local.isNullOrBlank()) {
            src = local
            return@LaunchedEffect
        }

        src = ossUrl(imageUrl)

        cacheFromNetwork(context, imageUrl)
        val afterCache = getLocalImageUri(context, imageUrl)
        if (!afterCache.isNullOrBlank()) {
            src = afterCache
        }
    }
    return src
}

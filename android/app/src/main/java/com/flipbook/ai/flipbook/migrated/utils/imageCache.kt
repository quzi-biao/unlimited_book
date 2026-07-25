package com.flipbook.ai.flipbook.migrated.utils

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

private const val CACHE_DIR = "flipbook-images"
private val http by lazy {
    OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .build()
}

/** 对应 WebView: utils/imageCache.js */
fun urlToFilename(imageUrl: String): String {
    val last = imageUrl.substringAfterLast('/').substringBefore('?')
    if (last.length >= 4 && Regex("^[a-zA-Z0-9._-]+$").matches(last)) return last
    return imageUrl.replace(Regex("[^a-zA-Z0-9]"), "_").takeLast(120) + ".img"
}

/** 对应 WebView: utils/imageCache.js */
suspend fun setLocalImage(context: Context, imageUrl: String, bytes: ByteArray) = withContext(Dispatchers.IO) {
    val dir = File(context.filesDir, CACHE_DIR)
    if (!dir.exists()) dir.mkdirs()
    val file = File(dir, urlToFilename(imageUrl))
    file.writeBytes(bytes)
}

/** 对应 WebView: utils/imageCache.js */
suspend fun getLocalImageUri(context: Context, imageUrl: String?): String? = withContext(Dispatchers.IO) {
    if (imageUrl.isNullOrBlank()) return@withContext null
    val file = File(File(context.filesDir, CACHE_DIR), urlToFilename(imageUrl))
    if (!file.exists()) return@withContext null
    Uri.fromFile(file).toString()
}

/** 补齐 JS 逻辑中的“OSS 命中后写本地缓存” */
suspend fun cacheFromNetwork(context: Context, imageUrl: String): Result<Unit> = withContext(Dispatchers.IO) {
    runCatching {
        val req = Request.Builder().url(imageUrl).build()
        http.newCall(req).execute().use { res ->
            if (!res.isSuccessful) throw IOException("下载失败: ${res.code}")
            val body = res.body?.bytes() ?: throw IOException("下载结果为空")
            setLocalImage(context, imageUrl, body)
        }
    }
}

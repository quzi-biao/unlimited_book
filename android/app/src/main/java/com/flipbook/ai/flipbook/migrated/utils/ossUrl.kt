package com.flipbook.ai.flipbook.migrated.utils

/** 对应 WebView: utils/ossUrl.js */
fun ossUrl(url: String?): String {
    if (url.isNullOrBlank()) return ""
    if (!url.contains("oss-cn")) return url

    val filename = url.substringAfterLast('/').substringBefore('?')
    val token = filename.replace(Regex("[^a-zA-Z0-9]"), "").takeLast(8).ifBlank { "1" }
    return url.substringBefore('?') + "?v=$token"
}

package com.flipbook.ai.flipbook.migrated

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.speech.tts.TextToSpeech
import android.util.Base64
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.flipbook.ai.BuildConfig
import com.flipbook.ai.flipbook.migrated.utils.getDeviceFingerprint
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.util.Locale

private const val READER_ORIGIN = "https://appassets.androidplatform.net"

/** 手机和平板共用随 APK 打包的知识树，不依赖在线网页启动。 */
@Composable
fun KnowledgeScreen() {
    val context = LocalContext.current
    var fingerprint by remember { mutableStateOf<String?>(null) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var geoRequest by remember { mutableStateOf<Pair<String, GeolocationPermissions.Callback>?>(null) }
    val locationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        geoRequest?.let { (origin, callback) -> callback.invoke(origin, granted, false) }
        geoRequest = null
    }
    val bridge = remember { KnowledgeBridge(context as Activity) }
    LaunchedEffect(Unit) { fingerprint = getDeviceFingerprint(context) }
    DisposableEffect(Unit) { onDispose { webView?.destroy(); bridge.close() } }
    if (fingerprint == null) return
    val identity = JSONObject().put("platform", "android").put("fingerprint", fingerprint)
        .put("apiBase", BuildConfig.API_BASE_URL.trimEnd('/')).put("bundled", true)
        .put("appVersion", "android-${BuildConfig.VERSION_NAME}").put("osVersion", "Android ${Build.VERSION.RELEASE}").toString()

    AndroidView(modifier = Modifier.fillMaxSize(), factory = { ctx ->
        WebView(ctx).apply {
            webView = this
            setBackgroundColor(android.graphics.Color.rgb(16, 27, 29))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mediaPlaybackRequiresUserGesture = false
            // 本地开发 API 可为 HTTP；正式构建仍只允许 HTTPS 混合内容策略。
            if (BuildConfig.DEBUG) settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            addJavascriptInterface(bridge, "KnowledgeNative")
            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                    if (!origin.startsWith(READER_ORIGIN)) { callback.invoke(origin, false, false); return }
                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                        callback.invoke(origin, true, false)
                    } else {
                        geoRequest = origin to callback
                        locationPermission.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                    }
                }
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.url.scheme != "https" || request.url.host != "appassets.androidplatform.net"

                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    if (request.url.host != "appassets.androidplatform.net") return null
                    val path = request.url.path.orEmpty().trimStart('/').ifBlank { "index.html" }
                    if (path.split('/').any { it == ".." } || path.contains('\\')) return missing()
                    return runCatching {
                        if (path == "index.html") {
                            val html = context.assets.open("knowledge-reader/index.html").bufferedReader().readText()
                            val injected = html.replace("<head>", "<head><script>Object.defineProperty(window,'unlimitedBookNative',{value:Object.freeze($identity)});</script>")
                            WebResourceResponse("text/html", "UTF-8", ByteArrayInputStream(injected.toByteArray()))
                        } else {
                            val mime = when (path.substringAfterLast('.')) {
                                "js" -> "application/javascript"
                                "css" -> "text/css"
                                "svg" -> "image/svg+xml"
                                "png" -> "image/png"
                                "woff2" -> "font/woff2"
                                "woff" -> "font/woff"
                                "ttf" -> "font/ttf"
                                else -> "application/octet-stream"
                            }
                            WebResourceResponse(mime, "UTF-8", context.assets.open("knowledge-reader/$path"))
                        }
                    }.getOrElse { missing() }
                }
            }
            loadUrl("$READER_ORIGIN/index.html")
        }
    })
}

/** 缺失本地资源返回明确 404，不导航到外部站点。 */
private fun missing() = WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(byteArrayOf()))

/** 仅可信打包页面可访问的朗读与文件导出桥，无执行命令或任意文件读取能力。 */
private class KnowledgeBridge(private val activity: Activity) {
    private var ready = false
    private val speech = TextToSpeech(activity) { status -> ready = status == TextToSpeech.SUCCESS }

    /** 使用系统语音阅读已保存文本。 */
    @JavascriptInterface fun speak(text: String, language: String) {
        if (!ready || text.length > 20000) return
        activity.runOnUiThread {
            speech.language = if (language == "en") Locale.US else Locale.SIMPLIFIED_CHINESE
            speech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "knowledge-node")
        }
    }

    /** 在应用缓存目录创建导出切片，通过系统分享面板交给用户。 */
    @JavascriptInterface fun saveFile(filename: String, mime: String, encoded: String) {
        if (encoded.length > 40_000_000 || mime !in listOf("application/json", "text/html;charset=utf-8", "application/pdf")) return
        val safeName = filename.replace(Regex("[\\\\/:*?\"<>|]"), "_").take(120)
        if (safeName.isBlank()) return
        runCatching {
            val directory = File(activity.cacheDir, "knowledge-exports").apply { mkdirs() }
            val file = File(directory, safeName)
            file.writeBytes(Base64.decode(encoded, Base64.DEFAULT))
            val uri = FileProvider.getUriForFile(activity, "${BuildConfig.APPLICATION_ID}.fileprovider", file)
            activity.runOnUiThread {
                val intent = Intent(Intent.ACTION_SEND).setType(mime.substringBefore(';')).putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                activity.startActivity(Intent.createChooser(intent, "带走这份知识"))
            }
        }
    }

    /** 离开阅读器时释放系统朗读资源。 */
    fun close() { speech.stop(); speech.shutdown() }
}

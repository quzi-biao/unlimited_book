package com.flipbook.ai.flipbook.migrated.api

import android.content.Context
import com.flipbook.ai.BuildConfig
import com.flipbook.ai.flipbook.migrated.db.AnnotationRecord
import com.flipbook.ai.flipbook.migrated.db.BookRecord
import com.flipbook.ai.flipbook.migrated.utils.getInstalledAppVersion
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

data class SelectionRegion(
    val x: Float = 0f,
    val y: Float = 0f,
    val w: Float = 0f,
    val h: Float = 0f,
)

data class PageNode(
    val id: String,
    val parentPageId: String? = null,
    val imageUrl: String? = null,
    val prompt: String? = null,
    val title: String? = null,
    @SerializedName(value = "pageTitle", alternate = ["page_title"])
    val pageTitle: String? = null,
    @SerializedName(value = "name", alternate = ["pageName", "page_name"])
    val name: String? = null,
    val selectionRegion: SelectionRegion? = null,
    val children: List<PageNode> = emptyList(),
)

data class BooksListResponse(
    val books: List<BookRecord> = emptyList(),
)

data class BookPagesResponse(
    val tree: List<PageNode> = emptyList(),
)

data class RandomTopicsResponse(
    val topics: List<String> = emptyList(),
)

data class AnnotationsListResponse(
    val annotations: List<AnnotationRecord> = emptyList(),
)

private object HttpCore {
    val gson = Gson()
    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .writeTimeout(40, TimeUnit.SECONDS)
        .build()
    val longClient: OkHttpClient = client.newBuilder()
        .readTimeout(600, TimeUnit.SECONDS)
        .writeTimeout(600, TimeUnit.SECONDS)
        .build()
    val jsonType = "application/json; charset=utf-8".toMediaType()
    val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/') + "/api"
}

private fun deviceToken(context: Context): String? {
    return context.getSharedPreferences("device_auth", Context.MODE_PRIVATE).getString("device_token", null)
        ?: context.getSharedPreferences("flipbook_store", Context.MODE_PRIVATE).getString("device_token", null)
}

private suspend fun requestRaw(
    context: Context,
    path: String,
    method: String = "GET",
    body: Any? = null,
    longTimeout: Boolean = false,
): String = withContext(Dispatchers.IO) {
    val token = deviceToken(context)
    val reqBuilder = Request.Builder().url(HttpCore.baseUrl + path)
    if (!token.isNullOrBlank()) reqBuilder.header("Authorization", "Bearer $token")
    reqBuilder.header("Content-Type", "application/json")
    val bodyObj = if (body == null) null else HttpCore.gson.toJson(body).toRequestBody(HttpCore.jsonType)
    reqBuilder.method(method, if (method == "GET" || method == "DELETE") null else (bodyObj ?: "{}".toRequestBody(HttpCore.jsonType)))
    if ((method == "DELETE") && bodyObj != null) reqBuilder.method(method, bodyObj)

    val client = if (longTimeout) HttpCore.longClient else HttpCore.client
    client.newCall(reqBuilder.build()).execute().use { res ->
        if (res.code == 204) return@withContext "{}"
        val text = res.body?.string().orEmpty()
        if (!res.isSuccessful) {
            val msg = runCatching {
                HttpCore.gson.fromJson(text, JsonObject::class.java)?.get("error")?.asString
            }.getOrNull()
            throw IOException(msg ?: "请求失败 (${res.code})")
        }
        return@withContext text
    }
}

private suspend inline fun <reified T> request(
    context: Context,
    path: String,
    method: String = "GET",
    body: Any? = null,
    longTimeout: Boolean = false,
): T {
    val text = requestRaw(context = context, path = path, method = method, body = body, longTimeout = longTimeout)
    return HttpCore.gson.fromJson(text, object : TypeToken<T>() {}.type)
}

private suspend fun requestJsonOrCachedFalse(
    context: Context,
    path: String,
): JsonObject {
    return runCatching { requestRaw(context = context, path = path) }
        .mapCatching { text -> HttpCore.gson.fromJson(text, JsonObject::class.java) ?: JsonObject() }
        .getOrElse {
            JsonObject().apply { addProperty("cached", false) }
        }
}

private suspend fun fetchResponse(
    context: Context,
    path: String,
    method: String = "GET",
    body: Any? = null,
): Response = withContext(Dispatchers.IO) {
    val token = deviceToken(context)
    val reqBuilder = Request.Builder().url(HttpCore.baseUrl + path)
    if (!token.isNullOrBlank()) reqBuilder.header("Authorization", "Bearer $token")
    if (body != null) reqBuilder.header("Content-Type", "application/json")
    val bodyObj = body?.let { HttpCore.gson.toJson(it).toRequestBody(HttpCore.jsonType) }
    reqBuilder.method(method, if (method == "GET") null else bodyObj)
    HttpCore.client.newCall(reqBuilder.build()).execute()
}

/** 对应 WebView: api/client.js */
object deviceApi {
    suspend fun register(context: Context, body: Map<String, Any?>): JsonObject =
        request(context, "/device/register", "POST", body)

    suspend fun heartbeat(context: Context): JsonObject {
        val appVersion = context.applicationContext.getInstalledAppVersion().versionName
        return request(context, "/device/heartbeat", "POST", mapOf("appVersion" to appVersion))
    }

    suspend fun info(context: Context): JsonObject =
        request(context, "/device/info")

    /** 恢复出厂设置：删除该设备在云端的所有书本及级联数据（pages / annotations / explanations） */
    suspend fun factoryReset(context: Context): JsonObject =
        request(context, "/device/factory-reset", "POST", emptyMap<String, Any>())
}


object otaApi {
    suspend fun downloadApk(url: String, onProgress: (Int) -> Unit): ByteArray = withContext(Dispatchers.IO) {
        val req = Request.Builder().url(url).build()
        HttpCore.client.newCall(req).execute().use { res ->
            if (!res.isSuccessful) throw IOException("APK 下载失败 (${res.code})")
            val body = res.body ?: throw IOException("APK 内容为空")
            val total = body.contentLength()
            body.byteStream().use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                var read: Int
                var received = 0L
                while (input.read(buffer).also { read = it } >= 0) {
                    if (read == 0) continue
                    out.write(buffer, 0, read)
                    received += read
                    if (total > 0L) {
                        onProgress(((received * 100) / total).toInt().coerceIn(0, 100))
                    }
                }
                onProgress(100)
                out.toByteArray()
            }
        }
    }
}

/** 对应 WebView: api/client.js */
object booksApi {
    /** 查询已有书和预生成首层状态，不触发模型调用。 */
    suspend fun topic(context: Context, query: String): JsonObject =
        request(context, "/books/topic?query=" + java.net.URLEncoder.encode(query, "UTF-8"))

    suspend fun list(context: Context): BooksListResponse =
        request(context, "/books")

    suspend fun get(context: Context, id: String): JsonObject =
        request(context, "/books/$id")

    suspend fun create(context: Context, body: Map<String, Any?>): JsonObject =
        request(context, "/books", "POST", body)

    suspend fun update(context: Context, id: String, body: Map<String, Any?>): JsonObject =
        request(context, "/books/$id", "PATCH", body)

    suspend fun remove(context: Context, id: String): JsonObject =
        request(context, "/books/$id", "DELETE")

    suspend fun pages(context: Context, bookId: String): BookPagesResponse =
        request(context, "/books/$bookId/pages")
}

/** 对应 WebView: api/client.js */
object pagesApi {
    suspend fun get(context: Context, id: String): JsonObject = request(context, "/pages/$id")
    suspend fun create(context: Context, bookId: String, body: Map<String, Any?>): JsonObject =
        request(context, "/books/$bookId/pages", "POST", body)
    suspend fun checkCache(context: Context, promptHash: String): JsonObject =
        request(context, "/pages/cache/$promptHash")
    suspend fun rename(context: Context, id: String, title: String): JsonObject =
        request(context, "/pages/$id", "PATCH", mapOf("title" to title))
    suspend fun remove(context: Context, id: String): JsonObject =
        request(context, "/pages/$id", "DELETE")
    suspend fun refreshTitle(context: Context, id: String): JsonObject =
        request(context, "/pages/$id/refresh-title", "POST", emptyMap<String, Any>())
    suspend fun explanation(context: Context, pageId: String, lang: String = "zh"): JsonObject =
        request(context, "/pages/$pageId/explanation?lang=$lang")
}

/** 对应 WebView: api/client.js */
object aiApi {
    suspend fun generateImage(context: Context, body: Map<String, Any?>): JsonObject =
        request(context, "/ai/generate-image", "POST", body, longTimeout = true)
    suspend fun identifyRegion(context: Context, imageBase64: String): JsonObject =
        request(context, "/ai/identify-region", "POST", mapOf("imageBase64" to imageBase64))
    suspend fun expandRegion(context: Context, body: Map<String, Any?>): JsonObject =
        request(context, "/ai/expand-region", "POST", body, longTimeout = true)
    suspend fun explainSpot(context: Context, body: Map<String, Any?>): JsonObject =
        request(context, "/ai/explain-spot", "POST", body)
    suspend fun explainRegion(context: Context, body: Map<String, Any?>): JsonObject =
        request(context, "/ai/explain-region", "POST", body)
    suspend fun cropRegion(context: Context, body: Map<String, Any?>): JsonObject =
        request(context, "/ai/crop-region", "POST", body)
    suspend fun generateTitle(context: Context, explanation: String): JsonObject =
        request(context, "/ai/generate-title", "POST", mapOf("explanation" to explanation))
    suspend fun randomTopics(context: Context): RandomTopicsResponse =
        request(context, "/ai/random-topics?t=${System.currentTimeMillis()}")
}

/** 对应 WebView: api/client.js */
object annotationsApi {
    suspend fun list(context: Context, pageId: String): List<AnnotationRecord> =
        request<AnnotationsListResponse>(context, "/pages/$pageId/annotations").annotations
    suspend fun create(context: Context, pageId: String, body: Map<String, Any?>): JsonObject =
        request(context, "/pages/$pageId/annotations", "POST", body)
    suspend fun update(context: Context, pageId: String, id: String, body: Map<String, Any?>): JsonObject =
        request(context, "/pages/$pageId/annotations/$id", "PATCH", body)
    suspend fun remove(context: Context, id: String): JsonObject =
        request(context, "/annotations/$id", "DELETE")
}

/** 对应 WebView: api/client.js */
object promptsApi {
    suspend fun list(context: Context): JsonObject = request(context, "/prompts")
    suspend fun get(context: Context, key: String): JsonObject = request(context, "/prompts/$key")
    suspend fun set(context: Context, key: String, value: String): JsonObject =
        request(context, "/prompts/$key", "PUT", mapOf("value" to value))
    suspend fun remove(context: Context, key: String): JsonObject = request(context, "/prompts/$key", "DELETE")
}

/** 对应 WebView: api/client.js */
object ttsApi {
    suspend fun checkPageCache(context: Context, pageId: String, lang: String = "zh"): JsonObject =
        requestJsonOrCachedFalse(context, "/tts/page/$pageId?lang=$lang")
    suspend fun fetchPageAudio(context: Context, pageId: String, lang: String = "zh", triggerOnly: Boolean = false): Response =
        fetchResponse(context, "/tts/page/$pageId?lang=$lang${if (triggerOnly) "&triggerOnly=1" else ""}", "POST", emptyMap<String, Any>())
    suspend fun checkAnnotationCache(context: Context, annotationId: String): JsonObject =
        requestJsonOrCachedFalse(context, "/tts/annotation/$annotationId")
    suspend fun fetchAnnotationAudio(context: Context, annotationId: String, triggerOnly: Boolean = false): Response =
        fetchResponse(context, "/tts/annotation/$annotationId${if (triggerOnly) "?triggerOnly=1" else ""}", "POST", emptyMap<String, Any>())
    suspend fun fetchTextAudio(context: Context, text: String): Response =
        fetchResponse(context, "/tts", "POST", mapOf("text" to text))
}

/** 对应 WebView: api/client.js */
object voicesApi {
    suspend fun list(context: Context): JsonObject = request(context, "/device/voices")
    suspend fun setVoice(context: Context, voiceId: String): JsonObject =
        request(context, "/device/settings/voice", "PATCH", mapOf("voiceId" to voiceId))
    suspend fun preview(context: Context, voiceId: String): JsonObject =
        request(context, "/device/voices/${java.net.URLEncoder.encode(voiceId, Charsets.UTF_8.name())}/preview")
}

/** 对应 WebView: api/client.js */
object promptStylesApi {
    suspend fun getPromptStyles(context: Context): JsonObject = request(context, "/device/prompt-styles")
    suspend fun setStyle(context: Context, promptStyleId: String): JsonObject =
        request(context, "/device/settings/prompt-style", "PATCH", mapOf("promptStyleId" to promptStyleId))
}

/** 对应 WebView: api/client.js */
object topicsApi {
    suspend fun getCategories(context: Context): JsonObject = request(context, "/device/topic-categories")
}

/** 对应 WebView: api/client.js */
object walletApi {
    suspend fun info(context: Context): JsonObject = request(context, "/device/wallet")
}

/** 对应 WebView: api/client.js */
object plansApi {
    suspend fun list(context: Context): JsonObject = request(context, "/device/plans")
}

/** 对应 WebView: api/client.js */
object paymentApi {
    suspend fun create(context: Context, planId: String): JsonObject =
        request(context, "/device/payment/create", "POST", mapOf("planId" to planId))
    suspend fun direct(context: Context, amountYuan: Number): JsonObject =
        request(context, "/device/payment/direct", "POST", mapOf("amountYuan" to amountYuan))
    suspend fun poll(context: Context, orderId: String): JsonObject =
        request(context, "/device/payment/order/$orderId")
    suspend fun cancel(context: Context, orderId: String): JsonObject =
        request(context, "/device/payment/cancel/$orderId", "POST", emptyMap<String, Any>())
    suspend fun reopen(context: Context, orderId: String): JsonObject =
        request(context, "/device/payment/reopen/$orderId", "POST", emptyMap<String, Any>())
    suspend fun history(context: Context): JsonObject =
        request(context, "/device/payment/history")
}

/** 对应 WebView: api/client.js */
object ticketsApi {
    suspend fun create(context: Context, content: String): JsonObject =
        request(context, "/tickets", "POST", mapOf("content" to content))
}

/** 对应 WebView: api/client.js */
object agreementsApi {
    suspend fun get(context: Context, name: String): JsonObject =
        request(context, "/agreements/$name")
}

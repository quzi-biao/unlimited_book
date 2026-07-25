package com.flipbook.ai.flipbook.migrated.utils

import android.content.Context
import android.os.Build
import com.flipbook.ai.flipbook.migrated.api.deviceApi
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val PREF = "device_auth"
private const val TOKEN_KEY = "device_token"
private const val DEVICE_KEY = "device_info"

data class DeviceInfo(
    val id: String? = null,
    val deviceCode: String? = null,
    val balance: Int = 0,
)

/** 对应 WebView: utils/deviceAuth.js */
suspend fun getDeviceToken(context: Context): String? = withContext(Dispatchers.IO) {
    context.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(TOKEN_KEY, null)
}

/** 对应 WebView: utils/deviceAuth.js */
suspend fun getDeviceInfo(context: Context): DeviceInfo? = withContext(Dispatchers.IO) {
    val raw = context.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(DEVICE_KEY, null)
    if (raw.isNullOrBlank()) return@withContext null
    return@withContext runCatching {
        val json = com.google.gson.Gson().fromJson(raw, JsonObject::class.java)
        DeviceInfo(
            id = json.get("id")?.asString,
            deviceCode = json.get("deviceCode")?.asString,
            balance = json.get("balance")?.asInt ?: 0,
        )
    }.getOrNull()
}

/** 对应 WebView: utils/deviceAuth.js */
suspend fun initDevice(context: Context): DeviceInfo {
    val appContext = context.applicationContext
    val fingerprint = getDeviceFingerprint(appContext)
    val appVersion = appContext.getInstalledAppVersion().versionName
    val model = "${Build.MANUFACTURER.orEmpty()} ${Build.MODEL.orEmpty()}".trim()
    val osVersion = "android ${Build.VERSION.RELEASE.orEmpty()}"

    val res = deviceApi.register(
        context = appContext,
        body = mapOf(
            "fingerprint" to fingerprint,
            "appVersion" to appVersion,
            "deviceModel" to model,
            "osVersion" to osVersion,
        ),
    )

    val token = res.get("token")?.asString.orEmpty()
    val deviceObj = res.getAsJsonObject("device") ?: JsonObject()

    val info = DeviceInfo(
        id = deviceObj.get("id")?.asString,
        deviceCode = deviceObj.get("deviceCode")?.asString,
        balance = deviceObj.get("balance")?.asInt ?: 0,
    )

    withContext(Dispatchers.IO) {
        appContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            .edit()
            .putString(TOKEN_KEY, token)
            .putString(DEVICE_KEY, deviceObj.toString())
            .apply()

        // 兼容旧代码读取路径
        appContext.getSharedPreferences("flipbook_store", Context.MODE_PRIVATE)
            .edit()
            .putString(TOKEN_KEY, token)
            .apply()
    }

    return info
}

/** 对应 WebView: utils/deviceAuth.js */
suspend fun clearDeviceAuth(context: Context) = withContext(Dispatchers.IO) {
    val appContext = context.applicationContext
    appContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        .edit()
        .remove(TOKEN_KEY)
        .remove(DEVICE_KEY)
        .apply()
    appContext.getSharedPreferences("flipbook_store", Context.MODE_PRIVATE)
        .edit()
        .remove(TOKEN_KEY)
        .apply()
}

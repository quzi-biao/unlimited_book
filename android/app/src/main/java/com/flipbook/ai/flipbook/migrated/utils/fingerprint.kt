package com.flipbook.ai.flipbook.migrated.utils

import android.content.Context
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

private const val PREF = "device_auth"
private const val KEY = "device_fingerprint"

/** 对应 WebView: utils/fingerprint.js */
suspend fun getDeviceFingerprint(context: Context): String = withContext(Dispatchers.IO) {
    val prefs = context.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)
    val cached = prefs.getString(KEY, null)
    if (!cached.isNullOrBlank()) return@withContext cached

    val androidId = runCatching {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    }.getOrNull().orEmpty()

    val fingerprint = if (androidId.isNotBlank() && androidId != "9774d56d682e549c") {
        androidId
    } else {
        UUID.randomUUID().toString()
    }

    prefs.edit().putString(KEY, fingerprint).apply()
    return@withContext fingerprint
}

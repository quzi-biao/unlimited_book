package com.flipbook.ai.flipbook.migrated.utils

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings

/** 普通手机应用通过系统面板管理网络，无需 WiFi 扫描或位置权限。 */
fun openPhoneNetworkSettings(context: Context) {
    val action = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        Settings.Panel.ACTION_INTERNET_CONNECTIVITY
    } else Settings.ACTION_WIRELESS_SETTINGS
    runCatching { context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        .onFailure {
            runCatching { context.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
}

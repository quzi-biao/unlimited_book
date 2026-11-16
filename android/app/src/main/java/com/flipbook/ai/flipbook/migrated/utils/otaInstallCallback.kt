package com.flipbook.ai.flipbook.migrated.utils

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.flipbook.ai.AppUpdateReceiver

/** 系统需填入安装结果，因此使用显式、可变且按安装会话隔离的回调。 */
internal fun createInstallStatusCallback(context: Context, sessionId: Int): PendingIntent {
    val intent = Intent(context, AppUpdateReceiver::class.java).apply {
        action = AppUpdateReceiver.ACTION_INSTALL_COMPLETE
        addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
    }
    val mutableFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    return PendingIntent.getBroadcast(context, sessionId, intent, PendingIntent.FLAG_UPDATE_CURRENT or mutableFlag)
}

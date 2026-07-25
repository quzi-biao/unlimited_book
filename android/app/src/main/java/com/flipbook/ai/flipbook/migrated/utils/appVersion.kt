package com.flipbook.ai.flipbook.migrated.utils

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

data class InstalledAppVersion(
    val versionCode: Long,
    val versionName: String,
)

fun Context.getInstalledAppVersion(): InstalledAppVersion {
    val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
    } else {
        @Suppress("DEPRECATION")
        packageManager.getPackageInfo(packageName, 0)
    }

    val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.longVersionCode
    } else {
        @Suppress("DEPRECATION")
        packageInfo.versionCode.toLong()
    }
    val versionName = packageInfo.versionName?.takeIf { it.isNotBlank() } ?: "1.0.$versionCode"
    return InstalledAppVersion(versionCode = versionCode, versionName = versionName)
}

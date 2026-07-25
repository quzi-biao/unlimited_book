package com.flipbook.ai.flipbook.migrated.hooks

import android.app.Activity
import android.app.PendingIntent
import android.app.WallpaperManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Environment
import android.util.DisplayMetrics
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import com.flipbook.ai.AppUpdateReceiver
import com.flipbook.ai.BuildConfig
import com.flipbook.ai.KioskAdminReceiver
import com.flipbook.ai.flipbook.migrated.api.deviceApi
import com.flipbook.ai.flipbook.migrated.api.otaApi
import com.flipbook.ai.flipbook.migrated.components.otaupdate.OtaBadgeState
import com.flipbook.ai.flipbook.migrated.components.otaupdate.OtaUpdateInfo
import com.flipbook.ai.flipbook.migrated.utils.getInstalledAppVersion
import com.google.gson.JsonObject
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 对应 WebView: hooks/useOtaUpdate.js */
class OtaUpdateState
internal constructor(
        private val context: Context,
        private val scope: CoroutineScope,
) {
    var badgeState by mutableStateOf(OtaBadgeState(update = null))
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    private var downloadedFile by mutableStateOf<File?>(null)

    fun check() {
        if (loading) return
        scope.launch {
            loading = true
            error = null
            runCatching { deviceApi.info(context) }
                    .onSuccess { json ->
                        val latest = parseLatestVersion(json)
                        val installedVersionCode = context.getInstalledAppVersion().versionCode
                        badgeState =
                                if (latest != null &&
                                                latest.versionCode.toLong() > installedVersionCode
                                ) {
                                    OtaBadgeState(update = latest, phase = "idle", progress = 0)
                                } else {
                                    OtaBadgeState(update = null)
                                }
                    }
                    .onFailure { err -> error = err.message }
            loading = false
        }
    }

    fun startUpdate() {
        val update = badgeState.update ?: return
        val phase = badgeState.phase
        if (phase == "downloading" || phase == "installing") return
        scope.launch {
            error = null
            downloadedFile = null
            badgeState = badgeState.copy(phase = "downloading", progress = 0)
            runCatching {
                val apk =
                        otaApi.downloadApk(update.apkUrl) { progress: Int ->
                            badgeState = badgeState.copy(phase = "downloading", progress = progress)
                        }
                val file = writeApk(update, apk)
                downloadedFile = file
                badgeState = badgeState.copy(phase = "installing", progress = 100)
                // 使用 PackageInstaller.Session 安装，安装完成后立即回调，最小化桌面停留时间
                installViaSession(file)
            }
                    .onFailure { err ->
                        error = err.message
                        badgeState = badgeState.copy(phase = "error")
                    }
        }
    }

    fun restartInstaller() {
        val file = downloadedFile
        if (file != null && file.exists()) {
            scope.launch { installViaSession(file) }
        } else {
            startUpdate()
        }
    }

    private fun writeApk(update: OtaUpdateInfo, bytes: ByteArray): File {
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
        if (!dir.exists()) dir.mkdirs()
        val safeVersion = update.versionName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val file = File(dir, "flipbook_$safeVersion.apk")
        file.writeBytes(bytes)
        return file
    }

    /**
     * 使用 PackageInstaller.Session API 安装 APK。
     *
     * 相比 Intent.ACTION_VIEW，优势在于：
     * - 安装完成后通过 PendingIntent 回调立即重启 App，桌面停留时间接近为零
     * - STATUS_PENDING_USER_ACTION 时才展示系统确认弹框
     * - STATUS_SUCCESS 时直接重启（配合 ACTION_MY_PACKAGE_REPLACED 岗位）
     */
    private suspend fun installViaSession(file: File) {
        // 退出 LockTask 模式（如果处于的话）
        (context as? Activity)?.runCatching { stopLockTask() }

        val packageInstaller = context.packageManager.packageInstaller
        val params =
                PackageInstaller.SessionParams(
                                PackageInstaller.SessionParams.MODE_FULL_INSTALL,
                        )
                        .apply {
                            setAppPackageName(BuildConfig.APPLICATION_ID)
                            // Android 12+：向系统声明我们希望减少用户交互步骤
                            // （Device Owner 场景下可完全无弹框）
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                setRequireUserAction(
                                        PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED
                                )
                            }
                        }

        // 安装完成的回调会发送到 AppUpdateReceiver
        val completionIntent =
                Intent(context, AppUpdateReceiver::class.java).apply {
                    action = AppUpdateReceiver.ACTION_INSTALL_COMPLETE
                }
        val pendingIntent =
                PendingIntent.getBroadcast(
                        context,
                        6703,
                        completionIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )

        val sessionId = packageInstaller.createSession(params)
        packageInstaller.openSession(sessionId).use { session ->
            session.openWrite("package", 0, file.length()).use { out ->
                file.inputStream().use { it.copyTo(out) }
                session.fsync(out)
            }
            // 安装前打开全屏图片（独立进程），遮挡桌面，等待图片查看器完全启动后再提交
            showCoverImageForInstall()
            // commit 是异步的，结果通过 pendingIntent 回调
            session.commit(pendingIntent.intentSender)
        }
    }

    /**
     * OTA 安装前打开全屏图片遮挡桌面。
     *
     * 核心思路：用 Intent.ACTION_VIEW 打开系统图片查看器（独立进程/包）。
     * 当我们的 App 进程因 APK 安装被杀时，图片查看器进程仍然存活，
     * 屏幕上持续显示全屏图片，用户看不到桌面。
     * App 重启后 MainActivity 来到前台，图片查看器自动退到后台。
     *
     * @param delayMs 等待图片查看器完全启动的时间（默认 800ms）
     */
    private suspend fun showCoverImageForInstall(delayMs: Long = 800L) {
        runCatching {
            // 生成全屏纯黑 JPEG（与屏幕同等分辨率）
            val metrics = DisplayMetrics()
            @Suppress("DEPRECATION")
            (context as? Activity)?.windowManager?.defaultDisplay?.getMetrics(metrics)
            val w = if (metrics.widthPixels > 0) metrics.widthPixels else 1920
            val h = if (metrics.heightPixels > 0) metrics.heightPixels else 1080
            val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.RGB_565)
            bitmap.eraseColor(Color.BLACK)

            // 保存到 cacheDir（file_paths.xml 已包含 cache-path）
            val file = File(context.cacheDir, "ota_cover.jpg")
            file.outputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 95, out)
            }
            bitmap.recycle()

            // 通过 FileProvider 获取 URI，用系统图片查看器全屏打开
            val uri = FileProvider.getUriForFile(
                context,
                "${BuildConfig.APPLICATION_ID}.fileprovider",
                file,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "image/jpeg")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(intent)
            // 等待图片查看器完全启动，再提交安装
            delay(delayMs)
        }
    }
}

@Composable
fun rememberOtaUpdateState(): OtaUpdateState {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val state = remember(context, scope) { OtaUpdateState(context, scope) }
    return state
}

private fun parseLatestVersion(json: JsonObject): OtaUpdateInfo? {
    val latest = json.getAsJsonObject("latestVersion") ?: return null
    val versionCode = latest.intOrNull("versionCode") ?: return null
    val versionName = latest.stringOrNull("versionName") ?: "1.0.$versionCode"
    val apkUrl = latest.stringOrNull("apkUrl") ?: return null
    return OtaUpdateInfo(
            versionCode = versionCode,
            versionName = versionName,
            apkUrl = apkUrl,
            changelog = latest.stringOrNull("changelog").orEmpty(),
            forceUpgrade = latest.boolOrNull("forceUpgrade") ?: false,
    )
}

private fun JsonObject.stringOrNull(key: String): String? {
    val node = get(key) ?: return null
    if (node.isJsonNull) return null
    return runCatching { node.asString }.getOrNull()
}

private fun JsonObject.intOrNull(key: String): Int? {
    val node = get(key) ?: return null
    if (node.isJsonNull) return null
    return runCatching { node.asInt }.getOrNull()
}

private fun JsonObject.boolOrNull(key: String): Boolean? {
    val node = get(key) ?: return null
    if (node.isJsonNull) return null
    return runCatching { node.asBoolean }.getOrNull()
}

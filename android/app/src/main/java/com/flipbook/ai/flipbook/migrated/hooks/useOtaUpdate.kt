package com.flipbook.ai.flipbook.migrated.hooks

import android.app.Activity
import android.content.Context
import android.content.pm.PackageInstaller
import android.os.Build
import android.os.Environment
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.BuildConfig
import com.flipbook.ai.flipbook.migrated.api.deviceApi
import com.flipbook.ai.flipbook.migrated.api.otaApi
import com.flipbook.ai.flipbook.migrated.components.otaupdate.OtaBadgeState
import com.flipbook.ai.flipbook.migrated.components.otaupdate.OtaUpdateInfo
import com.flipbook.ai.flipbook.migrated.utils.getInstalledAppVersion
import com.flipbook.ai.flipbook.migrated.utils.createInstallStatusCallback
import com.google.gson.JsonObject
import java.io.File
import kotlinx.coroutines.CoroutineScope
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
        // 后台现有升级通道只发布平板 APK，手机版不能下载或安装该包。
        if (BuildConfig.PHONE_UI || loading) return
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
        if (BuildConfig.PHONE_UI) return
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
        if (BuildConfig.PHONE_UI) return
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
    private fun installViaSession(file: File) {
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

        val sessionId = packageInstaller.createSession(params)
        try {
            val callback = createInstallStatusCallback(context, sessionId)
            packageInstaller.openSession(sessionId).use { session ->
                session.openWrite("package", 0, file.length()).use { out ->
                    file.inputStream().use { it.copyTo(out) }
                    session.fsync(out)
                }
                // 保持应用自己的安装提示；升级会撤销 FileProvider 的临时读权限，
                // 不能依赖外部相册显示遮罩，否则会出现“文件已损坏”的误报。
                session.commit(callback.intentSender)
            }
        } catch (error: Exception) {
            runCatching { packageInstaller.abandonSession(sessionId) }
            throw error
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

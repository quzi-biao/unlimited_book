package com.flipbook.ai

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log

/**
 * 监听两类安装事件：
 * 1. ACTION_MY_PACKAGE_REPLACED  — 系统广播，APK 替换成功后触发，作为保险兜底
 * 2. ACTION_INSTALL_COMPLETE     — PackageInstaller.Session 安装结果回调
 *    - STATUS_SUCCESS             → 立即重启 App（最小化桌面停留时间）
 *    - STATUS_PENDING_USER_ACTION → 启动系统确认弹框
 *    - 其他                       → 记录日志
 */
class AppUpdateReceiver : BroadcastReceiver() {

    companion object {
        /** PackageInstaller.Session 安装完成的回调 Action */
        const val ACTION_INSTALL_COMPLETE = "com.flipbook.ai.INSTALL_COMPLETE"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_MY_PACKAGE_REPLACED -> launchApp(context)
            ACTION_INSTALL_COMPLETE -> handleInstallComplete(context, intent)
        }
    }

    /**
     * 处理 PackageInstaller.Session 的安装结果回调。
     * SUCCESS  → 直接重启 App（桌面停留时间接近零）
     * PENDING  → 调起系统确认弹框
     */
    private fun handleInstallComplete(context: Context, intent: Intent) {
        if (!intent.hasExtra(PackageInstaller.EXTRA_STATUS)) {
            // 旧版用 IMMUTABLE 创建回调，系统无法附加安装状态。
            // 兼容旧版升级到本版：只恢复应用界面，不把缺失状态当作安装失败或成功。
            Log.w("AppUpdateReceiver", "Install callback has no status; reopening app for legacy updater")
            launchApp(context)
            return
        }
        val status = intent.getIntExtra(
            PackageInstaller.EXTRA_STATUS,
            PackageInstaller.STATUS_FAILURE,
        )
        when (status) {
            PackageInstaller.STATUS_SUCCESS -> {
                Log.i("AppUpdateReceiver", "Install succeeded; reopening app")
                // 安装成功，MY_PACKAGE_REPLACED 稍后也会触发，这里立即重启作为补充
                launchApp(context)
            }
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                // 系统要求用户确认（非 Device Owner 时必然经过此步骤）
                @Suppress("DEPRECATION")
                val confirmIntent =
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                    } else {
                        intent.getParcelableExtra(Intent.EXTRA_INTENT)
                    }
                if (confirmIntent != null) {
                    confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    runCatching { context.startActivity(confirmIntent) }
                        .onFailure { Log.e("AppUpdateReceiver", "Cannot open install confirmation", it) }
                }
            }
            else -> {
                val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                Log.w("AppUpdateReceiver", "Install failed status=$status msg=$msg")
            }
        }
    }

    /** 重启 App 主界面 */
    private fun launchApp(context: Context) {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        runCatching { context.startActivity(launchIntent) }
            .onSuccess { Log.i("AppUpdateReceiver", "Requested MainActivity after update") }
            .onFailure { Log.e("AppUpdateReceiver", "Cannot reopen app after update", it) }
    }
}

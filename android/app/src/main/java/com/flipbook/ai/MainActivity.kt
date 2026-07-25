package com.flipbook.ai

import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.os.Bundle
import android.os.Build
import android.util.Log
import android.view.View
import android.view.Window
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.flipbook.ai.flipbook.migrated.MainEntry
import com.flipbook.ai.ui.FlipbookTheme

class MainActivity : ComponentActivity() {
    private val tag = "KioskMainActivity"
    private val adminComponent by lazy { ComponentName(this, KioskAdminReceiver::class.java) }

    override fun onCreate(savedInstanceState: Bundle?) {
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        super.onCreate(savedInstanceState)
        actionBar?.hide()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // OTA 安装后重启：lockNow() 使屏幕关闭，这里确保 App 启动时自动亮屏并跳过锁屏
        // setKeyguardDisabled(true) 已在 applyDeviceOwnerPolicies() 中设置，所以无锁屏界面
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setTurnScreenOn(true)
            setShowWhenLocked(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
            )
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        enforceKioskShell()

        // Kiosk 模式下禁用返回键，防止退出当前任务栈。
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = Unit
            },
        )

        setContent {
            FlipbookTheme {
                MainEntry()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        enforceKioskShell()
        window.decorView.postDelayed({ enforceKioskShell() }, 180)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enforceKioskShell()
            window.decorView.postDelayed({ enforceKioskShell() }, 180)
        }
    }

    private fun enforceKioskShell() {
        enterImmersiveMode()
        applyDeviceOwnerPolicies()
        ensureLockTask()
    }

    private fun enterImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { c ->
                c.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                c.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
            return
        }

        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
    }

    private fun applyDeviceOwnerPolicies() {
        val dpm = getSystemService(DevicePolicyManager::class.java) ?: return
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)
        Log.i(tag, "DeviceOwnerCheck package=$packageName result=$isDeviceOwner")
        if (!isDeviceOwner) {
            Log.w(tag, "Device Owner 未设置，无法彻底禁用系统状态栏/导航键。")
            return
        }

        runCatching { dpm.setLockTaskPackages(adminComponent, arrayOf(packageName)) }
            .onSuccess { Log.i(tag, "setLockTaskPackages 成功") }
            .onFailure { Log.e(tag, "setLockTaskPackages 失败", it) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            runCatching { dpm.setLockTaskFeatures(adminComponent, DevicePolicyManager.LOCK_TASK_FEATURE_NONE) }
                .onSuccess { Log.i(tag, "setLockTaskFeatures 成功") }
                .onFailure { Log.e(tag, "setLockTaskFeatures 失败", it) }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            runCatching { dpm.setStatusBarDisabled(adminComponent, true) }
                .onSuccess { Log.i(tag, "setStatusBarDisabled 成功") }
                .onFailure { Log.e(tag, "setStatusBarDisabled 失败", it) }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            runCatching { dpm.setKeyguardDisabled(adminComponent, true) }
                .onSuccess { Log.i(tag, "setKeyguardDisabled 成功") }
                .onFailure { Log.e(tag, "setKeyguardDisabled 失败", it) }
        }
    }

    private fun ensureLockTask() {
        val am = getSystemService(ActivityManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (am?.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE) {
                Log.i(tag, "LockTask 已启用 state=${am?.lockTaskModeState}")
                return
            }
        } else {
            @Suppress("DEPRECATION")
            if (am?.isInLockTaskMode == true) {
                Log.i(tag, "LockTask 已启用")
                return
            }
        }
        runCatching { startLockTask() }
            .onSuccess { Log.i(tag, "startLockTask 调用成功") }
            .onFailure { Log.e(tag, "startLockTask 失败", it) }
    }
}

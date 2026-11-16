package com.flipbook.ai.flipbook.migrated.components.common

import android.content.Context
import com.flipbook.ai.BuildConfig
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.os.Build
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** 检查当前是否有网络连接（含 WiFi / 移动数据） */
fun isNetworkConnected(context: Context): Boolean {
    val cm = context.getSystemService(ConnectivityManager::class.java) ?: return false
    val cap = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
    return cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}

/**
 * 尝试自动开启 WiFi。
 * - Android < 10（API < 29）：直接调用 setWifiEnabled(true)
 * - Android 10+：API 已废弃，只能跳转设置，此处静默忽略
 */
@Suppress("DEPRECATION")
fun tryEnableWifi(context: Context) {
    if (BuildConfig.PHONE_UI || Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return // Android 10+ 无法直接开启
    val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
    if (!wm.isWifiEnabled) {
        runCatching { wm.isWifiEnabled = true }
    }
}

/**
 * 网络未连接弹窗。
 * - 挂载时立即检测网络；若 WiFi 未开启，自动尝试开启（Android < 10）；
 * - 注册系统网络回调，网络恢复后自动关闭；
 * - [onGoToWifi] 由外层调用，打开 WiFi 设置界面。
 */
@Composable
fun NoNetworkDialog(
    onVisibleChange: (Boolean) -> Unit = {},
    onGoToWifi: () -> Unit,
) {
    val compact = LocalCompactLayout.current
    val context = LocalContext.current.applicationContext
    var visible by remember { mutableStateOf(false) }

    // 监听 visible 变化，通知外层
    LaunchedEffect(visible) {
        onVisibleChange(visible)
    }

    // 初始检测：未联网则显示弹窗，同时尝试自动开启 WiFi
    LaunchedEffect(Unit) {
        if (!isNetworkConnected(context)) {
            tryEnableWifi(context) // Android < 10 自动开启 WiFi
            visible = true
        }
    }

    // 注册网络变化回调，网络恢复后自动关闭
    DisposableEffect(Unit) {
        val cm = context.getSystemService(ConnectivityManager::class.java)
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities,
            ) {
                val ok = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                if (ok) visible = false
            }

            override fun onLost(network: Network) {
                // 网络断开后重新检查（可能还有其他网络）
                visible = !isNetworkConnected(context)
            }
        }
        runCatching {
            cm?.registerNetworkCallback(
                NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build(),
                cb,
            )
        }
        onDispose {
            runCatching { cm?.unregisterNetworkCallback(cb) }
        }
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(),
        exit = fadeOut(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xE6050810)), // 深色半透明遮罩
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth(if (compact) 0.9f else 0.40f)
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF12112B), Color(0xFF1A1740)),
                        ),
                    )
                    .padding(horizontal = 28.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                // 图标
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .background(Color(0x22F87171), RoundedCornerShape(36.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.WifiOff,
                        contentDescription = null,
                        tint = Color(0xFFF87171),
                        modifier = Modifier.size(36.dp),
                    )
                }

                Spacer(Modifier.height(20.dp))

                Text(
                    text = "未连接网络",
                    color = Color(0xF2FFFFFF),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )

                Spacer(Modifier.height(10.dp))

                Text(
                    text = if (BuildConfig.PHONE_UI) "请连接 WiFi 或移动网络\n检测到网络后将自动继续" else "请连接 WiFi 后继续使用\n检测到网络后将自动继续",
                    color = Color(0x99FFFFFF),
                    fontSize = 13.sp,
                    lineHeight = 20.sp,
                    textAlign = TextAlign.Center,
                )

                Spacer(Modifier.height(28.dp))

                // 前往 WiFi 设置按钮
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFFA78BFA), Color(0xFF7C3AED)),
                            ),
                        )
                        .clickable {
                            visible = false
                            onGoToWifi()
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = if (BuildConfig.PHONE_UI) "前往网络设置" else "前往 WiFi 设置",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

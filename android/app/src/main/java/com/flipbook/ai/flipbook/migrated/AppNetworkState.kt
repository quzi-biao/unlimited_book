package com.flipbook.ai.flipbook.migrated

import android.content.Context
import android.net.ConnectivityManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.flipbook.migrated.components.common.isNetworkConnected

/** 监听联网状态供主界面引导使用，离开组合时注销回调。 */
@Composable
internal fun rememberAppNetworkConnected(): Boolean {
    // 网络状态监听（解决网络恢复后引导不弹出的问题）
    val context = LocalContext.current.applicationContext
    var isConnected by remember { mutableStateOf(isNetworkConnected(context)) }
    DisposableEffect(context) {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = android.net.NetworkRequest.Builder()
            .addCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            .build()
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) { isConnected = true }
            override fun onLost(network: android.net.Network) { isConnected = isNetworkConnected(context) }
            override fun onCapabilitiesChanged(network: android.net.Network, networkCapabilities: android.net.NetworkCapabilities) {
                isConnected = networkCapabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            }
        }
        connectivityManager.registerNetworkCallback(request, callback)
        onDispose { connectivityManager.unregisterNetworkCallback(callback) }
    }

    return isConnected
}

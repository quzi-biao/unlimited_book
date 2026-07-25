package com.flipbook.ai.flipbook.migrated.utils

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.ScanResult
import android.net.wifi.WifiConfiguration
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.WindowManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

data class WifiStatus(
    val connected: Boolean,
    val ssid: String,
    val rssi: Int,
    val level: Int,
    val enabled: Boolean = false,
)

data class WifiNetwork(
    val ssid: String,
    val rssi: Int,
    val level: Int,
    val open: Boolean,
    val frequency: Int,
)

data class WifiConnectResult(
    val success: Boolean,
    val ssid: String,
    val error: String? = null,
)

data class WifiToggleResult(
    val success: Boolean,
    val enabled: Boolean,
    val error: String? = null,
)

data class BrightnessStatus(
    val brightness: Int,
    val auto: Boolean,
)

object DeviceControl {
    @Volatile
    private var cachedSsid: String? = null

    @Volatile
    private var cachedRssi: Int = -127

    @Volatile
    private var callbackRegistered = false

    private fun ensureWifiCallback(context: Context) {
        if (callbackRegistered || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        val cm = context.getSystemService(ConnectivityManager::class.java) ?: return
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
                if (!networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return
                val wi = networkCapabilities.transportInfo as? WifiInfo ?: return
                val ssid = wi.ssid?.trim('"')
                if (!ssid.isNullOrBlank() && ssid != "<unknown ssid>") {
                    cachedSsid = ssid
                }
                cachedRssi = wi.rssi
            }

            override fun onLost(network: Network) {
                cachedSsid = null
                cachedRssi = -127
            }
        }
        runCatching {
            cm.registerNetworkCallback(
                NetworkRequest.Builder()
                    .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                    .build(),
                cb,
            )
            callbackRegistered = true
        }
    }

    suspend fun getCurrentWifi(context: Context): WifiStatus = withContext(Dispatchers.IO) {
        ensureWifiCallback(context)
        val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            ?: return@withContext WifiStatus(false, "", -127, 0)
        if (!wm.isWifiEnabled) return@withContext WifiStatus(false, "", -127, 0, enabled = false)
        val status = readCurrentWifi(context, wm)
        if (status.connected) status.copy(enabled = true) else status.copy(level = 0, enabled = true)
    }

    suspend fun scanWifi(context: Context): List<WifiNetwork> = withContext(Dispatchers.IO) {
        val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            ?: return@withContext emptyList()
        if (!wm.isWifiEnabled) return@withContext emptyList()

        runCatching { wm.startScan() }
        delay(1200)
        val results = runCatching { wm.scanResults }.getOrNull().orEmpty()
        val dedup = LinkedHashMap<String, ScanResult>()
        results.forEach { sr ->
            val ssid = sr.SSID ?: return@forEach
            if (ssid.isBlank()) return@forEach
            val existing = dedup[ssid]
            if (existing == null || sr.level > existing.level) dedup[ssid] = sr
        }
        return@withContext dedup.values
            .map { sr ->
                WifiNetwork(
                    ssid = sr.SSID.orEmpty(),
                    rssi = sr.level,
                    level = WifiManager.calculateSignalLevel(sr.level, 5),
                    open = sr.capabilities?.let { caps ->
                        caps.contains("[ESS]") && !caps.contains("WPA") && !caps.contains("WEP")
                    } == true,
                    frequency = sr.frequency,
                )
            }
            .sortedByDescending { it.rssi }
    }

    @Suppress("DEPRECATION")
    suspend fun setWifiEnabled(context: Context, enabled: Boolean): WifiToggleResult = withContext(Dispatchers.IO) {
        val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            ?: return@withContext WifiToggleResult(false, false, "WifiManager 不可用")
        if (wm.isWifiEnabled == enabled) {
            return@withContext WifiToggleResult(true, enabled)
        }

        runCatching { wm.isWifiEnabled = enabled }
        delay(1200)
        if (wm.isWifiEnabled == enabled) {
            return@withContext WifiToggleResult(true, enabled)
        }

        val cmd = if (enabled) "svc wifi enable" else "svc wifi disable"
        runCatching {
            val p = Runtime.getRuntime().exec(arrayOf("sh", "-c", cmd))
            p.waitFor()
        }
        delay(1500)

        val actual = wm.isWifiEnabled
        WifiToggleResult(
            success = actual == enabled,
            enabled = actual,
            error = if (actual == enabled) {
                null
            } else {
                "系统限制 App 直接${if (enabled) "开启" else "关闭"} WiFi，请在设备系统设置中处理"
            },
        )
    }

    fun openWifiSettings(context: Context): Boolean {
        val activity = context.findActivity()
        val startContext = activity ?: context
        runCatching { activity?.stopLockTask() }

        val actions = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(Settings.Panel.ACTION_WIFI)
            add(Settings.ACTION_WIFI_SETTINGS)
            add(Settings.ACTION_SETTINGS)
        }

        actions.forEach { action ->
            val opened = runCatching {
                startContext.startActivity(
                    Intent(action).apply {
                        if (activity == null) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                )
            }.isSuccess
            if (opened) return true
        }
        return false
    }

    @Suppress("DEPRECATION")
    suspend fun connectWifi(
        context: Context,
        ssid: String,
        password: String,
        isOpen: Boolean,
    ): WifiConnectResult = withContext(Dispatchers.Main) {
        if (ssid.isBlank()) return@withContext WifiConnectResult(false, "", "SSID 不能为空")
        val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            ?: return@withContext WifiConnectResult(false, "", "WifiManager 不可用")
        if (!wm.isWifiEnabled) wm.isWifiEnabled = true

        return@withContext try {
            val conf = WifiConfiguration().apply {
                SSID = "\"$ssid\""
                if (isOpen || password.isBlank()) {
                    allowedKeyManagement.set(WifiConfiguration.KeyMgmt.NONE)
                } else {
                    preSharedKey = "\"$password\""
                    allowedKeyManagement.set(WifiConfiguration.KeyMgmt.WPA_PSK)
                }
            }

            runCatching {
                wm.configuredNetworks?.forEach { cfg ->
                    if (cfg.SSID == "\"$ssid\"") wm.removeNetwork(cfg.networkId)
                }
            }

            val netId = wm.addNetwork(conf)
            if (netId == -1) {
                return@withContext WifiConnectResult(false, "", "添加网络配置失败，请检查密码")
            }

            wm.disconnect()
            wm.enableNetwork(netId, true)
            wm.reconnect()

            val cm = context.getSystemService(ConnectivityManager::class.java)
            if (cm == null) {
                delay(1200)
                val cur = readCurrentWifi(context, wm)
                return@withContext WifiConnectResult(cur.connected, cur.ssid, if (cur.connected) null else "连接超时")
            }

            suspendCancellableCoroutine { cont ->
                val handler = Handler(Looper.getMainLooper())
                var finished = false
                lateinit var cb: ConnectivityManager.NetworkCallback

                fun done() {
                    if (finished) return
                    finished = true
                    runCatching { cm.unregisterNetworkCallback(cb) }
                    val cur = readCurrentWifi(context, wm)
                    val ok = cur.connected && (cur.ssid == ssid || cur.ssid.isNotBlank())
                    cont.resume(
                        WifiConnectResult(
                            success = ok,
                            ssid = cur.ssid,
                            error = if (ok) null else "连接失败，请检查密码或网络状态",
                        ),
                    )
                }

                cb = object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        handler.post { done() }
                    }
                }

                runCatching {
                    cm.requestNetwork(
                        NetworkRequest.Builder()
                            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                            .build(),
                        cb,
                        12_000,
                    )
                }.onFailure {
                    done()
                    return@suspendCancellableCoroutine
                }

                handler.postDelayed({ done() }, 12_000)
                cont.invokeOnCancellation {
                    handler.removeCallbacksAndMessages(null)
                    runCatching { cm.unregisterNetworkCallback(cb) }
                }
            }
        } catch (e: Exception) {
            WifiConnectResult(false, "", e.message ?: "连接异常")
        }
    }

    suspend fun getBrightness(context: Context): BrightnessStatus = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val mode = Settings.System.getInt(
            resolver,
            Settings.System.SCREEN_BRIGHTNESS_MODE,
            Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL,
        )
        val brightness = Settings.System.getInt(
            resolver,
            Settings.System.SCREEN_BRIGHTNESS,
            128,
        )
        BrightnessStatus(
            brightness = brightness.coerceIn(1, 255),
            auto = mode == Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC,
        )
    }

    suspend fun setBrightness(
        context: Context,
        activity: Activity?,
        brightness: Int,
    ): Pair<Boolean, Int> = withContext(Dispatchers.IO) {
        val target = brightness.coerceIn(1, 255)
        val resolver = context.contentResolver

        runCatching {
            Settings.System.putInt(
                resolver,
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL,
            )
        }

        var systemWriteOk = false
        if (Settings.System.canWrite(context)) {
            systemWriteOk = runCatching {
                Settings.System.putInt(resolver, Settings.System.SCREEN_BRIGHTNESS, target)
            }.getOrDefault(false)
        }
        if (!systemWriteOk) {
            systemWriteOk = runCatching {
                val p = Runtime.getRuntime().exec(
                    arrayOf("settings", "put", "system", "screen_brightness", target.toString()),
                )
                p.waitFor()
                p.exitValue() == 0
            }.getOrDefault(false)
        }

        activity?.runOnUiThread {
            runCatching {
                val lp: WindowManager.LayoutParams = activity.window.attributes
                lp.screenBrightness = target / 255f
                activity.window.attributes = lp
            }
        }

        systemWriteOk to target
    }

    private fun readCurrentWifi(context: Context, wm: WifiManager): WifiStatus {
        var ssid: String? = null
        var rssi = -127

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !cachedSsid.isNullOrBlank()) {
            ssid = cachedSsid
            rssi = cachedRssi
        }

        if (ssid.isNullOrBlank() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val cm = context.getSystemService(ConnectivityManager::class.java)
            val active = cm?.activeNetwork
            val caps = active?.let { cm.getNetworkCapabilities(it) }
            if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                val wi = caps.transportInfo as? WifiInfo
                if (wi != null) rssi = wi.rssi
            }
        }

        if (ssid.isNullOrBlank()) {
            @Suppress("DEPRECATION")
            val info = wm.connectionInfo
            if (info != null) {
                val s = info.ssid
                if (!s.isNullOrBlank() && s != "<unknown ssid>") ssid = s
                if (rssi == -127) rssi = info.rssi
            }
        }

        ssid = ssid?.trim('"')
        val connected = !ssid.isNullOrBlank()
        val fixedRssi = if (rssi == -127) -127 else rssi
        return WifiStatus(
            connected = connected,
            ssid = if (connected) ssid.orEmpty() else "",
            rssi = fixedRssi,
            level = WifiManager.calculateSignalLevel(fixedRssi, 5).coerceIn(0, 4),
            enabled = wm.isWifiEnabled,
        )
    }
}

fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

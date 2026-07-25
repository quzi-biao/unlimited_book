package com.flipbook.ai.flipbook.migrated.components.settingspage

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.utils.DeviceControl
import com.flipbook.ai.flipbook.migrated.utils.WifiNetwork
import com.flipbook.ai.flipbook.migrated.utils.WifiStatus
import kotlinx.coroutines.launch

/** 对应 WebView: components/SettingsPage/WifiTab.jsx */
@Composable
fun WifiTab(
    /** 点击有密码的 WiFi 时，由父层弹出密码输入层（全屏遮罩） */
    onConnectWithPassword: (network: WifiNetwork, connect: (String) -> Unit) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val appContext = context.applicationContext
    val scope = rememberCoroutineScope()
    var current by remember { mutableStateOf(WifiStatus(false, "", -127, 0)) }
    var networks by remember { mutableStateOf<List<WifiNetwork>>(emptyList()) }
    var scanning by remember { mutableStateOf(false) }
    var connecting by remember { mutableStateOf("") }
    var togglingWifi by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf("") }
    var err by remember { mutableStateOf("") }

    fun reloadAll() {
        scope.launch {
            scanning = true
            err = ""
            current = DeviceControl.getCurrentWifi(appContext)
            networks = DeviceControl.scanWifi(appContext)
            scanning = false
        }
    }

    fun connect(network: WifiNetwork, pwd: String) {
        scope.launch {
            connecting = network.ssid
            msg = ""
            err = ""
            val res = DeviceControl.connectWifi(
                context = appContext,
                ssid = network.ssid,
                password = pwd,
                isOpen = network.open,
            )
            if (res.success) {
                msg = "已成功连接到「${network.ssid}」"
            } else {
                err = res.error ?: "连接失败，请检查密码"
            }
            connecting = ""
            reloadAll()
        }
    }

    fun toggleWifi() {
        scope.launch {
            togglingWifi = true
            msg = ""
            err = ""
            val target = !current.enabled
            val res = DeviceControl.setWifiEnabled(appContext, target)
            current = DeviceControl.getCurrentWifi(appContext)
            networks = if (res.enabled) DeviceControl.scanWifi(appContext) else emptyList()
            if (res.success) {
                msg = if (res.enabled) "WiFi 已开启" else "WiFi 已关闭"
            } else {
                val opened = DeviceControl.openWifiSettings(context)
                err = if (opened) {
                    "系统限制 App 直接${if (target) "开启" else "关闭"} WiFi，已打开系统 WiFi 设置"
                } else {
                    res.error ?: "WiFi 状态切换失败"
                }
            }
            togglingWifi = false
        }
    }

    LaunchedEffect(Unit) {
        reloadAll()
    }

    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // 当前连接状态卡片
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(SettingsPageStyle.RowBg, RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(
                imageVector = if (current.connected) Icons.Rounded.Wifi else Icons.Rounded.WifiOff,
                contentDescription = null,
                tint = if (current.connected) Color(0xFF4ADE80) else SettingsPageStyle.TextMuted,
                modifier = Modifier.size(18.dp),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = when {
                        !current.enabled -> "WiFi 未开启"
                        current.connected -> current.ssid
                        else -> "未连接"
                    },
                    color = if (current.connected) SettingsPageStyle.TextMain else SettingsPageStyle.TextMuted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
                if (current.connected) {
                    Text("信号强度 ${current.level}/4", color = SettingsPageStyle.TextMuted, fontSize = 11.sp)
                } else if (!current.enabled) {
                    Text("开启后可扫描附近网络", color = SettingsPageStyle.TextMuted, fontSize = 11.sp)
                }
            }
            Row(
                modifier = Modifier
                    .background(
                        if (current.enabled) Color(0x18FFFFFF) else Color(0x223B82F6),
                        RoundedCornerShape(8.dp),
                    )
                    .clickable(enabled = !togglingWifi) { toggleWifi() }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (togglingWifi) {
                    CircularProgressIndicator(color = SettingsPageStyle.TabActive, strokeWidth = 1.5.dp, modifier = Modifier.size(12.dp))
                } else {
                    Icon(
                        if (current.enabled) Icons.Rounded.WifiOff else Icons.Rounded.Wifi,
                        contentDescription = null,
                        tint = SettingsPageStyle.TextSoft,
                        modifier = Modifier.size(14.dp),
                    )
                }
                Text(
                    if (togglingWifi) "处理中" else if (current.enabled) "关闭 WiFi" else "开启 WiFi",
                    color = SettingsPageStyle.TextSoft,
                    fontSize = 11.sp,
                )
            }
            Row(
                modifier = Modifier
                    .background(Color(0x12FFFFFF), RoundedCornerShape(8.dp))
                    .clickable(enabled = current.enabled) { reloadAll() }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (scanning) {
                    CircularProgressIndicator(color = SettingsPageStyle.TabActive, strokeWidth = 1.5.dp, modifier = Modifier.size(12.dp))
                } else {
                    Icon(Icons.Rounded.Refresh, contentDescription = null, tint = SettingsPageStyle.TextSoft, modifier = Modifier.size(14.dp))
                }
                Text(if (scanning) "扫描中" else "刷新", color = SettingsPageStyle.TextSoft, fontSize = 11.sp)
            }
        }

        if (msg.isNotBlank()) {
            Text(msg, color = Color(0xFF4ADE80), fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp))
        }
        if (err.isNotBlank()) {
            Text(err, color = Color(0xFFF87171), fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp))
        }

        Text("附近网络", color = SettingsPageStyle.TextMuted, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 2.dp))

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth().heightIn(min = 0.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (!scanning && networks.isEmpty()) {
                item {
                    Text(
                        "未找到 WiFi 网络，请点击刷新",
                        color = SettingsPageStyle.TextMuted,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(vertical = 20.dp, horizontal = 4.dp),
                    )
                }
            }
            items(networks, key = { it.ssid }) { net ->
                val connected = current.connected && current.ssid == net.ssid
                val isConnecting = connecting == net.ssid
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (connected) Color(0x1A10B981) else SettingsPageStyle.RowBg,
                            RoundedCornerShape(10.dp),
                        )
                        .clickable(enabled = !isConnecting) {
                            if (net.open) {
                                connect(net, "")
                            } else {
                                // 有密码的 WiFi → 触发父层全屏弹窗
                                onConnectWithPassword(net) { pwd -> connect(net, pwd) }
                            }
                        }
                        .padding(horizontal = 10.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        SignalBars(level = net.level)
                        if (!net.open) {
                            Icon(Icons.Rounded.Lock, contentDescription = null, tint = SettingsPageStyle.TextMuted, modifier = Modifier.size(12.dp))
                        }
                        Text(net.ssid, color = SettingsPageStyle.TextMain, fontSize = 13.sp)
                    }
                    when {
                        connected -> Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = Color(0xFF4ADE80), modifier = Modifier.size(15.dp))
                        isConnecting -> CircularProgressIndicator(color = SettingsPageStyle.TabActive, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                        !net.open -> Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = SettingsPageStyle.TextMuted, modifier = Modifier.size(15.dp))
                    }
                }
            }
        }
    }
}

/** WiFi 信号强度格子图标 */
@Composable
private fun SignalBars(level: Int, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(1.5.dp),
    ) {
        (1..4).forEach { i ->
            Box(
                modifier = Modifier
                    .size(width = 3.dp, height = (3 + i * 2.5).dp)
                    .background(
                        if (i <= level) SettingsPageStyle.TabActive else Color(0x33FFFFFF),
                        RoundedCornerShape(1.dp),
                    ),
            )
        }
    }
}

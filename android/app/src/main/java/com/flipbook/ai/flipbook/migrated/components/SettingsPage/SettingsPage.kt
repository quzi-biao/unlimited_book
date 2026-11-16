package com.flipbook.ai.flipbook.migrated.components.settingspage

import com.flipbook.ai.BuildConfig
import com.flipbook.ai.flipbook.migrated.components.common.LocalCompactLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Brightness6
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material.icons.rounded.Feedback
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.common.AgreementDialog
import com.flipbook.ai.flipbook.migrated.components.common.AgreementDialogTarget
import com.flipbook.ai.flipbook.migrated.components.voicesettings.VoiceSettings
import com.flipbook.ai.flipbook.migrated.utils.WifiNetwork
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff

private data class SettingsTabItem(
    val key: String,
    val label: String,
    val icon: ImageVector,
)

/** 对应 WebView: components/SettingsPage/SettingsPage.jsx */
@Composable
fun SettingsPage(
    open: Boolean,
    onClose: () -> Unit,
    initialTab: String = "voice",
    modifier: Modifier = Modifier,
) {
    if (!open) return
    val compact = LocalCompactLayout.current

    var tab by remember { mutableStateOf(initialTab) }
    var agreementTarget by remember { mutableStateOf<AgreementDialogTarget?>(null) }

    // WiFi 密码弹窗状态（提升到 SettingsPage 根层，确保全屏遮罩）
    var dialogWifiNet by remember { mutableStateOf<WifiNetwork?>(null) }
    var wifiConnectCallback by remember { mutableStateOf<((String) -> Unit)?>(null) }
    var wifiPassword by remember { mutableStateOf("") }
    var wifiPwdVisible by remember { mutableStateOf(false) }

    // 每次重新打开时切换到指定的初始 Tab
    LaunchedEffect(open, initialTab) {
        if (open) tab = initialTab
    }
    val tabs = remember {
        listOf(
            SettingsTabItem("voice", "音色设置", Icons.Rounded.VolumeUp),
            SettingsTabItem("style", "风格设置", Icons.Rounded.Palette),
            SettingsTabItem("wifi", "WiFi 设置", Icons.Rounded.Wifi),
            SettingsTabItem("brightness", "屏幕亮度", Icons.Rounded.Brightness6),
            SettingsTabItem("feedback", "问题反馈", Icons.Rounded.Feedback),
            SettingsTabItem("sysinfo", "系统信息", Icons.Rounded.Info),
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brush.linearGradient(listOf(SettingsPageStyle.BgStart, SettingsPageStyle.BgMid, SettingsPageStyle.BgEnd))),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 18.dp, start = 16.dp, end = 16.dp),
            ) {
                Row(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = if (compact) 0.dp else 64.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    tabs.forEach { item ->
                        val active = tab == item.key
                        Row(
                            modifier = Modifier
                                .background(if (active) SettingsPageStyle.TabHover else Color.Transparent, RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
                                .drawBehind {
                                    if (active) {
                                        val lineHeight = 2.dp.toPx()
                                        drawRect(
                                            color = SettingsPageStyle.TabActive,
                                            topLeft = Offset(0f, size.height - lineHeight),
                                            size = Size(size.width, lineHeight),
                                        )
                                    }
                                }
                                .clickable { tab = item.key }
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Icon(
                                imageVector = item.icon,
                                contentDescription = null,
                                tint = if (active) SettingsPageStyle.TabActive else SettingsPageStyle.TextMuted,
                                modifier = Modifier.size(16.dp),
                            )
                            Text(
                                text = item.label,
                                color = if (active) SettingsPageStyle.TabActive else SettingsPageStyle.TextMuted,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(SettingsPageStyle.TabLine),
            )

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.TopCenter,
            ) {
                Box(
                    modifier = Modifier
                        .widthIn(max = 420.dp)
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                ) {
                    when (tab) {
                        "voice" -> VoiceSettings(open = true, onClose = onClose, modifier = Modifier.fillMaxSize())
                        "style" -> PromptStyleTab(onClose = onClose, modifier = Modifier.fillMaxSize())
                        "wifi" -> if (BuildConfig.PHONE_UI) PhoneNetworkSettings() else WifiTab(
                            onConnectWithPassword = { net, connect ->
                                dialogWifiNet = net
                                wifiConnectCallback = connect
                                wifiPassword = ""
                                wifiPwdVisible = false
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                        "brightness" -> if (BuildConfig.PHONE_UI) PhoneBrightnessSettings() else BrightnessTab(modifier = Modifier.fillMaxSize())
                        "feedback" -> FeedbackTab(modifier = Modifier.fillMaxSize())
                        "sysinfo" -> SysInfoTab(
                            onOpenAgreement = { agreementTarget = it },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
            }
        }

        AgreementDialog(
            target = agreementTarget,
            onDismiss = { agreementTarget = null },
        )

        // ── WiFi 密码弹窗全屏遮罩（在根 Box 渲染，覆盖整个 SettingsPage） ──
        val wifiNet = dialogWifiNet
        if (wifiNet != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xCC000000))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) {
                        dialogWifiNet = null
                        wifiPassword = ""
                        wifiPwdVisible = false
                    },
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.4f)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF1A1740))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = {},
                        )
                        .padding(horizontal = 20.dp, vertical = 20.dp),
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        // 标题
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(Icons.Rounded.Lock, contentDescription = null, tint = SettingsPageStyle.TabActive, modifier = Modifier.size(14.dp))
                            Text(wifiNet.ssid, color = SettingsPageStyle.TextMain, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                        // 密码输入框
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("WiFi 密码", color = SettingsPageStyle.TextMuted, fontSize = 11.sp)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0x14FFFFFF), RoundedCornerShape(10.dp))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                BasicTextField(
                                    value = wifiPassword,
                                    onValueChange = { wifiPassword = it },
                                    singleLine = true,
                                    visualTransformation = if (wifiPwdVisible) VisualTransformation.None
                                        else PasswordVisualTransformation(),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                                    textStyle = TextStyle(
                                        color = if (wifiPwdVisible) Color(0x99FFFFFF) else SettingsPageStyle.TextMain,
                                        fontSize = 13.sp,
                                    ),
                                    cursorBrush = SolidColor(SettingsPageStyle.TabActive),
                                    decorationBox = { inner ->
                                        if (wifiPassword.isEmpty()) {
                                            Text("请输入密码", color = Color(0x33FFFFFF), fontSize = 13.sp)
                                        }
                                        inner()
                                    },
                                    modifier = Modifier.weight(1f),
                                )
                                Box(
                                    modifier = Modifier
                                        .size(28.dp)
                                        .clickable { wifiPwdVisible = !wifiPwdVisible },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        imageVector = if (wifiPwdVisible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                                        contentDescription = null,
                                        tint = if (wifiPwdVisible) Color(0x55FFFFFF) else SettingsPageStyle.TextMuted,
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            }
                        }
                        // 底部两个大按钮
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(42.dp)
                                    .background(Color(0x12FFFFFF), RoundedCornerShape(10.dp))
                                    .clickable {
                                        dialogWifiNet = null
                                        wifiPassword = ""
                                        wifiPwdVisible = false
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("取消", color = SettingsPageStyle.TextSoft, fontSize = 13.sp)
                            }
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(42.dp)
                                    .background(
                                        if (wifiPassword.isNotBlank()) SettingsPageStyle.TabActive else Color(0x44A78BFA),
                                        RoundedCornerShape(10.dp),
                                    )
                                    .clickable(enabled = wifiPassword.isNotBlank()) {
                                        val pwd = wifiPassword
                                        val cb = wifiConnectCallback
                                        dialogWifiNet = null
                                        wifiPassword = ""
                                        wifiPwdVisible = false
                                        wifiConnectCallback = null
                                        cb?.invoke(pwd)
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("连接", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .offset(x = 16.dp, y = (-16).dp)
                .width(34.dp)
                .height(34.dp)
                .background(Color(0x14FFFFFF), CircleShape)
                .clickable(onClick = onClose),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.ArrowBack,
                contentDescription = "返回",
                tint = SettingsPageStyle.TextSoft,
            )
        }
    }
}

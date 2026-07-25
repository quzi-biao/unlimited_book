package com.flipbook.ai.flipbook.migrated.components.settingspage

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Brightness6
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material.icons.rounded.Feedback
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.deviceApi
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.db.getBooks
import com.flipbook.ai.flipbook.migrated.components.common.AgreementDialog
import com.flipbook.ai.flipbook.migrated.components.common.AgreementDialogTarget
import com.flipbook.ai.flipbook.migrated.components.common.isAgreementRead
import com.flipbook.ai.flipbook.migrated.components.voicesettings.VoiceSettings
import com.flipbook.ai.flipbook.migrated.utils.WifiNetwork
import com.flipbook.ai.flipbook.migrated.utils.getInstalledAppVersion
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

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
                        .padding(horizontal = 64.dp),
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
                        "wifi" -> WifiTab(
                            onConnectWithPassword = { net, connect ->
                                dialogWifiNet = net
                                wifiConnectCallback = connect
                                wifiPassword = ""
                                wifiPwdVisible = false
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                        "brightness" -> BrightnessTab(modifier = Modifier.fillMaxSize())
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

/** 清除所有 App 数据：先删除云端书本数据，再清除本地缓存
 *
 * 重要：所有 SharedPreferences 必须使用 .commit()（同步写磁盘），
 * 而非 .apply()（异步），否则 killProcess() 在写入完成前就杀掉进程，
 * 导致数据实际未被清除。
 */
private suspend fun resetAllAppData(context: Context) = withContext(Dispatchers.IO) {
    // 0. 将本地书本列表逐一调用 DELETE /api/books/:id 删除服务器端数据
    //    使用已验证可用的现有接口，比批量接口更可靠
    val localBooks = runCatching { getBooks(context) }.getOrElse { emptyList() }
    for (book in localBooks) {
        runCatching { booksApi.remove(context, book.id) }
    }
    // 0b. 再调一次批量接口作为兜底（删除本地不在缓存中的外部添加书本）
    runCatching { deviceApi.factoryReset(context) }

    // 1-6. 本地缓存全清：必须用 commit() 同步写磁盘，防止 killProcess() 竞态
    context.getSharedPreferences("flipbook_store", Context.MODE_PRIVATE).edit().clear().commit()
    context.getSharedPreferences("agreement_read_state", Context.MODE_PRIVATE).edit().clear().commit()
    context.getSharedPreferences("flipbook_history", Context.MODE_PRIVATE).edit().clear().commit()
    context.getSharedPreferences("explore_queue", Context.MODE_PRIVATE).edit().clear().commit()
    context.getSharedPreferences("explanation_cache", Context.MODE_PRIVATE).edit().clear().commit()
    context.getSharedPreferences("onboarding_prefs", Context.MODE_PRIVATE).edit().clear().commit()
}

@Composable
private fun SysInfoTab(
    onOpenAgreement: (AgreementDialogTarget) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    var deviceCode by remember { mutableStateOf("加载中...") }
    var bookCount by remember { mutableStateOf("-") }
    var pageCount by remember { mutableStateOf("-") }

    // 重置确认弹窗状态：null=隐藏 / "warn"=风险提示 / "confirm"=二次确认
    var resetStep by remember { mutableStateOf<String?>(null) }
    var resetting by remember { mutableStateOf(false) }
    var resetDone by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        scope.launch {
            runCatching { deviceApi.info(context) }
                .onSuccess { json ->
                    val device = json.getAsJsonObject("device")
                    deviceCode = device?.stringOrNull("deviceCode") ?: "—"
                    bookCount = (device?.intOrNull("bookCount") ?: 0).toString()
                    pageCount = (device?.intOrNull("pageCount") ?: 0).toString()
                }
                .onFailure { deviceCode = "—" }
        }
    }

    if (resetStep == "warn") {
        Dialog(
            onDismissRequest = { resetStep = null },
            properties = DialogProperties(usePlatformDefaultWidth = false),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xCC000000))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { resetStep = null },
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.75f)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF1A1740))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = {},
                        )
                        .padding(24.dp),
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Warning,
                            contentDescription = null,
                            tint = Color(0xFFFBBF24),
                            modifier = Modifier.size(32.dp),
                        )
                        Text(
                            "重置 App 数据",
                            color = SettingsPageStyle.TextMain,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = "此操作将清除以下所有本地数据，且\u200B不可恢复：\n\n" +
                                "• WiFi 连接记录\n" +
                                "• 协议已读状态\n" +
                                "• 所有书本与页面数据\n" +
                                "• 音色 / 风格设置缓存\n" +
                                "• 阅读历史与探索队列\n" +
                                "• 屏幕解释缓存\n\n" +
                                "确定要继续吗？",
                            color = SettingsPageStyle.TextSoft,
                            fontSize = 13.sp,
                            lineHeight = 20.sp,
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp)
                                    .background(Color(0x12FFFFFF), RoundedCornerShape(10.dp))
                                    .clickable { resetStep = null },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("取消", color = SettingsPageStyle.TextSoft, fontSize = 13.sp)
                            }
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp)
                                    .background(Color(0x22FBB724), RoundedCornerShape(10.dp))
                                    .border(1.dp, Color(0x44FBB724), RoundedCornerShape(10.dp))
                                    .clickable { resetStep = "confirm" },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("继续", color = Color(0xFFFBBF24), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
    }

    // ── 第二步：二次确认弹窗 ──────────────────────────
    if (resetStep == "confirm") {
        Dialog(
            onDismissRequest = { resetStep = null },
            properties = DialogProperties(usePlatformDefaultWidth = false),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xCC000000))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { resetStep = null },
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.75f)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF1A1740))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = {},
                        )
                        .padding(24.dp),
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DeleteForever,
                            contentDescription = null,
                            tint = Color(0xFFF87171),
                            modifier = Modifier.size(32.dp),
                        )
                        Text(
                            "最终确认",
                            color = SettingsPageStyle.TextMain,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = "数据删除后\u200B无法恢复。\n确认清除所有 App 数据？\n\nApp 将在清除完成后自动重启。",
                            color = SettingsPageStyle.TextSoft,
                            fontSize = 13.sp,
                            lineHeight = 20.sp,
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp)
                                    .background(Color(0x12FFFFFF), RoundedCornerShape(10.dp))
                                    .clickable { resetStep = null },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("取消", color = SettingsPageStyle.TextSoft, fontSize = 13.sp)
                            }
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp)
                                    .background(Color(0x22F87171), RoundedCornerShape(10.dp))
                                    .border(1.dp, Color(0x44F87171), RoundedCornerShape(10.dp))
                                    .clickable {
                                        resetStep = null
                                        scope.launch {
                                            resetting = true
                                            runCatching { resetAllAppData(context) }
                                            resetting = false
                                            // 清除完成后自动重启 App
                                            val intent = context.packageManager
                                                .getLaunchIntentForPackage(context.packageName)
                                                ?.apply {
                                                    addFlags(
                                                        android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                                                        android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
                                                    )
                                                }
                                            if (intent != null) {
                                                context.startActivity(intent)
                                                android.os.Process.killProcess(android.os.Process.myPid())
                                            } else {
                                                resetDone = true
                                            }
                                        }
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("确认清除", color = Color(0xFFF87171), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SettingsPageStyle.RowBg, RoundedCornerShape(14.dp)),
            ) {
                Text(
                    text = "设备信息",
                    color = SettingsPageStyle.TextMuted,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 6.dp),
                )
                InfoLine("当前版本", context.getInstalledAppVersion().versionName)
                InfoLine("设备码", deviceCode)
                InfoLine("已有图册", "$bookCount 本 / $pageCount 页")
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SettingsPageStyle.RowBg, RoundedCornerShape(14.dp)),
            ) {
                Text(
                    text = "协议与规则",
                    color = SettingsPageStyle.TextMuted,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 6.dp),
                )
                AgreementItem(
                    title = "用户服务协议",
                    read = isAgreementRead(context, "terms_of_service"),
                ) { onOpenAgreement(AgreementDialogTarget("terms_of_service", "用户服务协议")) }
                AgreementItem(
                    title = "隐私政策",
                    read = isAgreementRead(context, "privacy_policy"),
                ) { onOpenAgreement(AgreementDialogTarget("privacy_policy", "隐私政策")) }
                AgreementItem(
                    title = "儿童个人信息保护规则",
                    read = isAgreementRead(context, "child_privacy"),
                ) { onOpenAgreement(AgreementDialogTarget("child_privacy", "儿童个人信息保护规则")) }
            }

            // ── 危险操作区域 ──────────────────────────────────
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0x14F87171), RoundedCornerShape(14.dp))
                    .border(1.dp, Color(0x22F87171), RoundedCornerShape(14.dp)),
            ) {
                Text(
                    text = "危险操作",
                    color = Color(0xFFF87171).copy(alpha = 0.7f),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 6.dp),
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = !resetting && !resetDone) { resetStep = "warn" }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DeleteForever,
                            contentDescription = null,
                            tint = if (resetDone) Color(0xFF4ADE80) else Color(0xFFF87171),
                            modifier = Modifier.size(18.dp),
                        )
                        Column {
                            Text(
                                text = if (resetting) "正在清除..." else if (resetDone) "已恢复出厂设置" else "恢复出厂设置",
                                color = if (resetDone) Color(0xFF4ADE80) else SettingsPageStyle.TextMain,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                            )
                            Text(
                                text = if (resetDone) "重启 App 后完全生效" else "清除所有本地数据，不可恢复",
                                color = SettingsPageStyle.TextMuted,
                                fontSize = 11.sp,
                            )
                        }
                    }
                    if (!resetDone) {
                        Icon(
                            imageVector = Icons.Rounded.Warning,
                            contentDescription = null,
                            tint = Color(0xFFFBBF24).copy(alpha = 0.7f),
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun AgreementItem(
    title: String,
    read: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(title, color = SettingsPageStyle.TextMain, fontSize = 13.sp)
            if (read) {
                Text("已阅读", color = Color(0xFF73D13D), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Icon(Icons.Rounded.KeyboardArrowRight, contentDescription = null, tint = SettingsPageStyle.TextMuted)
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(Color(0x0DFFFFFF)),
    )
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 11.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = SettingsPageStyle.TextSoft, fontSize = 13.sp)
        Text(value, color = SettingsPageStyle.TextMain, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(Color(0x0DFFFFFF)),
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

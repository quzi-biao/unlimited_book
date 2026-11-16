package com.flipbook.ai.flipbook.migrated.components.settingspage

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material.icons.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.Warning
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
import com.flipbook.ai.flipbook.migrated.api.deviceApi
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.db.getBooks
import com.flipbook.ai.flipbook.migrated.components.common.AgreementDialogTarget
import com.flipbook.ai.flipbook.migrated.components.common.isAgreementRead
import com.flipbook.ai.flipbook.migrated.utils.getInstalledAppVersion
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.ui.draw.clip
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

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
internal fun SysInfoTab(
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

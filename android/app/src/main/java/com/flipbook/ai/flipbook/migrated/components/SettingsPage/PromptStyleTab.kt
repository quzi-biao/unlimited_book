package com.flipbook.ai.flipbook.migrated.components.settingspage

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.flipbook.migrated.api.promptStylesApi
import com.flipbook.ai.flipbook.migrated.components.common.AppBottomActions
import com.google.gson.JsonObject
import kotlinx.coroutines.launch

private data class StyleItem(
    val id: String,
    val name: String,
)

/** 对应 WebView: components/SettingsPage/PromptStyleTab.jsx */
@Composable
fun PromptStyleTab(
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()

    var styles by remember { mutableStateOf<List<StyleItem>>(emptyList()) }
    var currentId by remember { mutableStateOf<String?>(null) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        loading = true
        runCatching { promptStylesApi.getPromptStyles(context) }
            .onSuccess { json ->
                val parsed = parsePromptStyles(json)
                styles = parsed.first
                currentId = parsed.second
                selectedId = parsed.second
            }
        loading = false
    }

    fun save() {
        val styleId = selectedId ?: return onClose()
        if (styleId == currentId) return onClose()
        scope.launch {
            saving = true
            runCatching { promptStylesApi.setStyle(context, styleId) }
                .onSuccess {
                    currentId = styleId
                    onClose()
                }
            saving = false
        }
    }

    Column(
        modifier = modifier.fillMaxSize(),
    ) {
        if (loading) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("加载中...", color = SettingsPageStyle.TextMuted, fontSize = 13.sp)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .heightIn(min = 0.dp)
                    .padding(top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (styles.isEmpty()) {
                    item {
                        Text(
                            text = "暂无可用风格，请联系管理员配置",
                            color = SettingsPageStyle.TextMuted,
                            fontSize = 13.sp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 40.dp),
                        )
                    }
                }

                items(styles, key = { it.id }) { style ->
                    val selected = selectedId == style.id
                    val isCurrent = currentId == style.id

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                if (selected) SettingsPageStyle.RowActiveBg else Color.Transparent,
                                RoundedCornerShape(12.dp),
                            )
                            .border(
                                width = 1.dp,
                                color = if (selected) SettingsPageStyle.RowActiveBorder else Color.Transparent,
                                shape = RoundedCornerShape(12.dp),
                            )
                            .clickable { selectedId = style.id }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .background(if (selected) SettingsPageStyle.TabActive else Color.Transparent, CircleShape)
                                .border(
                                    width = 2.dp,
                                    color = if (selected) SettingsPageStyle.TabActive else Color(0x40FFFFFF),
                                    shape = CircleShape,
                                )
                                .padding(2.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (selected) {
                                Icon(Icons.Rounded.Check, contentDescription = null, tint = Color.White, modifier = Modifier.padding(1.dp))
                            } else {
                                Box(modifier = Modifier.padding(6.dp))
                            }
                        }

                        Text(
                            text = style.name,
                            color = SettingsPageStyle.TextMain,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier
                                .weight(1f)
                                .padding(start = 10.dp),
                        )

                        if (isCurrent) {
                            Text(
                                text = "当前",
                                color = SettingsPageStyle.CurrentTagText,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier
                                    .background(SettingsPageStyle.CurrentTagBg, RoundedCornerShape(4.dp))
                                    .padding(horizontal = 6.dp, vertical = 1.dp),
                            )
                        }
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

        AppBottomActions(
            cancelText = "取消",
            confirmText = if (saving) "保存中..." else "确认",
            onCancel = onClose,
            onConfirm = ::save,
            confirmEnabled = !saving && !selectedId.isNullOrBlank(),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 14.dp, bottom = 24.dp),
        )
    }
}

private fun parsePromptStyles(json: JsonObject): Pair<List<StyleItem>, String?> {
    val arr = json.getAsJsonArray("promptStyles") ?: json.getAsJsonArray("styles")
    val styles = arr?.mapNotNull { el ->
        if (!el.isJsonObject) return@mapNotNull null
        val obj = el.asJsonObject
        val id = obj.stringOrNull("id") ?: obj.stringOrNull("promptStyleId") ?: return@mapNotNull null
        val name = obj.stringOrNull("name") ?: obj.stringOrNull("promptStyleName") ?: "未命名风格"
        StyleItem(id = id, name = name)
    } ?: emptyList()
    val current = json.stringOrNull("currentPromptStyleId")
        ?: json.stringOrNull("currentStyleId")
        ?: json.getAsJsonObject("currentStyle")?.stringOrNull("id")
    return styles to current
}

private fun JsonObject.stringOrNull(key: String): String? {
    val node = get(key) ?: return null
    if (node.isJsonNull) return null
    return runCatching { node.asString }.getOrNull()
}

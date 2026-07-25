package com.flipbook.ai.flipbook.migrated.components.common

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.agreementsApi
import com.flipbook.ai.flipbook.migrated.components.settingspage.SettingsPageStyle
import kotlinx.coroutines.launch

data class AgreementDialogTarget(
    val name: String,
    val fallbackTitle: String,
)

@Composable
fun AgreementDialog(
    target: AgreementDialogTarget?,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (target == null) return

    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    var title by remember(target.name) { mutableStateOf(target.fallbackTitle) }
    var content by remember(target.name) { mutableStateOf("") }
    var error by remember(target.name) { mutableStateOf("") }
    var loading by remember(target.name) { mutableStateOf(true) }
    var read by remember(target.name) { mutableStateOf(isAgreementRead(context, target.name)) }

    LaunchedEffect(target.name) {
        loading = true
        error = ""
        content = ""
        runCatching { agreementsApi.get(context, target.name) }
            .onSuccess { json ->
                val agreement = json.getAsJsonObject("agreement")
                title = agreement?.get("title")?.takeIf { !it.isJsonNull }?.asString ?: target.fallbackTitle
                content = agreement?.get("content")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            }
            .onFailure { err ->
                error = err.message ?: "获取协议失败"
            }
        loading = false
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xF2000000)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0B1020)),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 28.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = title,
                    color = SettingsPageStyle.TextStrong,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(Color(0x16FFFFFF))
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = "关闭", tint = SettingsPageStyle.TextSoft)
                }
            }

            Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                    .padding(horizontal = 22.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF0B1220))
                    .padding(horizontal = 20.dp, vertical = 18.dp),
            ) {
                when {
                    loading -> Text("加载协议中...", color = SettingsPageStyle.TextMuted, fontSize = 14.sp)
                    error.isNotBlank() -> Text(error, color = Color(0xFFFCA5A5), fontSize = 14.sp)
                    else -> RichText(
                        content = content,
                        color = SettingsPageStyle.TextMain,
                        textSizeSp = 16f,
                        modifier = Modifier.verticalScroll(rememberScrollState()),
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 28.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(modifier = Modifier.weight(1f))
                Row(
                    modifier = Modifier
                        .width(172.dp)
                        .height(38.dp)
                        .clip(CircleShape)
                        .background(Color(0x0DFFFFFF))
                        .clickable {
                            val next = !read
                            read = next
                            scope.launch { setAgreementRead(context, target.name, next) }
                        }
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        imageVector = if (read) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked,
                        contentDescription = null,
                        tint = if (read) Color(0xFF73D13D) else SettingsPageStyle.TextMuted,
                    )
                    Text(
                        text = if (read) "已阅读该协议" else "标记为已阅读",
                        color = if (read) Color(0xFF73D13D) else SettingsPageStyle.TextSoft,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                Box(
                    modifier = Modifier
                        .width(112.dp)
                        .height(38.dp)
                        .clip(CircleShape)
                        .background(SettingsPageStyle.PrimaryBtnGradient)
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("关闭", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

fun isAgreementRead(context: Context, name: String): Boolean {
    return context.getSharedPreferences("agreement_read_state", Context.MODE_PRIVATE)
        .getBoolean(name, false)
}

private fun setAgreementRead(context: Context, name: String, read: Boolean) {
    context.getSharedPreferences("agreement_read_state", Context.MODE_PRIVATE)
        .edit()
        .putBoolean(name, read)
        .apply()
}

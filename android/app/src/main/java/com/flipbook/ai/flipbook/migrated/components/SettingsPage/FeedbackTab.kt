package com.flipbook.ai.flipbook.migrated.components.settingspage

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.ticketsApi
import kotlinx.coroutines.launch

/** 问题反馈 Tab — 对应 WebView: components/SettingsPage/FeedbackTab.jsx */
@Composable
fun FeedbackTab(modifier: Modifier = Modifier) {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()

    var content by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }

    val canSubmit = content.isNotBlank() && !submitting && !submitted

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // 说明文字
        Text(
            text = "遇到问题或有改善建议？请告诉我们，我们会尽快处理。",
            color = SettingsPageStyle.TextSoft,
            fontSize = 12.sp,
            lineHeight = 18.sp,
        )

        // 输入框
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(SettingsPageStyle.RowBg),
        ) {
            BasicTextField(
                value = content,
                onValueChange = {
                    content = it
                    errorMsg = ""
                },
                enabled = !submitting && !submitted,
                textStyle = TextStyle(
                    color = SettingsPageStyle.TextMain,
                    fontSize = 13.sp,
                    lineHeight = 20.sp,
                ),
                cursorBrush = SolidColor(SettingsPageStyle.TabActive),
                decorationBox = { inner ->
                    Box(modifier = Modifier.padding(14.dp)) {
                        if (content.isEmpty()) {
                            Text(
                                "请描述您遇到的问题，或提出功能建议……",
                                color = Color(0x44FFFFFF),
                                fontSize = 13.sp,
                            )
                        }
                        inner()
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp, max = 240.dp),
            )
        }

        // 错误提示
        if (errorMsg.isNotBlank()) {
            Text(
                text = errorMsg,
                color = Color(0xFFF87171),
                fontSize = 11.sp,
            )
        }

        // 提交成功提示
        if (submitted) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    imageVector = Icons.Rounded.CheckCircle,
                    contentDescription = null,
                    tint = Color(0xFF4ADE80),
                    modifier = Modifier.size(28.dp),
                )
                Text(
                    "反馈已提交，感谢您的建议！",
                    color = Color(0xFF4ADE80),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        // 提交按钮
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(
                    if (canSubmit) SettingsPageStyle.TabActive else SettingsPageStyle.TabActive.copy(alpha = 0.3f)
                )
                .clickable(
                    enabled = canSubmit,
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                ) {
                    scope.launch {
                        submitting = true
                        errorMsg = ""
                        runCatching { ticketsApi.create(context, content) }
                            .onSuccess { submitted = true; content = "" }
                            .onFailure { errorMsg = "提交失败，请检查网络后重试" }
                        submitting = false
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            if (submitting) {
                CircularProgressIndicator(
                    color = Color.White,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                androidx.compose.foundation.layout.Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Send,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(15.dp),
                    )
                    Text(
                        text = if (submitted) "已提交" else "提交反馈",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        Spacer(Modifier.height(4.dp))
    }
}

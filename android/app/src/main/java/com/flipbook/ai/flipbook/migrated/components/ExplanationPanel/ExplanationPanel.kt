package com.flipbook.ai.flipbook.migrated.components.explanationpanel

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DragHandle
import androidx.compose.material.icons.rounded.MenuBook
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.pagesApi
import com.flipbook.ai.flipbook.migrated.components.common.RichText

private val memCache = mutableStateMapOf<String, String>()

/** 对应 WebView: components/ExplanationPanel/ExplanationPanel.jsx */
@Composable
fun ExplanationPanel(
    open: Boolean,
    pageId: String?,
    pageTitle: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!open || pageId.isNullOrBlank()) return
    val context = LocalContext.current.applicationContext
    var content by remember(pageId) { mutableStateOf("") }
    var loading by remember(pageId) { mutableStateOf(false) }
    var error by remember(pageId) { mutableStateOf("") }

    LaunchedEffect(open, pageId) {
        if (!open) return@LaunchedEffect
        val cached = getCached(context, pageId)
        if (!cached.isNullOrBlank()) {
            content = cached
            error = ""
            loading = false
            return@LaunchedEffect
        }

        loading = true
        error = ""
        content = ""
        runCatching { pagesApi.explanation(context, pageId, "zh") }
            .onSuccess { json ->
                val text = json.get("explanation")?.asString ?: ""
                content = text
                setCached(context, pageId, text)
            }
            .onFailure { err ->
                error = "解读生成失败：${err.message.orEmpty()}"
            }
        loading = false
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .padding(start = 20.dp, bottom = 90.dp)
                .fillMaxWidth(0.5f)
                .align(Alignment.BottomStart)
                .background(Color(0xF2111827), RoundedCornerShape(14.dp))
                .border(1.dp, Color(0x2FFFFFFF), RoundedCornerShape(14.dp)),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Rounded.DragHandle, contentDescription = null, tint = Color(0xFF9CA3AF))
                    Icon(Icons.Rounded.MenuBook, contentDescription = null, tint = Color(0xFF9CA3AF))
                    Text(
                        text = pageTitle.ifBlank { "书页解读" },
                        color = Color(0xFFE5E7EB),
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Icon(
                    imageVector = Icons.Rounded.Close,
                    contentDescription = "关闭",
                    tint = Color(0xFF9CA3AF),
                    modifier = Modifier.clickable(onClick = onClose),
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 200.dp, max = 620.dp)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                when {
                    loading -> {
                        Column(
                            modifier = Modifier.align(Alignment.Center),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            CircularProgressIndicator(color = Color(0xFF6366F1))
                            Text("AI 正在撰写科普解读，大约需要30s的时间…", color = Color(0xFF9CA3AF), fontSize = 12.sp)
                        }
                    }

                    error.isNotBlank() -> {
                        Text(error, color = Color(0xFFFCA5A5), fontSize = 12.sp)
                    }

                    else -> {
                        RichText(
                            content = content,
                            color = Color(0xFFE5E7EB),
                            textSizeSp = 13f,
                            modifier = Modifier.verticalScroll(rememberScrollState()),
                        )
                    }
                }
            }
        }
    }
}

private fun getCached(context: Context, pageId: String): String? {
    memCache[pageId]?.let { return it }
    val valFromDisk = context.getSharedPreferences("explanation_cache", Context.MODE_PRIVATE).getString("explanation_$pageId", null)
    if (!valFromDisk.isNullOrBlank()) memCache[pageId] = valFromDisk
    return valFromDisk
}

private fun setCached(context: Context, pageId: String, text: String) {
    memCache[pageId] = text
    if (text.length < 50_000) {
        context.getSharedPreferences("explanation_cache", Context.MODE_PRIVATE)
            .edit()
            .putString("explanation_$pageId", text)
            .apply()
    }
}

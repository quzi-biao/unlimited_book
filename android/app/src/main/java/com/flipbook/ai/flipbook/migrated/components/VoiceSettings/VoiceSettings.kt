package com.flipbook.ai.flipbook.migrated.components.voicesettings

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.voicesApi
import com.flipbook.ai.flipbook.migrated.components.common.AppBottomActions
import com.flipbook.ai.flipbook.migrated.components.settingspage.SettingsPageStyle
import com.google.gson.JsonObject
import kotlinx.coroutines.launch

data class VoiceItem(
    val voiceId: String,
    val voiceName: String,
    val description: String,
    val previewUrl: String,
)

/** 对应 WebView: components/VoiceSettings/VoiceSettings.jsx */
@Composable
fun VoiceSettings(
    open: Boolean,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!open) return

    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    var voices by remember { mutableStateOf<List<VoiceItem>>(emptyList()) }
    var currentId by remember { mutableStateOf<String?>(null) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var previewLoadingId by remember { mutableStateOf<String?>(null) }
    var previewPlayingId by remember { mutableStateOf<String?>(null) }
    var previewPlayer by remember { mutableStateOf<android.media.MediaPlayer?>(null) }

    fun stopPreview() {
        runCatching { previewPlayer?.stop() }
        runCatching { previewPlayer?.release() }
        previewPlayer = null
        previewLoadingId = null
        previewPlayingId = null
    }

    DisposableEffect(Unit) {
        onDispose { stopPreview() }
    }

    LaunchedEffect(open) {
        loading = true
        runCatching { voicesApi.list(context) }
            .onSuccess { json ->
                val parsed = parseVoices(json)
                voices = parsed.first
                currentId = parsed.second
                selectedId = parsed.second
            }
        loading = false
    }

    fun save() {
        val next = selectedId ?: return onClose()
        if (next == currentId) return onClose()
        scope.launch {
            saving = true
            runCatching { voicesApi.setVoice(context, next) }
                .onSuccess {
                    currentId = next
                    onClose()
                }
            saving = false
        }
    }

    fun preview(voice: VoiceItem) {
        if (previewLoadingId == voice.voiceId) return
        if (previewPlayingId == voice.voiceId) {
            stopPreview()
            return
        }
        scope.launch {
            stopPreview()
            previewLoadingId = voice.voiceId

            val url = if (voice.previewUrl.isNotBlank()) {
                voice.previewUrl
            } else {
                runCatching { voicesApi.preview(context, voice.voiceId) }
                    .getOrNull()
                    ?.let { res -> res.stringOrNull("url") ?: res.stringOrNull("previewUrl") }
                    .orEmpty()
            }
            if (url.isBlank()) {
                previewLoadingId = null
                return@launch
            }

            val mp = android.media.MediaPlayer()
            previewPlayer = mp
            runCatching {
                mp.setAudioAttributes(
                    android.media.AudioAttributes.Builder()
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                        .build(),
                )
                mp.setDataSource(url)
                mp.setOnPreparedListener {
                    previewLoadingId = null
                    previewPlayingId = voice.voiceId
                    it.start()
                }
                mp.setOnCompletionListener {
                    stopPreview()
                }
                mp.setOnErrorListener { _, _, _ ->
                    stopPreview()
                    true
                }
                mp.prepareAsync()
            }.onFailure {
                stopPreview()
            }
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
                if (voices.isEmpty()) {
                    item {
                        Text(
                            text = "暂无可用音色，请联系管理员启用",
                            color = SettingsPageStyle.TextMuted,
                            fontSize = 13.sp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 40.dp),
                        )
                    }
                }

                items(voices, key = { it.voiceId }) { voice ->
                    val selected = selectedId == voice.voiceId
                    val isCurrent = currentId == voice.voiceId

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
                            .clickable { selectedId = voice.voiceId }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .border(
                                    width = 2.dp,
                                    color = if (selected) SettingsPageStyle.TabActive else Color(0x40FFFFFF),
                                    shape = CircleShape,
                                )
                                .background(if (selected) SettingsPageStyle.TabActive else Color.Transparent, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (selected) {
                                Icon(Icons.Rounded.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
                            }
                        }

                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .padding(start = 10.dp),
                            verticalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = voice.voiceName.ifBlank { voice.voiceId },
                                    color = SettingsPageStyle.TextMain,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                if (isCurrent) {
                                    Text(
                                        text = "当前",
                                        color = SettingsPageStyle.CurrentTagText,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier
                                            .padding(start = 8.dp)
                                            .background(SettingsPageStyle.CurrentTagBg, RoundedCornerShape(4.dp))
                                            .padding(horizontal = 6.dp, vertical = 1.dp),
                                    )
                                }
                            }

                            if (voice.description.isNotBlank()) {
                                Text(
                                    text = voice.description,
                                    color = SettingsPageStyle.TextMuted,
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }

                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .background(
                                    when {
                                        previewPlayingId == voice.voiceId -> Color(0x1A10B981)
                                        else -> Color(0x0DFFFFFF)
                                    },
                                    CircleShape,
                                )
                                .border(
                                    width = 1.dp,
                                    color = when {
                                        previewPlayingId == voice.voiceId -> Color(0x6610B981)
                                        else -> Color(0x33FFFFFF)
                                    },
                                    shape = CircleShape,
                                )
                                .clickable { preview(voice) },
                            contentAlignment = Alignment.Center,
                        ) {
                            when {
                                previewLoadingId == voice.voiceId -> CircularProgressIndicator(
                                    color = SettingsPageStyle.TabActive,
                                    strokeWidth = 2.dp,
                                    modifier = Modifier.size(14.dp),
                                )
                                previewPlayingId == voice.voiceId -> Icon(
                                    Icons.Rounded.Pause,
                                    contentDescription = "暂停试听",
                                    tint = Color(0xFF4ADE80),
                                    modifier = Modifier.size(16.dp),
                                )
                                else -> Icon(
                                    Icons.Rounded.PlayArrow,
                                    contentDescription = "试听",
                                    tint = SettingsPageStyle.TextSoft,
                                    modifier = Modifier.size(16.dp),
                                )
                            }
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

private fun parseVoices(json: JsonObject): Pair<List<VoiceItem>, String?> {
    val voices = json.getAsJsonArray("voices")?.mapNotNull { el ->
        if (!el.isJsonObject) return@mapNotNull null
        val obj = el.asJsonObject
        val id = obj.stringOrNull("voiceId") ?: return@mapNotNull null
        VoiceItem(
            voiceId = id,
            voiceName = obj.stringOrNull("voiceName").orEmpty(),
            description = obj.stringOrNull("description").orEmpty(),
            previewUrl = obj.stringOrNull("previewUrl").orEmpty(),
        )
    } ?: emptyList()
    return voices to json.stringOrNull("currentVoiceId")
}

private fun JsonObject.stringOrNull(key: String): String? {
    val node = get(key) ?: return null
    if (node.isJsonNull) return null
    return runCatching { node.asString }.getOrNull()
}

package com.flipbook.ai.flipbook.migrated.components.otaupdate

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class OtaUpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val changelog: String = "",
    val forceUpgrade: Boolean = false,
)

data class OtaBadgeState(
    val update: OtaUpdateInfo?,
    val phase: String = "idle", // idle | downloading | installing | done | error
    val progress: Int = 0,
)

/** 对应 WebView: components/OtaUpdate/OtaUpdate.jsx */
@Composable
fun OtaBadge(
    state: OtaBadgeState,
    onUpdate: () -> Unit,
    onRestart: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val update = state.update ?: return
    val isDownloading = state.phase == "downloading"
    val isInstalling = state.phase == "installing"
    val isDone = state.phase == "done"
    val isError = state.phase == "error"
    val disabled = isDownloading || isInstalling

    val border = when {
        isError -> OtaBadgeStyle.ErrorBorder
        isDone -> OtaBadgeStyle.DoneBorder
        else -> OtaBadgeStyle.IdleBorder
    }
    val bg = when {
        isError -> OtaBadgeStyle.ErrorBg
        isDone -> OtaBadgeStyle.DoneBg
        else -> OtaBadgeStyle.IdleBg
    }
    val fg = when {
        isError -> OtaBadgeStyle.ErrorText
        isDone -> OtaBadgeStyle.DoneText
        else -> OtaBadgeStyle.IdleText
    }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(0.dp)) {
        Row(
            modifier = Modifier
                .height(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(bg)
                .border(1.dp, border, RoundedCornerShape(10.dp))
                .clickable(enabled = !disabled, onClick = { if (isDone) onRestart() else onUpdate() })
                .padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            when {
                isDownloading -> {
                    Icon(Icons.Rounded.Download, contentDescription = null, tint = fg, modifier = Modifier.size(12.dp))
                    Text("${state.progress.coerceIn(0, 100)}%", color = fg, fontSize = 12.sp)
                }

                isInstalling -> {
                    val rotation = rememberInfiniteTransition(label = "ota-spin").animateFloat(
                        initialValue = 0f,
                        targetValue = 360f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(900, easing = LinearEasing),
                            repeatMode = RepeatMode.Restart,
                        ),
                        label = "ota-spin-value",
                    )
                    Icon(
                        Icons.Rounded.Refresh,
                        contentDescription = null,
                        tint = fg,
                        modifier = Modifier
                            .size(12.dp)
                            .rotate(rotation.value),
                    )
                    Text("安装中", color = fg, fontSize = 12.sp)
                }

                else -> {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(if (isError) OtaBadgeStyle.ErrorText else OtaBadgeStyle.IdleText),
                    )
                    Text(if (isError) "更新重试" else "版本更新", color = fg, fontSize = 12.sp)
                }
            }
        }
    }
}

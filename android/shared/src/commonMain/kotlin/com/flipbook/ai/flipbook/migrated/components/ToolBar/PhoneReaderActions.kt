package com.flipbook.ai.flipbook.migrated.components.toolbar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.MonetizationOn
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController
import com.flipbook.ai.flipbook.migrated.components.ttsplayer.TtsPlayerUiState

/** 朗读入口始终保留在底栏，账户操作独立显示于右上角。 */
@Composable
fun PhoneReaderActions(
    state: TtsPlayerUiState,
    enabled: Boolean,
    onPlayback: () -> Unit,
) {
    val guide = LocalGuideController.current
    val loading = state.playbackState == "loading"
    val playing = state.playbackState == "playing"
    val paused = state.playbackState == "paused"
    val error = state.playbackState == "error"
    val label = when { loading -> "正在准备朗读"; playing -> "暂停朗读"; paused -> "继续朗读"; error -> "重试朗读"; else -> "开始朗读" }
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        val playbackIcon = when { playing -> Icons.Rounded.Pause; paused -> Icons.Rounded.PlayArrow; error -> Icons.Rounded.Refresh; else -> Icons.AutoMirrored.Rounded.VolumeUp }
        ActionButton(
            playbackIcon, label, onPlayback, enabled = enabled && !loading,
            modifier = Modifier.onGloballyPositioned { guide?.registerTarget("toolbar_play_btn", it.boundsInRoot()) },
            active = playing || paused, loading = loading,
        )
    }
}

/** 余额、充值与设置各自使用独立胶囊，保留 48dp 触控区域。 */
@Composable
fun PhoneReaderAccount(balance: Int, onRecharge: () -> Unit, onSettings: () -> Unit) {
    val guide = LocalGuideController.current
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.heightIn(min = 48.dp).phoneHeaderChrome()
            .semantics(mergeDescendants = true) { contentDescription = "学习点数余额 $balance" }
            .padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
            Text("$balance", color = Color(0xFFF0C060), fontSize = 13.sp, maxLines = 1)
        }
        Row(Modifier.heightIn(min = 48.dp).phoneHeaderChrome()
            .onGloballyPositioned { guide?.registerTarget("wallet_btn", it.boundsInRoot()) }
            .clickable(role = Role.Button, onClick = onRecharge).padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.MonetizationOn, contentDescription = null, tint = Color(0xFFF0C060), modifier = Modifier.size(17.dp))
            Text("充值", color = Color(0xFFF0C060), fontSize = 13.sp)
        }
        ActionButton(Icons.Rounded.Settings, "设置", onSettings,
            modifier = Modifier.onGloballyPositioned { guide?.registerTarget("settings_btn", it.boundsInRoot()) })
    }
}

/** 触控区域不随播放状态改变，准备音频时防止重复请求。 */
@Composable
private fun ActionButton(
    icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier,
    enabled: Boolean = true, active: Boolean = false, loading: Boolean = false,
) {
    Box(
        modifier.size(48.dp).semantics(mergeDescendants = true) { contentDescription = label }.phoneHeaderChrome()
            .background(if (active) Color(0xFF4F46E5) else Color.Transparent)
            .clickable(enabled = enabled, role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(21.dp), color = Color(0xFFB9BDFF), strokeWidth = 2.dp)
        else Icon(icon, contentDescription = null, tint = if (enabled) Color(0xFFE8EAF0) else Color(0xFF686C7F), modifier = Modifier.size(21.dp))
    }
}

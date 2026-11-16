package com.flipbook.ai.flipbook.migrated.components.settingspage

import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.utils.findActivity
import com.flipbook.ai.flipbook.migrated.utils.openPhoneNetworkSettings

/** 网络连接交给手机系统处理，支持 WiFi 和移动网络。 */
@Composable
internal fun PhoneNetworkSettings() {
    val context = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("使用 WiFi 或移动网络连接。", color = SettingsPageStyle.TextSoft)
        Button(onClick = { openPhoneNetworkSettings(context) }) { Text("打开网络设置") }
    }
}

/** 手机仅调节当前阅读窗口亮度，离开应用后不影响系统亮度。 */
@Composable
internal fun PhoneBrightnessSettings() {
    val context = LocalContext.current
    val activity = context.findActivity()
    var brightness by remember(activity) {
        val windowValue = activity?.window?.attributes?.screenBrightness ?: -1f
        val systemValue = Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128) / 255f
        mutableFloatStateOf(if (windowValue >= 0f) windowValue else systemValue)
    }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("阅读亮度 ${(brightness * 100).toInt()}%", color = SettingsPageStyle.TextMain)
        Slider(value = brightness, onValueChange = {
            brightness = it
            activity?.window?.let { window ->
                window.attributes = window.attributes.apply { screenBrightness = it }
            }
        }, valueRange = 0.05f..1f, modifier = Modifier.fillMaxWidth())
        Text("仅调整当前阅读界面，退出应用后恢复系统亮度。", color = SettingsPageStyle.TextMuted)
    }
}

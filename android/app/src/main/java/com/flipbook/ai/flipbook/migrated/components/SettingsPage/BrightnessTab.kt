package com.flipbook.ai.flipbook.migrated.components.settingspage

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.utils.DeviceControl
import com.flipbook.ai.flipbook.migrated.utils.findActivity
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 对应 WebView: components/SettingsPage/BrightnessTab.jsx */
@Composable
fun BrightnessTab(
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val scope = rememberCoroutineScope()
    var pct by remember { mutableFloatStateOf(50f) }
    var loading by remember { mutableStateOf(true) }
    var applying by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf("") }
    var applyJob by remember { mutableStateOf<Job?>(null) }

    fun pctToRaw(value: Float): Int = (((value.coerceIn(1f, 100f) / 100f) * 254f) + 1f).toInt()
    fun rawToPct(value: Int): Float = (((value.coerceIn(1, 255) - 1).toFloat() / 254f) * 100f)

    fun applyBrightness(next: Float) {
        pct = next.coerceIn(1f, 100f)
        applyJob?.cancel()
        applyJob = scope.launch {
            delay(350)
            applying = true
            val (ok, finalRaw) = DeviceControl.setBrightness(context, activity, pctToRaw(pct))
            pct = rawToPct(finalRaw)
            msg = if (ok) "亮度已设置为 ${pct.toInt()}%" else "系统亮度写入失败，仅应用内已生效"
            applying = false
        }
    }

    LaunchedEffect(Unit) {
        loading = true
        val status = DeviceControl.getBrightness(context)
        pct = rawToPct(status.brightness)
        loading = false
    }

    if (loading) {
        Column(
            modifier = modifier.fillMaxWidth().padding(top = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            CircularProgressIndicator(color = SettingsPageStyle.TabActive, strokeWidth = 2.dp)
            Text("读取亮度中...", color = SettingsPageStyle.TextMuted, fontSize = 12.sp)
        }
        return
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("屏幕亮度", color = SettingsPageStyle.TextMain, fontSize = 13.sp)
            if (applying) {
                CircularProgressIndicator(color = SettingsPageStyle.TabActive, strokeWidth = 2.dp, modifier = Modifier.height(14.dp))
            } else {
                Text("${pct.toInt()}%", color = SettingsPageStyle.TextSoft, fontSize = 13.sp)
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(Color(0x1AFFFFFF), RoundedCornerShape(999.dp)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(pct / 100f)
                    .height(8.dp)
                    .background(SettingsPageStyle.TabActive, RoundedCornerShape(999.dp)),
            )
        }

        Slider(
            value = pct,
            onValueChange = { applyBrightness(it) },
            valueRange = 1f..100f,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(20f, 40f, 70f, 100f).forEach { quick ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(34.dp)
                        .background(
                            if ((pct - quick).let { kotlin.math.abs(it) } < 1f) Color(0x2FA78BFA) else Color(0x14FFFFFF),
                            RoundedCornerShape(8.dp),
                        )
                        .clickable { applyBrightness(quick) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("${quick.toInt()}%", color = SettingsPageStyle.TextMain, fontSize = 12.sp)
                }
            }
        }

        Text(
            text = if (msg.isBlank()) "调节滑块即可改变屏幕亮度，设置将立即生效并保存。" else msg,
            color = SettingsPageStyle.TextMuted,
            fontSize = 11.sp,
        )
    }
}

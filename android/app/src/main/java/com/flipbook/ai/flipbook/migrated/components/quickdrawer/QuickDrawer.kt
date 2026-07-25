package com.flipbook.ai.flipbook.migrated.components.quickdrawer

import android.app.Activity
import android.content.Context
import android.content.IntentFilter
import android.media.AudioManager
import android.os.BatteryManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.AccountBalanceWallet
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.BatteryFull
import androidx.compose.material.icons.rounded.ElectricBolt
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.WbSunny
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.input.pointer.motionEventSpy
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.pointerInteropFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.util.Calendar

// ─── 颜色 ─────────────────────────────────────────────────────────────────────
private val DrawerBg      = Color(0xF0101020)
private val SurfaceItem   = Color(0x1AFFFFFF)
private val TextPrimary   = Color(0xFFFFFFFF)
private val TextSecondary = Color(0x99FFFFFF)
private val AccentYellow  = Color(0xFFFFD966)
private val AccentBlue    = Color(0xFF64B5FF)
private val BatteryGreen  = Color(0xFF6BCB77)
private val BatteryOrange = Color(0xFFFFB347)
private val BatteryRed    = Color(0xFFFF6B6B)

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 格式化当前时间为 HH:mm */
private fun formatCurrentTime(): String {
    val cal = Calendar.getInstance()
    return "%02d:%02d".format(cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
}

/** 格式化当前日期为 M月d日 周X */
private fun formatCurrentDate(): String {
    val cal = Calendar.getInstance()
    val weekDays = arrayOf("日", "一", "二", "三", "四", "五", "六")
    val dow = cal.get(Calendar.DAY_OF_WEEK) - 1  // 0=日
    return "${cal.get(Calendar.MONTH) + 1}月${cal.get(Calendar.DAY_OF_MONTH)}日 周${weekDays[dow]}"
}

/** 判断设备是否正在充电 */
private fun readIsCharging(context: Context): Boolean {
    val intent = context.registerReceiver(
        null, IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED)
    ) ?: return false
    val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
    return status == BatteryManager.BATTERY_STATUS_CHARGING ||
           status == BatteryManager.BATTERY_STATUS_FULL
}

/** 读取电量百分比（0‑100），读取失败返回 -1 */
private fun readBattery(context: Context): Int {
    val intent = context.registerReceiver(
        null, IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED)
    ) ?: return -1
    val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
    return if (level >= 0 && scale > 0) level * 100 / scale else -1
}

/** 读取媒体音量比例（0f‑1f） */
private fun readVolume(context: Context): Float {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    val cur = am.getStreamVolume(AudioManager.STREAM_MUSIC)
    return if (max > 0) cur.toFloat() / max else 0f
}

/** 设置媒体音量，fraction ∈ [0f, 1f] */
private fun setVolume(context: Context, fraction: Float) {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    am.setStreamVolume(AudioManager.STREAM_MUSIC, (fraction * max).toInt().coerceIn(0, max), 0)
}

/** 读取当前 Window 亮度（0f‑1f），未设置时返回 0.7f */
private fun readWindowBrightness(context: Context): Float {
    val br = (context as? Activity)?.window?.attributes?.screenBrightness ?: -1f
    return if (br < 0f) 0.7f else br
}

/** 设置 Window 亮度（不需要 WRITE_SETTINGS 权限，仅影响本应用） */
private fun setWindowBrightness(context: Context, fraction: Float) {
    val activity = context as? Activity ?: return
    val lp = activity.window.attributes
    lp.screenBrightness = fraction.coerceIn(0.01f, 1f)
    activity.window.attributes = lp
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

/**
 * 右上角快捷控制抽屉。
 *
 * 触发手势（两种方式）：
 *  1. 在屏幕右上角（右侧 40%，顶部 56dp）向下滑动 ≥ 50px
 *  2. 从屏幕右侧边缘（右侧 22dp 宽条带）向左滑动 ≥ 60px
 *
 * 两种手势均使用 requireUnconsumed=false，确保 Viewport 消费触摸后仍可触发。
 *
 * @param studyPoints    学习点数，由父级传入
 * @param onOpenSettings 打开设置页回调
 * @param onOpenRecharge 打开点数充值页回调
 * @param enabled        是否启用手势检测。覆盖层（设置页/商店页）打开时传 false 避免热区拦截内层点击
 */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
fun QuickDrawer(
    studyPoints: Int,
    onOpenSettings: () -> Unit,
    onOpenRecharge: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
) {
    var isOpen    by remember { mutableStateOf(false) }
    val context   = LocalContext.current
    val density   = LocalDensity.current
    // 预计算像素阈値，避免在 PointerInputScope 里调用 .dp.toPx()
    val swipeDownThresholdPx = with(density) { 50.dp.toPx() }
    val swipeLeftThresholdPx = with(density) { 60.dp.toPx() }

    var brightness by remember { mutableStateOf(readWindowBrightness(context)) }
    var volume     by remember { mutableStateOf(readVolume(context)) }
    var battery    by remember { mutableStateOf(readBattery(context)) }
    var isCharging by remember { mutableStateOf(readIsCharging(context)) }
    var timeStr    by remember { mutableStateOf(formatCurrentTime()) }
    var dateStr    by remember { mutableStateOf(formatCurrentDate()) }
    // 手势起始位置（普通 var，在 pointerInteropFilter 回调里更新）
    var z1StartY   = 0f
    var z2StartX   = 0f

    // 面板打开时每 20 秒刷新时间
    LaunchedEffect(isOpen) {
        if (!isOpen) return@LaunchedEffect
        while (true) {
            timeStr = formatCurrentTime()
            delay(20_000L)
        }
    }

    Box(modifier = modifier.fillMaxSize()) {

        // ── Zone 1：右上角下划热区（右侧 40%，顶部 56dp，向下滑 ≥ 50dp）────
        Box(
            modifier = Modifier
                .fillMaxWidth(0.4f)
                .height(56.dp)
                .align(Alignment.TopEnd)
                .pointerInteropFilter { event ->
                    if (!enabled) return@pointerInteropFilter false  // 覆盖层打开时直接放行
                    when (event.action) {
                        android.view.MotionEvent.ACTION_DOWN -> {
                            // 记录手指起始位置
                            z1StartY = event.y
                            true  // 要求接收后续事件
                        }
                        android.view.MotionEvent.ACTION_MOVE -> {
                            if (!isOpen && event.y - z1StartY > swipeDownThresholdPx) {
                                battery    = readBattery(context)
                                isCharging = readIsCharging(context)
                                timeStr    = formatCurrentTime()
                                dateStr    = formatCurrentDate()
                                volume     = readVolume(context)
                                brightness = readWindowBrightness(context)
                                isOpen     = true
                            }
                            false
                        }
                        else -> false
                    }
                },
        )

        // ── Zone 2：右侧边缘左划热区（右侧 22dp 宽条带，向左滑 ≥ 60dp）────
        Box(
            modifier = Modifier
                .width(22.dp)
                .fillMaxHeight()
                .align(Alignment.CenterEnd)
                .pointerInteropFilter { event ->
                    if (!enabled) return@pointerInteropFilter false  // 覆盖层打开时直接不拦截
                    when (event.action) {
                        android.view.MotionEvent.ACTION_DOWN -> {
                            z2StartX = event.x
                            true
                        }
                        android.view.MotionEvent.ACTION_MOVE -> {
                            if (!isOpen && z2StartX - event.x > swipeLeftThresholdPx) {
                                battery    = readBattery(context)
                                isCharging = readIsCharging(context)
                                timeStr    = formatCurrentTime()
                                dateStr    = formatCurrentDate()
                                volume     = readVolume(context)
                                brightness = readWindowBrightness(context)
                                isOpen     = true
                            }
                            false
                        }
                        else -> false
                    }
                },
        )

        // ── 背景遮罩 ────────────────────────────────────────────────
        AnimatedVisibility(
            visible = isOpen,
            enter = fadeIn(tween(200)),
            exit  = fadeOut(tween(200)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0x66000000))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = { isOpen = false },
                    ),
            )
        }

        // ── 抽屉面板 ────────────────────────────────────────────────
        AnimatedVisibility(
            visible = isOpen,
            enter = slideInVertically(tween(320)) { -it } + fadeIn(tween(280)),
            exit  = slideOutVertically(tween(280)) { -it } + fadeOut(tween(200)),
            modifier = Modifier.align(Alignment.TopEnd),
        ) {
            QuickDrawerContent(
                timeStr    = timeStr,
                dateStr    = dateStr,
                battery    = battery,
                isCharging = isCharging,
                studyPoints = studyPoints,
                brightness  = brightness,
                volume      = volume,
                onBrightnessChange = { v ->
                    brightness = v
                    setWindowBrightness(context, v)
                },
                onVolumeChange = { v ->
                    volume = v
                    setVolume(context, v)
                },
                onSettings = { isOpen = false; onOpenSettings() },
                onRecharge = { isOpen = false; onOpenRecharge() },
            )
        }
    }
}

// ─── 面板内容 ─────────────────────────────────────────────────────────────────

@Composable
private fun QuickDrawerContent(
    timeStr: String,
    dateStr: String,
    battery: Int,
    isCharging: Boolean,
    studyPoints: Int,
    brightness: Float,
    volume: Float,
    onBrightnessChange: (Float) -> Unit,
    onVolumeChange: (Float) -> Unit,
    onSettings: () -> Unit,
    onRecharge: () -> Unit,
) {
    Column(
        modifier = Modifier
            .width(300.dp)
            .clip(RoundedCornerShape(bottomStart = 20.dp))
            .background(DrawerBg)
            .padding(horizontal = 18.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // 状态行：时间 + 电量 + 点数
        StatusRow(
            timeStr    = timeStr,
            dateStr    = dateStr,
            battery    = battery,
            isCharging = isCharging,
            studyPoints = studyPoints,
        )

        HorizontalDivider(color = Color(0x1AFFFFFF), thickness = 1.dp)

        // 亮度控制
        ControlSliderRow(
            icon       = Icons.Rounded.WbSunny,
            label      = "屏幕亮度",
            value      = brightness,
            trackColor = AccentYellow,
            onChange   = onBrightnessChange,
        )

        // 音量控制
        ControlSliderRow(
            icon       = Icons.AutoMirrored.Rounded.VolumeUp,
            label      = "媒体音量",
            value      = volume,
            trackColor = AccentBlue,
            onChange   = onVolumeChange,
        )

        HorizontalDivider(color = Color(0x1AFFFFFF), thickness = 1.dp)

        // 快捷入口按钮
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            EntryButton(
                icon    = Icons.Rounded.Settings,
                label   = "系统设置",
                onClick = onSettings,
                modifier = Modifier.weight(1f),
            )
            EntryButton(
                icon    = Icons.Rounded.AccountBalanceWallet,
                label   = "点数充值",
                onClick = onRecharge,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

// ─── 状态行 ───────────────────────────────────────────────────────────────────

@Composable
private fun StatusRow(
    timeStr: String,
    dateStr: String,
    battery: Int,
    isCharging: Boolean,
    studyPoints: Int,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // 时间 + 日期
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text          = timeStr,
                color         = TextPrimary,
                fontSize      = 28.sp,
                fontWeight    = FontWeight.Bold,
                letterSpacing = 1.sp,
                lineHeight    = 30.sp,
            )
            Text(
                text       = dateStr,
                color      = TextSecondary,
                fontSize   = 11.sp,
                fontWeight = FontWeight.Normal,
            )
        }

        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            // 电量 + 充电状态
            val batteryColor = when {
                battery < 0   -> TextSecondary
                battery <= 20 -> BatteryRed
                battery <= 50 -> BatteryOrange
                else          -> BatteryGreen
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                // 充电中：闪电图标（绿色）
                if (isCharging) {
                    Icon(
                        Icons.Rounded.ElectricBolt,
                        contentDescription = "充电中",
                        tint = BatteryGreen,
                        modifier = Modifier.size(13.dp),
                    )
                }
                Icon(
                    Icons.Rounded.BatteryFull,
                    contentDescription = null,
                    tint = batteryColor,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    text       = if (battery >= 0) "$battery%" else "--",
                    color      = batteryColor,
                    fontSize   = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            // 学习点数
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Icon(Icons.Rounded.AutoAwesome, contentDescription = null,
                    tint = AccentYellow, modifier = Modifier.size(14.dp))
                Text(
                    text     = "%,d 点".format(studyPoints),
                    color    = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

// ─── 滑块控制行 ───────────────────────────────────────────────────────────────

@Composable
private fun ControlSliderRow(
    icon: ImageVector,
    label: String,
    value: Float,
    trackColor: Color,
    onChange: (Float) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // 图标背景圆角方块
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(SurfaceItem),
        ) {
            Icon(icon, contentDescription = null, tint = trackColor, modifier = Modifier.size(18.dp))
        }

        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = label, color = TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            Slider(
                value = value,
                onValueChange = onChange,
                modifier = Modifier.height(28.dp),
                colors = SliderDefaults.colors(
                    thumbColor            = Color.White,
                    activeTrackColor      = trackColor,
                    inactiveTrackColor    = Color(0x33FFFFFF),
                ),
            )
        }
    }
}

// ─── 快捷入口按钮 ─────────────────────────────────────────────────────────────

@Composable
private fun EntryButton(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        color = SurfaceItem,
        modifier = modifier,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(vertical = 14.dp, horizontal = 10.dp),
        ) {
            Icon(icon, contentDescription = label, tint = TextPrimary, modifier = Modifier.size(20.dp))
            Text(text = label, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
    }
}

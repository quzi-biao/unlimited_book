package com.flipbook.ai.flipbook.migrated.components.ttsplayer

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.layout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.common.GuideController
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import kotlinx.coroutines.delay
import kotlin.math.floor
import com.flipbook.ai.flipbook.migrated.components.common.LocalCompactLayout
import com.flipbook.ai.flipbook.migrated.components.common.LocalPhoneLayout
import com.flipbook.ai.flipbook.migrated.components.common.PhoneReaderToolbarHeight
import com.flipbook.ai.flipbook.migrated.components.common.PhoneReaderToolbarBottomInset

private const val COLLAPSE_MS = 260L

data class TtsPlayerUiState(
    val playbackState: String = "idle", // idle/loading/playing/paused/error
    val rate: Float = 1f,
    val currentTimeSec: Float = 0f,
    val durationSec: Float = 0f,
    val bookTitle: String = "",
    val pageTitle: String = "",
    val annotationMode: Boolean = false,
    val sourcePageId: String? = null,
)

/** 对应 WebView: components/TtsPlayer/TtsPlayer.jsx */
@Composable
fun TtsPlayer(
    pageVisible: Boolean,
    state: TtsPlayerUiState,
    onRoundClick: () -> Unit,
    onPlayPause: () -> Unit,
    onSeek: (Float) -> Unit,
    onRateToggle: () -> Unit,
    onGoToPage: ((String) -> Unit)? = null,
    /** 操作引导控制器，用于将圆形播放按键的30准边界注册到引导系统 */
    guideController: GuideController? = null,
    modifier: Modifier = Modifier,
    showRoundButton: Boolean = true,
) {
    if (!pageVisible) return
    val compact = LocalCompactLayout.current
    val phone = LocalPhoneLayout.current

    val isLoading = state.playbackState == "loading"
    val isPlaying = state.playbackState == "playing"
    val isPaused = state.playbackState == "paused"
    val isError = state.playbackState == "error"

    var expanded by remember { mutableStateOf(false) }
    var collapsing by remember { mutableStateOf(false) }
    var pillEntered by remember { mutableStateOf(false) }

    val pillAlpha by animateFloatAsState(
        targetValue = when {
            collapsing -> 0f
            pillEntered -> 1f
            else -> 0f
        },
        animationSpec = tween(
            durationMillis = if (collapsing) 260 else 280,
            easing = if (collapsing) CubicBezierEasing(0.36f, 0f, 0.66f, -0.56f) else CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f),
        ),
        label = "tts-pill-alpha",
    )
    val pillScale by animateFloatAsState(
        targetValue = when {
            collapsing -> 0.88f
            pillEntered -> 1f
            else -> 0.88f
        },
        animationSpec = tween(
            durationMillis = if (collapsing) 260 else 280,
            easing = if (collapsing) CubicBezierEasing(0.36f, 0f, 0.66f, -0.56f) else CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f),
        ),
        label = "tts-pill-scale",
    )
    val pillOffsetY by animateFloatAsState(
        targetValue = when {
            collapsing -> 12f
            pillEntered -> 0f
            else -> 16f
        },
        animationSpec = tween(
            durationMillis = if (collapsing) 260 else 280,
            easing = if (collapsing) CubicBezierEasing(0.36f, 0f, 0.66f, -0.56f) else CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f),
        ),
        label = "tts-pill-offset",
    )

    LaunchedEffect(isPlaying, isLoading, isPaused, showRoundButton) {
        if (isPlaying || isLoading || (!showRoundButton && isPaused)) {
            collapsing = false
            expanded = true
        } else if (expanded) {
            collapsing = true
            delay(COLLAPSE_MS)
            expanded = false
            collapsing = false
        }
    }

    LaunchedEffect(expanded, collapsing) {
        if (expanded && !collapsing) {
            pillEntered = false
            withFrameNanos { }
            pillEntered = true
        } else if (!expanded) {
            pillEntered = false
        }
    }

    Box(
        modifier = modifier
            .padding(
                end = if (phone) 20.dp else 16.dp,
                bottom = if (phone) {
                    PhoneReaderToolbarBottomInset + if (expanded) PhoneReaderToolbarHeight + 10.dp else 8.dp
                } else if (compact && expanded) 136.dp else 20.dp,
            ),
        contentAlignment = Alignment.BottomEnd,
    ) {
        if (!expanded) {
            if (showRoundButton) IdleRoundButton(
                isPaused = isPaused,
                isError = isError,
                onClick = onRoundClick,
                modifier = Modifier.onGloballyPositioned { coords ->
                    // 将圆形按键的30准边界注册到引导系统
                    guideController?.registerTarget("toolbar_play_btn", coords.boundsInRoot())
                },
            )
            return@Box
        }

        val sliderMax = if (state.durationSec > 0f) state.durationSec else 100f
        val sliderValue = state.currentTimeSec.coerceIn(0f, sliderMax)
        val canSeek = state.durationSec > 0f && !isLoading
        val title = listOf(state.bookTitle, state.pageTitle).filter { it.isNotBlank() }.joinToString(" - ")
            .ifBlank { "语音播报" }
        val goToPageEnabled = onGoToPage != null && !state.sourcePageId.isNullOrBlank()

        Row(
            modifier = Modifier
                .widthIn(min = 270.dp, max = 360.dp)
                .offset(y = pillOffsetY.dp)
                .clip(RoundedCornerShape(20.dp))
                .pointerInput(Unit) {
                    detectTapGestures { }
                }
                .background(TtsPlayerStyle.PillBg)
                .border(1.dp, TtsPlayerStyle.PillBorder, RoundedCornerShape(20.dp))
                .padding(start = 18.dp, end = 8.dp, top = 10.dp, bottom = 10.dp)
                .graphicsLayer {
                    scaleX = pillScale
                    scaleY = pillScale
                    alpha = pillAlpha
                },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .then(
                            if (goToPageEnabled) {
                                Modifier.clickable { onGoToPage?.invoke(state.sourcePageId.orEmpty()) }
                            } else {
                                Modifier
                            },
                        )
                        .padding(horizontal = 4.dp, vertical = 1.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (state.annotationMode) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0x26A78BFA))
                                .border(1.dp, Color(0x59A78BFA), RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 1.dp),
                        ) {
                            Text("区域解读", color = Color(0xFFA78BFA), fontSize = 10.sp)
                        }
                    }
                    Text(
                        text = title,
                        color = TtsPlayerStyle.TrackText,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                ProgressLine(
                    value = sliderValue,
                    max = sliderMax,
                    canSeek = canSeek,
                    onSeek = onSeek,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(14.dp),
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0x12FFFFFF))
                            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(6.dp))
                            .pointerInput(Unit) {
                                detectTapGestures { onRateToggle() }
                            }
                            .padding(horizontal = 8.dp, vertical = 2.dp),
                    ) {
                        Text("${state.rate}x", color = TtsPlayerStyle.MetaText, fontSize = 11.sp)
                    }

                    Text(
                        text = if (state.durationSec > 0f) {
                            "${fmt(sliderValue)} / ${fmt(state.durationSec)}"
                        } else {
                            fmt(sliderValue)
                        },
                        color = TtsPlayerStyle.MetaDim,
                        fontSize = 11.sp,
                    )
                }
            }

            PillPlayButton(
                isLoading = isLoading,
                isPlaying = isPlaying,
                onClick = onPlayPause,
            )
        }
    }
}

@Composable
private fun ProgressLine(
    value: Float,
    max: Float,
    canSeek: Boolean,
    onSeek: (Float) -> Unit,
    modifier: Modifier = Modifier,
) {
    val ratio = if (canSeek && max > 0f) (value / max).coerceIn(0f, 1f) else 0f
    BoxWithConstraints(
        modifier = modifier
            .heightIn(min = 14.dp)
            .clip(RoundedCornerShape(99.dp))
            .pointerInput(canSeek, max) {
                if (!canSeek || max <= 0f) return@pointerInput
                detectTapGestures { offset ->
                    val width = size.width.toFloat().coerceAtLeast(1f)
                    onSeek((offset.x / width).coerceIn(0f, 1f) * max)
                }
            },
        contentAlignment = Alignment.CenterStart,
    ) {
        val thumbX = maxWidth * ratio
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(TtsPlayerStyle.SliderBg),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(ratio)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(TtsPlayerStyle.SliderFill),
        )
        Box(
            modifier = Modifier
                .offset(x = thumbX - 5.dp)
                .size(10.dp)
                .background(Color.White, CircleShape),
        )
    }
}

@Composable
private fun IdleRoundButton(
    isPaused: Boolean,
    isError: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = when {
        isError -> Brush.verticalGradient(listOf(TtsPlayerStyle.ErrorBg, TtsPlayerStyle.ErrorBg))
        isPaused -> Brush.linearGradient(listOf(TtsPlayerStyle.IdlePausedA, TtsPlayerStyle.IdlePausedB))
        else -> Brush.verticalGradient(listOf(TtsPlayerStyle.IdleBg, TtsPlayerStyle.IdleBg))
    }
    val fg = if (isPaused || isError) Color.White else TtsPlayerStyle.IdleText

    androidx.compose.material3.Surface(
        modifier = modifier.size(if (LocalPhoneLayout.current) 48.dp else 52.dp),
        shape = CircleShape,
        shadowElevation = 8.dp,
        color = Color.Transparent,
        onClick = onClick,
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(bg),
            contentAlignment = Alignment.Center,
        ) {
            when {
                isError -> Icon(Icons.AutoMirrored.Rounded.VolumeOff, contentDescription = "播放失败", tint = fg, modifier = Modifier.size(20.dp))
                isPaused -> Icon(Icons.Rounded.PlayArrow, contentDescription = "继续播放", tint = fg, modifier = Modifier.size(20.dp))
                else -> Icon(Icons.AutoMirrored.Rounded.VolumeUp, contentDescription = "语音播报", tint = fg, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun PillPlayButton(
    isLoading: Boolean,
    isPlaying: Boolean,
    onClick: () -> Unit,
) {
    val bg = when {
        isLoading -> Brush.verticalGradient(listOf(TtsPlayerStyle.LoadingBg, TtsPlayerStyle.LoadingBg))
        isPlaying -> Brush.linearGradient(listOf(TtsPlayerStyle.PlayingA, TtsPlayerStyle.PlayingB))
        else -> Brush.linearGradient(listOf(TtsPlayerStyle.PausedA, TtsPlayerStyle.PausedB))
    }
    val spin = rememberInfiniteTransition(label = "tts-spin").animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "tts-spin-angle",
    )
    androidx.compose.material3.Surface(
        modifier = Modifier.size(52.dp),
        shape = CircleShape,
        shadowElevation = 8.dp,
        color = Color.Transparent,
        onClick = { if (!isLoading) onClick() },
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(bg),
            contentAlignment = Alignment.Center,
        ) {
            when {
                isLoading -> Icon(
                    Icons.Rounded.Refresh,
                    contentDescription = "加载中",
                    tint = TtsPlayerStyle.SliderFill,
                    modifier = Modifier
                        .size(24.dp)
                        .rotate(spin.value),
                )
                isPlaying -> Icon(Icons.Rounded.Pause, contentDescription = "暂停", tint = Color.White, modifier = Modifier.size(24.dp))
                else -> Icon(Icons.Rounded.PlayArrow, contentDescription = "播放", tint = Color.White, modifier = Modifier.size(24.dp))
            }
        }
    }
}

private fun fmt(sec: Float): String {
    if (!sec.isFinite() || sec < 0f) return "--:--"
    val m = floor(sec / 60f).toInt()
    val s = floor(sec % 60f).toInt()
    return "${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
}

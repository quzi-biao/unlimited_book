package com.flipbook.ai.flipbook.migrated.components.annotations

import androidx.compose.ui.window.Dialog
import com.flipbook.ai.flipbook.migrated.components.common.LocalCompactLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Explore
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.VolumeOff
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.common.RichText
import com.flipbook.ai.flipbook.migrated.db.AnnotationRecord

/** 对应 WebView: components/Annotations/AnnotationCallout.jsx */
@Composable
fun AnnotationCallout(
    annotations: List<AnnotationRecord>,
    activeIdx: Int,
    onTabChange: (Int) -> Unit,
    pending: Boolean,
    onClose: () -> Unit,
    onDeepExplore: (() -> Unit)? = null,
    onPlay: (() -> Unit)? = null,
    playState: String = "idle",
    modifier: Modifier = Modifier,
) {
    val content: @Composable (Modifier) -> Unit = { contentModifier ->
        AnnotationCalloutBody(annotations, activeIdx, onTabChange, pending, onClose,
            onDeepExplore, onPlay, playState, contentModifier)
    }
    if (LocalCompactLayout.current) {
        Dialog(onDismissRequest = onClose) { content(Modifier.fillMaxWidth()) }
    } else content(modifier)
}

/** 对应 WebView: components/Annotations/AnnotationCallout.jsx */
@Composable
private fun AnnotationCalloutBody(
    annotations: List<AnnotationRecord>,
    activeIdx: Int,
    onTabChange: (Int) -> Unit,
    pending: Boolean,
    onClose: () -> Unit,
    onDeepExplore: (() -> Unit)? = null,
    onPlay: (() -> Unit)? = null,
    playState: String = "idle",
    modifier: Modifier = Modifier,
) {
    val active = annotations.getOrNull(activeIdx)
    val isMulti = annotations.size > 1

    // 对应 JSX .callout：background rgba(6,8,20,0.95)，圆角 18dp，带描边和外阴影
    Box(
        modifier = modifier
            .pointerInput(Unit) { detectTapGestures { } }
            .shadow(
                elevation = 24.dp,
                shape = RoundedCornerShape(18.dp),
                ambientColor = Color(0xFF000000),
                spotColor = Color(0xFF000000),
            )
            .background(Color(0xF2060814), RoundedCornerShape(18.dp))
            .border(1.dp, Color(0x1A6366F1), RoundedCornerShape(18.dp)),
    ) {
        Column {
            // ── Header：对应 JSX .header，含 icon + title/tabs + 关闭按钮 ──
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // BookOpen 图标，对应 JSX <BookOpen size={14} strokeWidth={2} />，颜色 #818cf8
                Icon(
                    Icons.Rounded.AutoStories,
                    contentDescription = null,
                    tint = Color(0xFF818CF8),
                    modifier = Modifier.size(16.dp),
                )

                if (isMulti && !pending) {
                    // 多标注：Tab 栏，对应 JSX .tabBar / .tab / .tabActive
                    Row(
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        annotations.forEachIndexed { idx, _ ->
                            val isActive = idx == activeIdx
                            Text(
                                text = "知识点 ${idx + 1}",
                                color = if (isActive) Color(0xFFC7D2FE) else Color(0x73FFFFFF),
                                fontSize = 11.sp,
                                modifier = Modifier
                                    .background(
                                        if (isActive) Color(0x386366F1) else Color.Transparent,
                                        RoundedCornerShape(7.dp),
                                    )
                                    .border(
                                        1.dp,
                                        if (isActive) Color(0x8C6366F1) else Color(0x1FFFFFFF),
                                        RoundedCornerShape(7.dp),
                                    )
                                    .clickable { onTabChange(idx) }
                                    .padding(horizontal = 11.dp, vertical = 3.dp),
                            )
                        }
                    }
                } else {
                    // 单标注：显示"区域解读"，对应 JSX .headerTitle
                    Text(
                        text = "区域解读",
                        color = Color(0x66FFFFFF),
                        fontSize = 11.sp,
                        letterSpacing = 0.08.sp,
                        modifier = Modifier.weight(1f),
                    )
                }

                // 关闭按钮，对应 JSX .closeBtn：26dp 圆形，背景 rgba(255,255,255,0.07)
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .background(Color(0x12FFFFFF), CircleShape)
                        .clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Rounded.Close,
                        contentDescription = "关闭",
                        tint = Color(0x80FFFFFF),
                        modifier = Modifier.size(14.dp),
                    )
                }
            }

            // Header 下划线，对应 JSX .header border-bottom: 1px solid rgba(255,255,255,0.07)
            Divider(color = Color(0x12FFFFFF), thickness = 1.dp)

            // ── Body：可滚动，对应 JSX .body ──
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp, max = 280.dp)
                    .padding(horizontal = 18.dp, vertical = 16.dp),
            ) {
                if (pending) {
                    // 加载态，对应 JSX .loadingRow
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        CircularProgressIndicator(
                            color = Color(0xFF818CF8),
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            "AI 正在深度解读，请稍候…",
                            color = Color(0x80FFFFFF),
                            fontSize = 13.sp,
                        )
                    }
                } else {
                    // Markdown 内容，对应 JSX .mdContent，文字颜色 rgba(255,255,255,0.85)
                    RichText(
                        content = active?.explanation.orEmpty(),
                        color = Color(0xD9FFFFFF),
                        textSizeSp = 14f,
                        modifier = Modifier.verticalScroll(rememberScrollState()),
                    )
                }
            }

            if (!pending) {
                // Footer 顶部分割线，对应 JSX .footer border-top: 1px solid rgba(255,255,255,0.05)
                Divider(color = Color(0x0DFFFFFF), thickness = 1.dp)

                // ── Footer：对应 JSX .footer ──
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (onDeepExplore != null) {
                        val alreadyExplored = !active?.exploredPageId.isNullOrBlank()
                        // 对应 JSX .deepBtn（indigo）/ .deepBtnLoaded（cyan）
                        val deepBg = if (alreadyExplored) Color(0x1A22D3EE) else Color(0x1F6366F1)
                        val deepFg = if (alreadyExplored) Color(0xFF67E8F9) else Color(0xFFA5B4FC)
                        val deepBorder = if (alreadyExplored) Color(0x7322D3EE) else Color(0x666366F1)
                        Row(
                            modifier = Modifier
                                .background(deepBg, RoundedCornerShape(20.dp))
                                .border(1.dp, deepBorder, RoundedCornerShape(20.dp))
                                .clickable { onDeepExplore() }
                                .padding(horizontal = 14.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(
                                Icons.Rounded.Explore,
                                contentDescription = null,
                                tint = deepFg,
                                modifier = Modifier.size(14.dp),
                            )
                            Text("深入探索", color = deepFg, fontSize = 13.sp)
                        }
                    }

                    if (onPlay != null) {
                        val isLoading = playState == "loading"
                        val isPlaying = playState == "playing"
                        val isPaused = playState == "paused"
                        val isError = playState == "error"

                        // 对应 JSX .playBtn，28dp 圆形
                        val playBg = when {
                            isPlaying -> Color(0x3310B981)
                            isPaused -> Color(0x33F59E0B)
                            isError -> Color(0x1AEF4444)
                            else -> Color(0x0FFFFFFF)
                        }
                        val playBorder = when {
                            isPlaying -> Color(0x9910B981)
                            isPaused -> Color(0x99F59E0B)
                            isError -> Color(0x80EF4444)
                            else -> Color(0x26FFFFFF)
                        }
                        val playFg = when {
                            isPlaying -> Color(0xFF34D399)
                            isPaused -> Color(0xFFFBBF24)
                            isError -> Color(0xFFF87171)
                            else -> Color(0x80FFFFFF)
                        }

                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .background(playBg, CircleShape)
                                .border(1.dp, playBorder, CircleShape)
                                .clickable(enabled = !isLoading) { onPlay() },
                            contentAlignment = Alignment.Center,
                        ) {
                            when {
                                isLoading -> CircularProgressIndicator(
                                    color = playFg,
                                    strokeWidth = 2.dp,
                                    modifier = Modifier.size(14.dp),
                                )
                                isPlaying -> Icon(
                                    Icons.Rounded.Pause,
                                    contentDescription = "暂停朗读",
                                    tint = playFg,
                                    modifier = Modifier.size(13.dp),
                                )
                                isPaused -> Icon(
                                    Icons.Rounded.PlayArrow,
                                    contentDescription = "继续朗读",
                                    tint = playFg,
                                    modifier = Modifier.size(13.dp),
                                )
                                isError -> Icon(
                                    Icons.Rounded.VolumeOff,
                                    contentDescription = "朗读出错",
                                    tint = playFg,
                                    modifier = Modifier.size(13.dp),
                                )
                                else -> Icon(
                                    Icons.Rounded.VolumeUp,
                                    contentDescription = "朗读解读内容",
                                    tint = playFg,
                                    modifier = Modifier.size(13.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

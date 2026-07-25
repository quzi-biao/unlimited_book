package com.flipbook.ai.flipbook.migrated.components.splash

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.R
import kotlinx.coroutines.delay

import androidx.compose.foundation.layout.width

/** 冰蓝主题色，与蓝调概念图颜色一致 */
private val TextBlue   = Color(0xFFE0F7FA) // Icy white/blue for text
private val BarBlue    = Color(0xFF48CAE4) // Cyan blue for progress bar
private val BarBlueDim = Color(0x3348CAE4)

/**
 * App 启动屏：全屏「无限之书」概念图 + 底部动画进度条。
 *
 * 内部自管 3s 倒计时，倒计时结束后调用 [onReady] 切换到主界面。
 * 进度条分阶段动画，最后 300ms 跳至 100% 再回调。
 *
 * @param onReady 启动屏结束后的回调
 */
@Composable
fun AppSplashScreen(onReady: () -> Unit) {
    var targetProgress by remember { mutableFloatStateOf(0f) }
    var labelIndex     by remember { mutableIntStateOf(0) }

    val animatedProgress by animateFloatAsState(
        targetValue    = targetProgress,
        animationSpec  = tween(durationMillis = 500, easing = FastOutSlowInEasing),
        label          = "splashProgress",
    )

    val labels = listOf("正在初始化...", "加载资源...", "即将就绪...", "探索即将开始")

    // 固定 3s 展示：进度条分 5 个关键帧，最后 300ms 跳到 100%，然后回调
    LaunchedEffect(Unit) {
        // 关键帧：(进度, 延迟ms, labelIdx)
        val frames = listOf(
            Triple(0.20f,  300L, 0),
            Triple(0.45f,  500L, 1),
            Triple(0.68f,  600L, 1),
            Triple(0.85f,  700L, 2),
            Triple(0.95f,  600L, 2),
        )
        for ((progress, delayMs, label) in frames) {
            delay(delayMs)
            targetProgress = progress
            labelIndex     = label
        }
        // 最后 300ms 跳至 100%
        delay(300)
        targetProgress = 1f
        labelIndex     = 3
        delay(500)  // 等动画到位
        onReady()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07080F)),  // 与 AppScreen 背景一致，避免切换闪白
    ) {
        // ── 全屏概念图 ──────────────────────────────────────────
        Image(
            painter        = painterResource(id = R.drawable.splash_concept),
            contentDescription = "无限之书",
            modifier       = Modifier.fillMaxSize(),
            contentScale   = ContentScale.Crop,
        )

        // ── 底部遮罩 + 进度条 ───────────────────────────────────
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color(0xEE04060C)),
                    ),
                )
                .padding(horizontal = 40.dp, vertical = 40.dp),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text        = "无限之书",
                    color       = TextBlue,
                    fontSize    = 16.sp,
                    letterSpacing = 6.sp,
                    style       = MaterialTheme.typography.titleMedium,
                )
                Spacer(Modifier.height(16.dp))
                LinearProgressIndicator(
                    progress     = { animatedProgress },
                    modifier     = Modifier
                        .width(140.dp)
                        .height(2.dp)
                        .clip(RoundedCornerShape(50)),
                    color        = BarBlue,
                    trackColor   = BarBlueDim,
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    text  = labels[labelIndex],
                    color = Color(0x99FFFFFF),
                    fontSize = 11.sp,
                    letterSpacing = 2.sp,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

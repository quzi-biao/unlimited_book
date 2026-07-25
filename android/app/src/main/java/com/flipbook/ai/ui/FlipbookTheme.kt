package com.flipbook.ai.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.flipbook.ai.R

val AlibabaPuHuiTi = FontFamily(
    Font(R.font.alibaba_puhuiti_regular, FontWeight.Normal),
    Font(R.font.alibaba_puhuiti_medium, FontWeight.Medium),
    Font(R.font.alibaba_puhuiti_medium, FontWeight.SemiBold),
    Font(R.font.alibaba_puhuiti_bold, FontWeight.Bold),
    Font(R.font.alibaba_puhuiti_bold, FontWeight.ExtraBold),
)

private val AppTypography = Typography().withFontFamily(AlibabaPuHuiTi)

@Composable
fun FlipbookTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        typography = AppTypography,
    ) {
        ProvideTextStyle(
            value = MaterialTheme.typography.bodyMedium.copy(fontFamily = AlibabaPuHuiTi),
            content = content,
        )
    }
}

private fun Typography.withFontFamily(fontFamily: FontFamily): Typography {
    fun TextStyle.useAppFont() = copy(fontFamily = fontFamily)
    return copy(
        displayLarge = displayLarge.useAppFont(),
        displayMedium = displayMedium.useAppFont(),
        displaySmall = displaySmall.useAppFont(),
        headlineLarge = headlineLarge.useAppFont(),
        headlineMedium = headlineMedium.useAppFont(),
        headlineSmall = headlineSmall.useAppFont(),
        titleLarge = titleLarge.useAppFont(),
        titleMedium = titleMedium.useAppFont(),
        titleSmall = titleSmall.useAppFont(),
        bodyLarge = bodyLarge.useAppFont(),
        bodyMedium = bodyMedium.useAppFont(),
        bodySmall = bodySmall.useAppFont(),
        labelLarge = labelLarge.useAppFont(),
        labelMedium = labelMedium.useAppFont(),
        labelSmall = labelSmall.useAppFont(),
    )
}

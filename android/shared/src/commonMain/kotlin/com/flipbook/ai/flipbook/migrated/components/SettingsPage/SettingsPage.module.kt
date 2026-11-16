package com.flipbook.ai.flipbook.migrated.components.settingspage

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/** 对应 WebView: components/SettingsPage/SettingsPage.module.css */
object SettingsPageStyle {
    val BgStart = Color(0xFF0F0F1A)
    val BgMid = Color(0xFF1A1B2E)
    val BgEnd = Color(0xFF1E1040)

    val HeaderLine = Color(0x10FFFFFF)
    val TextStrong = Color(0xEBFFFFFF)
    val TextMain = Color(0xD9FFFFFF)
    val TextSoft = Color(0x99FFFFFF)
    val TextMuted = Color(0x66FFFFFF)

    val TabActive = Color(0xFFA78BFA)
    val TabHover = Color(0x1FFFFFFF)
    val TabLine = Color(0x10FFFFFF)

    val RowBg = Color(0x0DFFFFFF)
    val RowActiveBg = Color(0x1FA78BFA)
    val RowBorder = Color(0x14FFFFFF)
    val RowActiveBorder = Color(0x66A78BFA)

    val CurrentTagBg = Color(0x3352C41A)
    val CurrentTagText = Color(0xFF73D13D)

    val PrimaryBtnGradient = Brush.linearGradient(listOf(Color(0xFFA78BFA), Color(0xFF7C3AED)))
    val SecondaryBtnBg = Color(0x12FFFFFF)
    val SecondaryBtnText = Color(0x99FFFFFF)
}

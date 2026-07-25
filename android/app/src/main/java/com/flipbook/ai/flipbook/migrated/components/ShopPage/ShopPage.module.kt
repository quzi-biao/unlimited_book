package com.flipbook.ai.flipbook.migrated.components.shoppage

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/** 对应 WebView: components/ShopPage/ShopPage.module.css */
object ShopPageStyle {
    val BgStart = Color(0xFF0F0F1A)
    val BgMid = Color(0xFF1A1B2E)
    val BgEnd = Color(0xFF1E1040)

    val BorderSoft = Color(0x14FFFFFF)
    val BorderThin = Color(0x10FFFFFF)
    val TextStrong = Color(0xEBFFFFFF)
    val TextMain = Color(0xD9FFFFFF)
    val TextSoft = Color(0x80FFFFFF)
    val TextMuted = Color(0x4DFFFFFF)

    val Violet = Color(0xFFA78BFA)
    val VioletStrong = Color(0xFF7C3AED)
    val VioletTint = Color(0x1FA78BFA)

    val CardBg = Color(0x0AFFFFFF)
    val CardBgHover = Color(0x14A78BFA)
    val InputBg = Color(0x0FFFFFFF)

    val Success = Color(0xFF52C41A)
    val Warning = Color(0xFFFAAD14)
    val Danger = Color(0xFFFF4D4F)
    val PendingDim = Color(0x4DFFFFFF)

    val PrimaryBtn = Brush.linearGradient(listOf(Violet, VioletStrong))
    val PaidBtn = Brush.linearGradient(listOf(Color(0xFF10B981), Color(0xFF059669)))
}

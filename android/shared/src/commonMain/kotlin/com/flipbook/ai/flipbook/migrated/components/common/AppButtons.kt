package com.flipbook.ai.flipbook.migrated.components.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.settingspage.SettingsPageStyle

enum class AppButtonVariant {
    Primary,
    Secondary,
}

@Composable
fun AppActionButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean,
    variant: AppButtonVariant,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    val bg = when (variant) {
        AppButtonVariant.Primary -> Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF7C3AED)))
        AppButtonVariant.Secondary -> Brush.linearGradient(listOf(SettingsPageStyle.SecondaryBtnBg, SettingsPageStyle.SecondaryBtnBg))
    }
    val fg = when (variant) {
        AppButtonVariant.Primary -> Color(0xFF240F4D)
        AppButtonVariant.Secondary -> SettingsPageStyle.SecondaryBtnText
    }
    val alpha = when {
        enabled -> 1f
        variant == AppButtonVariant.Primary -> 0.78f
        else -> 0.45f
    }

    Box(
        modifier = modifier
            .height(46.dp)
            .clip(shape)
            .background(bg)
            .border(
                width = 1.dp,
                color = if (variant == AppButtonVariant.Primary) Color(0x33FFFFFF) else Color.Transparent,
                shape = shape,
            )
            .alpha(alpha)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = fg,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
    }
}

@Composable
fun AppBottomActions(
    cancelText: String,
    confirmText: String,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
    confirmEnabled: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        AppActionButton(
            text = cancelText,
            onClick = onCancel,
            enabled = true,
            variant = AppButtonVariant.Secondary,
            modifier = Modifier.weight(1f),
        )
        AppActionButton(
            text = confirmText,
            onClick = onConfirm,
            enabled = confirmEnabled,
            variant = AppButtonVariant.Primary,
            modifier = Modifier.weight(1f),
        )
    }
}

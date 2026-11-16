package com.flipbook.ai.flipbook.migrated.components.toolbar

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.components.common.PhoneReaderToolbarBottomInset
import com.flipbook.ai.flipbook.migrated.components.common.LocalReaderImageLayout
import com.flipbook.ai.flipbook.migrated.components.common.phoneReaderControlsWidth

/** 搜索与朗读分别悬浮于图片上，不再共用外框，保持原来的位置和显隐行为。 */
@Composable
internal fun PhoneToolBar(
    hidden: Boolean,
    inputActive: Boolean,
    onExploreTopic: (String) -> Boolean,
    onInputFocusChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable () -> Unit = {},
) {
    var query by rememberSaveable { mutableStateOf("") }
    DisposableEffect(hidden) { onDispose { onInputFocusChanged(false) } }
    if (hidden) return

    val imageWidth = LocalReaderImageLayout.current?.width
    BoxWithConstraints(
        modifier = modifier.fillMaxWidth().imePadding().padding(bottom = PhoneReaderToolbarBottomInset),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            modifier = Modifier.width(phoneReaderControlsWidth(maxWidth, imageWidth))
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TopicInput(
                query = query, onQueryChange = { query = it }, active = inputActive,
                onExplore = onExploreTopic, onFocusChanged = onInputFocusChanged,
                modifier = Modifier.weight(1f),
            )
            actions()
        }
    }
}

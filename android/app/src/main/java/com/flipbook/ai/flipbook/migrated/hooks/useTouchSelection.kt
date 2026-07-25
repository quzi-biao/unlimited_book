package com.flipbook.ai.flipbook.migrated.hooks

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.flipbook.ai.flipbook.migrated.utils.NormalizedBox

/** 对应 WebView: hooks/useTouchSelection.js */
class TouchSelectionState {
    var selBox by mutableStateOf<NormalizedBox?>(null)
        private set
    var confirmProgress by mutableFloatStateOf(0f)
        private set
    var active by mutableStateOf(false)
        private set

    fun start() {
        active = true
        confirmProgress = 0f
    }

    fun update(box: NormalizedBox, progress: Float = 0f) {
        selBox = box
        confirmProgress = progress.coerceIn(0f, 1f)
    }

    fun reset() {
        active = false
        selBox = null
        confirmProgress = 0f
    }
}

@Composable
fun rememberTouchSelectionState(): TouchSelectionState {
    return remember { TouchSelectionState() }
}

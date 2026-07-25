package com.flipbook.ai.flipbook.migrated.hooks

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.flipbook.ai.flipbook.migrated.utils.NormalizedBox

/** 对应 WebView: hooks/useMouseSelection.js */
class MouseSelectionState {
    var selBox by mutableStateOf<NormalizedBox?>(null)
        private set
    var active by mutableStateOf(false)
        private set

    fun begin() {
        active = true
    }

    fun update(box: NormalizedBox) {
        selBox = box
    }

    fun end() {
        active = false
    }

    fun reset() {
        active = false
        selBox = null
    }
}

@Composable
fun rememberMouseSelectionState(): MouseSelectionState {
    return remember { MouseSelectionState() }
}

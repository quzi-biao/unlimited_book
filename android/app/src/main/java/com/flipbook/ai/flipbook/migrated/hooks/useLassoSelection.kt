package com.flipbook.ai.flipbook.migrated.hooks

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.flipbook.ai.flipbook.migrated.components.viewport.ViewportPoint

/** 对应 WebView: hooks/useLassoSelection.js */
class LassoSelectionState {
    var points by mutableStateOf<List<ViewportPoint>>(emptyList())
        private set
    var nearClose by mutableStateOf(false)
        private set
    var drawing by mutableStateOf(false)
        private set

    fun start(point: ViewportPoint) {
        drawing = true
        nearClose = false
        points = listOf(point)
    }

    fun add(point: ViewportPoint, nearClosing: Boolean = false) {
        points = points + point
        nearClose = nearClosing
    }

    fun reset() {
        points = emptyList()
        nearClose = false
        drawing = false
    }
}

@Composable
fun rememberLassoSelectionState(): LassoSelectionState {
    return remember { LassoSelectionState() }
}

package com.flipbook.ai.flipbook.migrated.components.toolbar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** 自由输入主题；仅在探索任务成功入队后清空输入并收起键盘。 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TopicInput(
    query: String,
    onQueryChange: (String) -> Unit,
    active: Boolean,
    onExplore: (String) -> Boolean,
    onFocusChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    autoFocus: Boolean = false,
) {
    var focused by remember { mutableStateOf(false) }
    var keyboardWasVisible by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val keyboardVisible = WindowInsets.isImeVisible
    val canSubmit = active && query.isNotBlank()

    // 用户通过系统按键收起键盘时同步清除焦点，恢复朗读等阅读控件。
    LaunchedEffect(keyboardVisible) {
        if (keyboardWasVisible && !keyboardVisible && focused) focusManager.clearFocus()
        keyboardWasVisible = keyboardVisible
    }
    LaunchedEffect(autoFocus, active) {
        if (autoFocus && active) {
            focusRequester.requestFocus()
            keyboard?.show()
        }
    }

    LaunchedEffect(active) {
        if (!active && focused) {
            focusManager.clearFocus()
            keyboard?.hide()
        }
    }

    /** 按钮和软键盘共用提交逻辑，避免空内容或入队失败时丢失文字。 */
    fun submit() {
        val topic = query.trim()
        if (!active || topic.isEmpty() || !onExplore(topic)) return
        onQueryChange("")
        focusManager.clearFocus()
        keyboard?.hide()
    }

    Row(
        modifier = modifier
            .heightIn(min = 48.dp)
            .background(Color(0xF2202335), RoundedCornerShape(24.dp))
            .border(1.dp, if (focused) Color(0xFFA5B4FC) else Color(0x665F6478), RoundedCornerShape(24.dp))
            .padding(start = 14.dp, end = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Search, contentDescription = null, tint = Color(0xFFA5B4FC), modifier = Modifier.size(18.dp))
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            enabled = active,
            singleLine = true,
            textStyle = TextStyle(color = Color.White, fontSize = 14.sp),
            cursorBrush = SolidColor(Color(0xFFA5B4FC)),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { submit() }),
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 48.dp)
                .focusRequester(focusRequester)
                .onFocusChanged {
                    focused = it.isFocused
                    onFocusChanged(it.isFocused)
                }
                .semantics { contentDescription = "探索新话题" },
            decorationBox = { innerTextField ->
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) Text("探索新话题…", color = Color(0xFFB0B3C6), fontSize = 14.sp)
                    innerTextField()
                }
            },
        )
        Box(
            modifier = Modifier
                .background(if (canSubmit) Color(0xFF6366F1) else Color.Transparent, RoundedCornerShape(22.dp))
                .clickable(enabled = canSubmit, role = Role.Button, onClick = ::submit)
                .heightIn(min = 44.dp)
                .padding(horizontal = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("探索", color = if (canSubmit) Color.White else Color(0xFF85899D), fontSize = 14.sp)
        }
    }
}

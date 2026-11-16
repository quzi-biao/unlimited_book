package com.flipbook.ai.flipbook.migrated

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import com.flipbook.ai.BuildConfig
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController
import com.flipbook.ai.flipbook.migrated.components.explorequeue.ExploreQueueBtn
import com.flipbook.ai.flipbook.migrated.components.toolbar.PhoneReaderAccount
import com.flipbook.ai.flipbook.migrated.components.toolbar.PhoneReaderNavigation
import com.flipbook.ai.flipbook.migrated.hooks.FlipbookState

/** 手机顶部左右分组；任务入口独立放在下一行，平板沿用原入口。 */
@Composable
internal fun BoxScope.AppReaderHeader(
    flipbook: FlipbookState, controlsVisible: Boolean, panelOpen: Boolean,
    balance: Int, queueOpen: Boolean, onQueueToggle: () -> Unit, onCloseQueue: () -> Unit,
    onBook: () -> Unit, onPage: () -> Unit, onRecharge: () -> Unit, onSettings: () -> Unit,
) {
    val guide = LocalGuideController.current
    if (BuildConfig.PHONE_UI && (panelOpen || !controlsVisible)) return
    if (BuildConfig.PHONE_UI && controlsVisible) {
        Row(Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            PhoneReaderNavigation(
                flipbook.shelfOpen, flipbook.currentBookTitle, flipbook.currentPageTitle,
                onShelf = { onCloseQueue(); flipbook.updateShelfOpen(!flipbook.shelfOpen) },
                onBook = { onCloseQueue(); onBook() }, onPage = { onCloseQueue(); onPage() },
                modifier = Modifier.weight(1f),
            )
            PhoneReaderAccount(balance, onRecharge, onSettings)
        }
    }
    ExploreQueueBtn(
        queue = flipbook.exploreQueue, isProcessing = flipbook.exploreProcessing,
        panelOpen = queueOpen, onToggle = onQueueToggle, errorTip = flipbook.queueError,
        modifier = Modifier.align(Alignment.TopEnd)
            .padding(top = if (BuildConfig.PHONE_UI && controlsVisible) 80.dp else 14.dp, end = 14.dp)
            .onGloballyPositioned { guide?.registerTarget("explore_btn", it.boundsInRoot()) },
    )
}

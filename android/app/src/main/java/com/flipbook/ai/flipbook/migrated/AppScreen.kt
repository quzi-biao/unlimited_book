package com.flipbook.ai.flipbook.migrated

import androidx.activity.compose.BackHandler
import com.flipbook.ai.BuildConfig
import com.flipbook.ai.flipbook.migrated.components.common.LocalCompactLayout
import com.flipbook.ai.flipbook.migrated.components.common.LocalReaderImageLayout
import com.flipbook.ai.flipbook.migrated.components.common.rememberReaderImageLayout
import com.flipbook.ai.flipbook.migrated.utils.openPhoneNetworkSettings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.flipbook.ai.flipbook.migrated.hooks.recordReadingViewport
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.components.explanationpanel.ExplanationPanel
import com.flipbook.ai.flipbook.migrated.components.explorequeue.ExploreQueueDoneCards
import com.flipbook.ai.flipbook.migrated.components.explorequeue.ExploreQueuePanel
import com.flipbook.ai.flipbook.migrated.components.otaupdate.OtaBadge
import com.flipbook.ai.flipbook.migrated.components.quickdrawer.QuickDrawer
import com.flipbook.ai.flipbook.migrated.components.pagetreepanel.PageTreePanel
import com.flipbook.ai.flipbook.migrated.components.pagetreepanel.PageTreeSelection
import com.flipbook.ai.flipbook.migrated.components.settingspage.SettingsPage
import com.flipbook.ai.flipbook.migrated.components.shelfpanel.BookGraphSelection
import com.flipbook.ai.flipbook.migrated.components.shelfpanel.ShelfPanel
import com.flipbook.ai.flipbook.migrated.components.shoppage.ShopPage
import com.flipbook.ai.flipbook.migrated.components.toolbar.ToolBar
import com.flipbook.ai.flipbook.migrated.components.toolbar.PhoneReaderActions
import com.flipbook.ai.flipbook.migrated.components.ttsplayer.TtsPlayer
import com.flipbook.ai.flipbook.migrated.components.viewport.Viewport
import com.flipbook.ai.flipbook.migrated.components.common.GuideOverlay
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController
import com.flipbook.ai.flipbook.migrated.components.common.NoNetworkDialog
import com.flipbook.ai.flipbook.migrated.components.common.rememberGuideController
import com.flipbook.ai.flipbook.migrated.hooks.ExploreTask
import com.flipbook.ai.flipbook.migrated.hooks.FlipbookOpenPage
import com.flipbook.ai.flipbook.migrated.hooks.rememberFlipbookState
import com.flipbook.ai.flipbook.migrated.hooks.rememberOtaUpdateState
import com.flipbook.ai.flipbook.migrated.hooks.rememberTtsPlaybackState
import com.flipbook.ai.flipbook.migrated.hooks.rememberUseBooksState

/** 对应 WebView: legacy-webview-src/App.jsx */
@Composable
fun AppScreen() {
    val compact = LocalCompactLayout.current
    val flipbook = rememberFlipbookState()
    val tts = rememberTtsPlaybackState()
    val ota = rememberOtaUpdateState()
    val appContext = LocalContext.current.applicationContext
    // 全局多步骤引导控制器（含持久化完成状态）
    val guideController = rememberGuideController(appContext)
    // 检测书单是否为空，用于首次自动开启话题引导
    val booksState = rememberUseBooksState()
    // 一次性标记：避免反复触发
    var hasAutoOpenedShelf by remember { mutableStateOf(false) }

    var pageTreeBookId by remember { mutableStateOf<String?>(null) }
    var pageTreeBookTitle by remember { mutableStateOf("") }
    var explanationOpen by remember { mutableStateOf(false) }
    var isSelecting by remember { mutableStateOf(false) }
    var calloutOpen by remember { mutableStateOf(false) }
    var toolbarUserHidden by remember { mutableStateOf(false) }
    var topicInputFocused by remember { mutableStateOf(false) }
    var settingsOpen by remember { mutableStateOf(false) }
    var settingsInitialTab by remember { mutableStateOf("voice") }
    var shopOpen by remember { mutableStateOf(false) }
    var explorePanelOpen by remember { mutableStateOf(false) }
    var networkPanelOpen by remember { mutableStateOf(false) }
    var studyPoints by remember { mutableStateOf(0) }

    // 全局网络无连接弹窗状态
    var noNetworkDialogVisible by remember { mutableStateOf(false) }

    val activePageId = flipbook.currentPageId

    AppDeviceSync(ota) { studyPoints = it }

    LaunchedEffect(activePageId) {
        explanationOpen = false
    }

    // 初始化引导步骤，定义独立存放以保持主界面文件简洁。
    LaunchedEffect(Unit) {
        guideController.setSteps(appGuideSteps())
    }

    val isConnected = rememberAppNetworkConnected()

    // 核心判定：是否在“viewport页面”（未被设置/充值面板遮挡）且已联网
    val isOnViewport = !settingsOpen && !shopOpen
    val canShowGuide = isConnected && isOnViewport

    // 引导启动与隐藏的条件控制：严格依据 canShowGuide
    LaunchedEffect(canShowGuide, booksState.loading, booksState.books.size, guideController.isOnboardingComplete) {
        val shouldGuide = !guideController.isOnboardingComplete && booksState.books.isEmpty() && !booksState.loading
        if (shouldGuide && canShowGuide) {
            // 满足条件时，确保引导显示
            if (!guideController.isVisible) {
                if (!hasAutoOpenedShelf && guideController.currentIndex <= 2) {
                    hasAutoOpenedShelf = true
                    flipbook.updateShelfOpen(true)
                }
                guideController.startGuide(guideController.currentIndex)
            }
        } else {
            // 不满足条件时（未联网，或在设置页面），隐藏引导
            if (guideController.isVisible) {
                guideController.dismiss()
            }
        }
    }

    // 步骤副作用：根据引导当前步骤自动开/关 ShelfPanel，toolbar 步骤确保工具栏可见
    LaunchedEffect(guideController.currentIndex, guideController.isVisible) {
        if (!guideController.isVisible) return@LaunchedEffect
        when (guideController.currentIndex) {
            // 步骤 0-2：需要 ShelfPanel 开启（话题浏览）
            0, 1, 2 -> if (!flipbook.shelfOpen) flipbook.updateShelfOpen(true)
            // 步骤 3-4：关闭 ShelfPanel，聚焦探索按键 / 完成卡片
            3, 4 -> if (flipbook.shelfOpen) flipbook.updateShelfOpen(false)
            // 步骤 5-9：Toolbar 引导，关闭 ShelfPanel，确保 Toolbar 可见
            else -> {
                if (flipbook.shelfOpen) flipbook.updateShelfOpen(false)
                toolbarUserHidden = false
            }
        }
    }

    // 事件驱动：探索队列有任务完成时，自动推进到 done_cards 步骤
    LaunchedEffect(flipbook.exploreQueue) {
        val hasDone = flipbook.exploreQueue.any { it.status == "done" }
        if (hasDone && guideController.isVisible && guideController.currentIndex <= 3) {
            guideController.advanceTo("done_cards")
        }
    }

    // 书单加载完且为空：自动打开 ShelfPanel
    LaunchedEffect(booksState.loading, booksState.books.size) {
        if (!booksState.loading && booksState.books.isEmpty() && !hasAutoOpenedShelf) {
            hasAutoOpenedShelf = true
            flipbook.updateShelfOpen(true)
        }
    }

    fun openPageTree(bookId: String?, bookTitle: String?) {
        if (compact && bookId != null) flipbook.updateShelfOpen(false)
        pageTreeBookId = bookId
        pageTreeBookTitle = bookTitle.orEmpty()
    }

    fun closePageTree() {
        pageTreeBookId = null
        pageTreeBookTitle = ""
    }

fun handleSelectShelfPage(page: BookGraphSelection) {
        flipbook.openBookPage(
            FlipbookOpenPage(
                imageUrl = page.imageUrl,
                pageId = page.pageId,
                bookId = page.bookId,
                title = page.title,
                bookTitle = pageTreeBookTitle.ifBlank { flipbook.currentBookTitle },
            ),
        )
        flipbook.updateShelfOpen(false)
    }

    fun handleSelectTreePage(page: PageTreeSelection) {
        flipbook.openBookPage(
            FlipbookOpenPage(
                imageUrl = page.imageUrl,
                pageId = page.pageId,
                bookId = page.bookId,
                title = page.title,
                bookTitle = page.bookTitle,
            ),
        )
        flipbook.updateShelfOpen(false)
    }

    fun handleViewExploreTask(task: ExploreTask) {
        val result = task.result ?: return
        val pageId = result["pageId"].toStringValue() ?: return
        flipbook.openBookPage(
            FlipbookOpenPage(
                imageUrl = result["imageUrl"].toStringValue(),
                pageId = pageId,
                bookId = result["bookId"].toStringValue(),
                title = result["pageTitle"].toStringValue(),
                bookTitle = task.bookTitle ?: flipbook.currentBookTitle,
            ),
        )
        flipbook.dismissExploreTask(task.id)
        if (flipbook.exploreQueue.size <= 1) {
            explorePanelOpen = false
        }
        // 引导步骤4（done_cards）：点击卡片后跳转页面并推进到 toolbar 引导
        if (guideController.isVisible && guideController.currentIndex == 4) {
            toolbarUserHidden = false // 确保 Toolbar 可见
            guideController.advanceTo("toolbar_shelf")
        }
    }

    // 手机上优先关闭最上层面板，阅读主界面保留系统默认返回行为。
    BackHandler(BuildConfig.PHONE_UI && (guideController.isVisible || settingsOpen || shopOpen || explorePanelOpen ||
        explanationOpen || pageTreeBookId != null || flipbook.shelfOpen)) {
        when {
            guideController.isVisible -> guideController.dismiss()
            settingsOpen -> settingsOpen = false
            shopOpen -> shopOpen = false
            explorePanelOpen -> explorePanelOpen = false
            explanationOpen -> explanationOpen = false
            pageTreeBookId != null -> closePageTree()
            else -> flipbook.updateShelfOpen(false)
        }
    }

    val toolBarHidden =
        calloutOpen || isSelecting || explanationOpen || toolbarUserHidden
    val queueControlsVisible = !BuildConfig.PHONE_UI || (!toolBarHidden && !topicInputFocused &&
        !settingsOpen && !shopOpen && !flipbook.shelfOpen && pageTreeBookId == null)
    // 手机探索入口和结果卡片跟随阅读控件显隐，恢复时不自动展开面板。
    LaunchedEffect(queueControlsVisible, explorePanelOpen) {
        if (!queueControlsVisible && explorePanelOpen) explorePanelOpen = false
    }

    fun handlePageTap() {
        if (!calloutOpen && !isSelecting && !explanationOpen) {
            toolbarUserHidden = !toolbarUserHidden
        }
    }

    CompositionLocalProvider(
        LocalGuideController provides guideController,
        LocalReaderImageLayout provides rememberReaderImageLayout(flipbook.imageUrl),
    ) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07080F)),
    ) {
        Viewport(
            imageUrl = flipbook.imageUrl,
            imageVisible = flipbook.imageVisible,
            errorMsg = flipbook.errorMsg,
            hasCurrent = activePageId != null,
            pageId = activePageId,
            bookId = flipbook.currentBookId,
            bookTitle = flipbook.currentBookTitle,
            pageTitle = flipbook.currentPageTitle,
            onRegionSelect = { imageBase64, box, vpSize, annotation ->
                flipbook.handleRegionSelect(
                    imageBase64 = imageBase64,
                    box = box,
                    vpSize = vpSize,
                    annotation = annotation,
                )
            },
            onNavigateToPage = { pageId ->
                flipbook.handleNavigateToPage(pageId)
            },
            onPlayAnnotation = { ann ->
                tts.playAnnotation(
                    annotationId = ann.id,
                    annotationText = ann.explanation,
                    bookTitle = flipbook.currentBookTitle,
                    pageTitle = flipbook.currentPageTitle,
                    pageId = activePageId,
                )
            },
            ttsAnnotationState = tts.annState,
            ttsAnnotationSourceId = tts.annSourceId,
            onSelectingChange = { selecting ->
                isSelecting = selecting
            },
            exploreQueue = flipbook.exploreQueue,
            onCalloutChange = { open ->
                calloutOpen = open
            },
            onSwipeNav = { delta -> flipbook.viewportNavGo(delta) },
            onPageTap = ::handlePageTap,
            // 阅读栏在画布上悬浮，显隐时不改变图片尺寸及热点坐标。
            modifier = Modifier.fillMaxSize().recordReadingViewport(
                topicInputFocused, flipbook::updateReadingViewport,
            ),
        )

        PageTreePanel(
            bookId = pageTreeBookId,
            bookTitle = pageTreeBookTitle,
            activePageId = activePageId,
            shelfOpen = flipbook.shelfOpen,
            onSelectPage = ::handleSelectTreePage,
            onClose = ::closePageTree,
        )

        ShelfPanel(
            open = flipbook.shelfOpen,
            onClose = { flipbook.updateShelfOpen(false) },
            books = booksState,
            backdropClosable = pageTreeBookId == null,
            // 书单为空时传 true，论话题区自动展开并展示引导
            initialTopicsOpen = hasAutoOpenedShelf && booksState.books.isEmpty(),
            activePageId = activePageId,
            activeBookId = flipbook.currentBookId,
            selectedBookId = pageTreeBookId,
            onSelectBook = { book ->
                if (book != null) {
                    openPageTree(book.id, book.title)
                } else {
                    closePageTree()
                }
            },
            onSelectPage = ::handleSelectShelfPage,
            onSelectTopic = { topic ->
                flipbook.browsePreparedTopic(topic.name)
                flipbook.updateShelfOpen(false)
            },
            onOpenSettings = { settingsOpen = true },
            onOpenWallet = { shopOpen = true },
        )

        ExplanationPanel(
            open = explanationOpen,
            pageId = activePageId,
            pageTitle = flipbook.currentPageTitle,
            onClose = { explanationOpen = false },
        )

        ToolBar(
            hidden = toolBarHidden,
            shelfOpen = flipbook.shelfOpen,
            onShelfOpen = { flipbook.updateShelfOpen(!flipbook.shelfOpen) },
            currentBookTitle = flipbook.currentBookTitle,
            currentPageTitle = flipbook.currentPageTitle,
            onBookTreeOpen = { openPageTree(flipbook.currentBookId, flipbook.currentBookTitle) },
            onPageNameClick = {
                if (activePageId != null) explanationOpen = true
            },
            inputActive = !flipbook.shelfOpen && pageTreeBookId == null &&
                !settingsOpen && !shopOpen && !explorePanelOpen,
            onInputFocusChanged = { topicInputFocused = it },
            onExploreTopic = { topic ->
                val accepted = flipbook.browse(topic)
                if (accepted) {
                    flipbook.updateShelfOpen(false)
                    explorePanelOpen = true
                }
                accepted
            },
            modifier = Modifier.align(Alignment.BottomCenter),
            phoneActions = {
                PhoneReaderActions(
                    state = tts.uiState, enabled = activePageId != null,
                    onPlayback = { tts.togglePlayPause(activePageId, flipbook.currentBookTitle, flipbook.currentPageTitle) },
                )
            },
        )

        TtsPlayer(
            showRoundButton = !BuildConfig.PHONE_UI,
            pageVisible = activePageId != null && !toolBarHidden && !topicInputFocused,
            state = tts.uiState,
            onRoundClick = {
                tts.toggleRound(
                    pageId = activePageId,
                    bookTitle = flipbook.currentBookTitle,
                    pageTitle = flipbook.currentPageTitle,
                )
            },
            onPlayPause = {
                tts.togglePlayPause(
                    pageId = activePageId,
                    bookTitle = flipbook.currentBookTitle,
                    pageTitle = flipbook.currentPageTitle,
                )
            },
            onSeek = { value -> tts.seekTo(value) },
            onRateToggle = { tts.toggleRate() },
            onGoToPage = { pageId ->
                flipbook.handleNavigateToPage(pageId)
            },
            guideController = guideController,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 0.dp, bottom = 0.dp),
        )

        SettingsPage(
            open = settingsOpen,
            onClose = { settingsOpen = false },
            initialTab = settingsInitialTab,
        )

        ShopPage(
            open = shopOpen,
            onBack = { shopOpen = false },
            onBalanceUpdate = { pts -> studyPoints = pts },
        )

        OtaBadge(
            state = ota.badgeState,
            onUpdate = { ota.startUpdate() },
            onRestart = { ota.restartInstaller() },
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(top = if (BuildConfig.PHONE_UI) 80.dp else 14.dp, start = 14.dp),
        )

        AppReaderHeader(
            flipbook = flipbook, controlsVisible = !toolBarHidden && !topicInputFocused,
            panelOpen = settingsOpen || shopOpen || flipbook.shelfOpen || pageTreeBookId != null, balance = studyPoints,
            queueOpen = explorePanelOpen, onQueueToggle = { explorePanelOpen = !explorePanelOpen },
            onCloseQueue = { explorePanelOpen = false },
            onBook = { openPageTree(flipbook.currentBookId, flipbook.currentBookTitle) },
            onPage = { if (activePageId != null) explanationOpen = true },
            onRecharge = { flipbook.updateShelfOpen(false); pageTreeBookId = null; explorePanelOpen = false; shopOpen = true },
            onSettings = { flipbook.updateShelfOpen(false); pageTreeBookId = null; explorePanelOpen = false; settingsOpen = true },
        )

        if (!explorePanelOpen && queueControlsVisible) {
            ExploreQueueDoneCards(
                tasks = flipbook.exploreQueue.filter { it.status == "done" },
                onView = ::handleViewExploreTask,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = if (BuildConfig.PHONE_UI && !toolBarHidden && !topicInputFocused) 124.dp else 58.dp, end = 14.dp)
                    .onGloballyPositioned { coords ->
                        guideController.registerTarget("done_cards", coords.boundsInRoot())
                    },
            )
        }

        ExploreQueuePanel(
            open = explorePanelOpen && queueControlsVisible,
            queue = flipbook.exploreQueue,
            onClose = { explorePanelOpen = false },
            onView = ::handleViewExploreTask,
            onCancel = { id -> flipbook.cancelExploreTask(id) },
            onRetry = { id -> flipbook.retryExploreTask(id) },
            modifier = Modifier
                .align(Alignment.TopEnd)
                .fillMaxWidth(if (compact) 1f else 0.42f)
                .padding(top = if (BuildConfig.PHONE_UI && !toolBarHidden && !topicInputFocused) 120.dp else 54.dp, end = 14.dp),
        )
        // 全局引导浮层（最顶层，视觉上覆盖所有内容）
        if (canShowGuide) {
            GuideOverlay(guideController)
        }

        // 右上角快捷控制抽屉（手指从右上角边缘下划呼出）
        if (!BuildConfig.PHONE_UI) QuickDrawer(
            studyPoints    = studyPoints,
            onOpenSettings = { settingsOpen = true },
            onOpenRecharge = { shopOpen = true },
            // 配置页/商店页打开时禁用热区，避免右侧 22dp 条带拦截内层触摸事件
            // 探索任务按钮显示时（队列不为空）同样禁用，按钮位于右上角 end=14dp 落在热区内
            enabled        = !settingsOpen && !shopOpen && flipbook.exploreQueue.isEmpty(),
        )
    } // end root Box
    } // end CompositionLocalProvider

    // 未联网弹窗：覆盖在最顶层，网络恢复后自动消失
    NoNetworkDialog(
        onVisibleChange = { noNetworkDialogVisible = it },
        onGoToWifi = {
            if (BuildConfig.PHONE_UI) openPhoneNetworkSettings(appContext) else {
                settingsInitialTab = "wifi"
                settingsOpen = true
            }
        },
    )
}

private fun Any?.toStringValue(): String? {
    return when (this) {
        null -> null
        is String -> this
        else -> this.toString()
    }?.takeIf { it.isNotBlank() }
}

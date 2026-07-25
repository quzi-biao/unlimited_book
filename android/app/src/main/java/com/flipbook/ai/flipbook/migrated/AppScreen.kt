package com.flipbook.ai.flipbook.migrated

import android.content.Context
import android.net.ConnectivityManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.flipbook.ai.flipbook.migrated.api.deviceApi
import com.flipbook.ai.flipbook.migrated.api.walletApi
import com.flipbook.ai.flipbook.migrated.components.explanationpanel.ExplanationPanel
import com.flipbook.ai.flipbook.migrated.components.explorequeue.ExploreQueueBtn
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
import com.flipbook.ai.flipbook.migrated.components.ttsplayer.TtsPlayer
import com.flipbook.ai.flipbook.migrated.components.viewport.Viewport
import com.flipbook.ai.flipbook.migrated.components.common.GuideOverlay
import com.flipbook.ai.flipbook.migrated.components.common.GuideStepDef
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController
import com.flipbook.ai.flipbook.migrated.components.common.NoNetworkDialog
import com.flipbook.ai.flipbook.migrated.components.common.isNetworkConnected
import com.flipbook.ai.flipbook.migrated.components.common.TooltipAnchor
import com.flipbook.ai.flipbook.migrated.components.common.rememberGuideController
import com.flipbook.ai.flipbook.migrated.hooks.ExploreTask
import com.flipbook.ai.flipbook.migrated.hooks.FlipbookOpenPage
import com.flipbook.ai.flipbook.migrated.hooks.rememberFlipbookState
import com.flipbook.ai.flipbook.migrated.hooks.rememberOtaUpdateState
import com.flipbook.ai.flipbook.migrated.hooks.rememberTtsPlaybackState
import com.flipbook.ai.flipbook.migrated.hooks.rememberUseBooksState
import com.flipbook.ai.flipbook.migrated.utils.getDeviceToken
import com.flipbook.ai.flipbook.migrated.utils.initDevice
import androidx.compose.runtime.CompositionLocalProvider
import kotlinx.coroutines.delay

/** 对应 WebView: legacy-webview-src/App.jsx */
@Composable
fun AppScreen() {
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
    var settingsOpen by remember { mutableStateOf(false) }
    var settingsInitialTab by remember { mutableStateOf("voice") }
    var shopOpen by remember { mutableStateOf(false) }
    var explorePanelOpen by remember { mutableStateOf(false) }
    var networkPanelOpen by remember { mutableStateOf(false) }
    var studyPoints by remember { mutableStateOf(0) }

    // 全局网络连通状态由 NoNetworkDialog 管理，外层通过 noNetworkDialogVisible 推断

    // 全局网络无连接弹窗状态
    var noNetworkDialogVisible by remember { mutableStateOf(false) }

    val activePageId = flipbook.currentPageId

    LaunchedEffect(appContext) {
        runCatching { initDevice(appContext) }
        ota.check()
        // 启动时立刻拉取一次学习点数余额
        runCatching { walletApi.info(appContext) }
            .onSuccess { json ->
                val pts = json.get("balance")?.asInt
                if (pts != null) studyPoints = pts
            }
        var heartbeatCount = 0
        var lastInitRetryAt = 0L
        suspend fun retryInitIfNeeded() {
            val now = System.currentTimeMillis()
            if (now - lastInitRetryAt < 30_000L) return
            lastInitRetryAt = now
            runCatching { initDevice(appContext) }
        }
        while (true) {
            if (getDeviceToken(appContext).isNullOrBlank()) {
                retryInitIfNeeded()
            }
            val heartbeatOk = runCatching { deviceApi.heartbeat(appContext) }.isSuccess
            if (!heartbeatOk) {
                retryInitIfNeeded()
            }
            // 每 6 次心跳（约 1 分钟）同步更新点数余额
            if (heartbeatCount % 6 == 0) {
                runCatching { walletApi.info(appContext) }
                    .onSuccess { json ->
                        val pts = json.get("balance")?.asInt
                        if (pts != null) studyPoints = pts
                    }
            }
            heartbeatCount += 1
            if (heartbeatCount % 6 == 0) {
                ota.check()
            }
            delay(10_000)
        }
    }

    LaunchedEffect(activePageId) {
        explanationOpen = false
    }

    // 初始化引导步骤列表（共 10 步）
    LaunchedEffect(Unit) {
        guideController.setSteps(
            listOf(
                GuideStepDef(
                    id = "wallet",
                    targetKey = "wallet_btn",
                    message = "系统需要消耗 AI 算力\n通过「学习点数」支付\n点数用尽后可在此充值",
                    anchor = TooltipAnchor.Below,
                    showPrev = false,
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "settings",
                    targetKey = "settings_btn",
                    message = "在设置中可配置\n语音角色、WiFi 联网\n及屏幕亮度",
                    anchor = TooltipAnchor.Below,
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "first_topic",
                    targetKey = "first_topic",
                    message = "点击感兴趣的话题\n即可创建 AI 探索任务",
                    anchor = TooltipAnchor.Left,
                    showNext = false,  // 必须点击话题才能推进
                    nextLabel = "我知道了",
                ),
                GuideStepDef(
                    id = "explore_btn",
                    targetKey = "explore_btn",
                    message = "AI 正在深度思考中…\n根据内容复杂度\n约60～300 秒请耐心等待\n点击此处可查看进度",
                    anchor = TooltipAnchor.Below,
                    showPrev = false,  // 任务已提交，不应后退
                    showNext = false,  // 必须等任务完成才能推进
                    showDismiss = true, // 可关闭浮层临时隐藏，探索完成后自动推进
                    wideTooltip = true, // 内容较多，使用展宽气泡
                    nextLabel = "好的",
                ),
                GuideStepDef(
                    id = "done_cards",
                    targetKey = "done_cards",
                    message = "✅ 探索完成！\n点击提示卡片\n即可跳转查看 AI 生成的页面",
                    anchor = TooltipAnchor.Left,
                    showNext = false,  // 必须点击卡片导航到页面才能推进
                    nextLabel = "好的",
                ),
                // ── 页面 Toolbar 引导 ──────────────────────────────
                GuideStepDef(
                    id = "toolbar_shelf",
                    targetKey = "toolbar_shelf_btn",
                    message = "📚 这是书本列表按键\n点击可随时查看\n已探索的所有话题与书页",
                    anchor = TooltipAnchor.Above,
                    showPrev = false,  // 已完成导航，不回退
                    highlightCornerRadius = 22.dp, // CircleButton: 44dp 圆形按鈕
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "toolbar_book",
                    targetKey = "toolbar_book_name",
                    message = "显示当前书本名称\n点击可查看\n该书所有页面列表",
                    anchor = TooltipAnchor.Above,
                    highlightCornerRadius = 22.dp, // PillButton: RoundedCornerShape(22.dp)
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "toolbar_page",
                    targetKey = "toolbar_page_name",
                    message = "显示当前书页名称\n点击可查看\nAI 生成的页面详细解析",
                    anchor = TooltipAnchor.Above,
                    highlightCornerRadius = 22.dp, // PillButton: RoundedCornerShape(22.dp)
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "toolbar_play",
                    targetKey = "toolbar_play_btn",
                    message = "🎵 点击播放\nAI 将朗读当前页面内容\n支持变速与跳转",
                    anchor = TooltipAnchor.Above,
                    highlightCornerRadius = 26.dp, // IdleRoundButton: CircleShape 52dp 圆 → 半径 26dp
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "page_find_area",
                    targetKey = "page_find_area_tip",  // 无目标元素，tooltip 在动画下方
                    message = "找到自己感兴趣的区域",
                    anchor = TooltipAnchor.Above,
                    showTargetAnimation = true,  // 圆形准星放大缩小动画
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "page_draw_circle",
                    targetKey = "page_draw_circle_tip",  // 无目标元素，tooltip 在动画下方
                    message = "在感兴趣的区域周围画个圈\n可以进行深入的探索",
                    anchor = TooltipAnchor.Above,
                    showGestureAnimation = true,  // 手指画圈动画
                    nextLabel = "完成引导",
                ),
            )
        )
    }

    // 网络状态监听（解决网络恢复后引导不弹出的问题）
    val context = LocalContext.current.applicationContext
    var isConnected by remember { mutableStateOf(isNetworkConnected(context)) }
    DisposableEffect(context) {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = android.net.NetworkRequest.Builder()
            .addCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            .build()
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) { isConnected = true }
            override fun onLost(network: android.net.Network) { isConnected = isNetworkConnected(context) }
            override fun onCapabilitiesChanged(network: android.net.Network, networkCapabilities: android.net.NetworkCapabilities) {
                isConnected = networkCapabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            }
        }
        connectivityManager.registerNetworkCallback(request, callback)
        onDispose { connectivityManager.unregisterNetworkCallback(callback) }
    }

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

    // 注：旧的 books.size 自动推进已移除——done_cards 需用户点击卡片推进（handleViewExploreTask 内处理）

    // 书单加载完且为空：自动打开 ShelfPanel
    LaunchedEffect(booksState.loading, booksState.books.size) {
        if (!booksState.loading && booksState.books.isEmpty() && !hasAutoOpenedShelf) {
            hasAutoOpenedShelf = true
            flipbook.updateShelfOpen(true)
        }
    }

    fun openPageTree(bookId: String?, bookTitle: String?) {
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

    val toolBarHidden =
        calloutOpen || isSelecting || explanationOpen || toolbarUserHidden

    fun handlePageTap() {
        if (!calloutOpen && !isSelecting && !explanationOpen) {
            toolbarUserHidden = !toolbarUserHidden
        }
    }

    CompositionLocalProvider(LocalGuideController provides guideController) {
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
            modifier = Modifier.fillMaxSize(),
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
                flipbook.browse(topic.name)
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
            modifier = Modifier.align(Alignment.BottomCenter),
        )

        TtsPlayer(
            pageVisible = activePageId != null && !toolBarHidden,
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
                .padding(top = 14.dp, start = 14.dp),
        )

        ExploreQueueBtn(
            queue = flipbook.exploreQueue,
            isProcessing = flipbook.exploreProcessing,
            panelOpen = explorePanelOpen,
            onToggle = { explorePanelOpen = !explorePanelOpen },
            errorTip = flipbook.queueError,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 14.dp, end = 14.dp)
                .onGloballyPositioned { coords ->
                    guideController.registerTarget("explore_btn", coords.boundsInRoot())
                },
        )

        if (!explorePanelOpen) {
            ExploreQueueDoneCards(
                tasks = flipbook.exploreQueue.filter { it.status == "done" },
                onView = ::handleViewExploreTask,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 58.dp, end = 14.dp)
                    .onGloballyPositioned { coords ->
                        guideController.registerTarget("done_cards", coords.boundsInRoot())
                    },
            )
        }

        ExploreQueuePanel(
            open = explorePanelOpen,
            queue = flipbook.exploreQueue,
            onClose = { explorePanelOpen = false },
            onView = ::handleViewExploreTask,
            onCancel = { id -> flipbook.cancelExploreTask(id) },
            onRetry = { id -> flipbook.retryExploreTask(id) },
            modifier = Modifier
                .align(Alignment.TopEnd)
                .fillMaxWidth(0.42f)
                .padding(top = 54.dp, end = 14.dp),
        )
        // 全局引导浮层（最顶层，视觉上覆盖所有内容）
        if (canShowGuide) {
            GuideOverlay(guideController)
        }

        // 右上角快捷控制抽屉（手指从右上角边缘下划呼出）
        QuickDrawer(
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
            settingsInitialTab = "wifi"
            settingsOpen = true
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

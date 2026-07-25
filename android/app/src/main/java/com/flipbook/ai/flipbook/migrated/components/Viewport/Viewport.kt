package com.flipbook.ai.flipbook.migrated.components.viewport

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.foundation.layout.height
import com.flipbook.ai.flipbook.migrated.utils.cropLocalImageUtils
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.hypot
import coil.compose.AsyncImage
import androidx.compose.ui.graphics.graphicsLayer
import com.flipbook.ai.flipbook.migrated.api.aiApi
import com.flipbook.ai.flipbook.migrated.api.annotationsApi
import com.flipbook.ai.flipbook.migrated.components.annotations.AnnotationCallout
import com.flipbook.ai.flipbook.migrated.db.AnnotationRecord
import com.flipbook.ai.flipbook.migrated.hooks.ExploreTask
import com.flipbook.ai.flipbook.migrated.hooks.FlipbookRegionAnnotation
import com.flipbook.ai.flipbook.migrated.hooks.FlipbookRegionBox
import com.flipbook.ai.flipbook.migrated.hooks.FlipbookViewportSize
import com.flipbook.ai.flipbook.migrated.hooks.rememberAnnotationsState
import com.flipbook.ai.flipbook.migrated.hooks.rememberImageSrc
import com.flipbook.ai.flipbook.migrated.utils.AnnotationItem
import com.flipbook.ai.flipbook.migrated.utils.NormalizedBox
import com.flipbook.ai.flipbook.migrated.utils.PixelBox
import com.flipbook.ai.flipbook.migrated.utils.calcCalloutPos
import com.flipbook.ai.flipbook.migrated.utils.findDuplicate
import com.flipbook.ai.flipbook.migrated.utils.groupByCenter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

private data class CalloutState(
    val pending: Boolean,
    val annotations: List<AnnotationRecord>,
    val activeIdx: Int,
    val leftPx: Float,
    val topPx: Float,
    val boxPx: PixelBox,
    val selectionTaskId: Long? = null,
)

internal enum class RegionExplainStatus {
    Loading,
    Done,
    Failed,
}

private data class RegionExplainTask(
    val id: Long,
    val box: NormalizedBox,
    val status: RegionExplainStatus,
    val annotation: AnnotationRecord? = null,
    val userClosedCallout: Boolean = false,
)

private val CalloutWidthDp = 420.dp
private val CalloutHeightDp = 420.dp

private fun sameRegion(ann: AnnotationRecord, box: NormalizedBox): Boolean {
    fun close(a: Float, b: Float): Boolean = abs(a - b) <= 0.0005f
    return close(ann.x, box.x) &&
        close(ann.y, box.y) &&
        close(ann.w, box.w) &&
        close(ann.h, box.h)
}

/** 对应 WebView: components/Viewport/Viewport.jsx */
@Composable
fun Viewport(
    imageUrl: String?,
    imageVisible: Boolean,
    errorMsg: String?,
    hasCurrent: Boolean,
    pageId: String? = null,
    bookId: String? = null,
    bookTitle: String = "",
    pageTitle: String = "",
    onRegionSelect: ((String?, FlipbookRegionBox, FlipbookViewportSize, FlipbookRegionAnnotation?) -> Unit)? = null,
    onNavigateToPage: ((String) -> Unit)? = null,
    onPlayAnnotation: ((FlipbookRegionAnnotation) -> Unit)? = null,
    ttsAnnotationState: String = "idle",
    ttsAnnotationSourceId: String? = null,
    onSelectingChange: ((Boolean) -> Unit)? = null,
    onCalloutChange: ((Boolean) -> Unit)? = null,
    onSwipeNav: (Int) -> Unit,
    onPageTap: () -> Unit,
    exploreQueue: List<ExploreTask> = emptyList(),
    modifier: Modifier = Modifier,
    children: @Composable () -> Unit = {},
) {
    val appContext = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()

    val imageAlpha = animateFloatAsState(
        targetValue = if (imageVisible) 1f else 0f,
        animationSpec = tween(durationMillis = 550),
        label = "viewport-image-alpha",
    )

    val annotationsState = rememberAnnotationsState(pageId, bookId)
    var callout by remember(pageId) { mutableStateOf<CalloutState?>(null) }
    var activeId by remember(pageId) { mutableStateOf<String?>(null) }
    val touchSelectionState = rememberViewportTouchSelectionState()

    var dragSelectionBox by remember { mutableStateOf<NormalizedBox?>(null) }
    var swipeHappened by remember { mutableStateOf(false) }
    var pendingRegionTask by remember(pageId) { mutableStateOf<RegionExplainTask?>(null) }

    val displayImageSrc = rememberImageSrc(imageUrl)
    var loadedImageUrl by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(callout) {
        onCalloutChange?.invoke(callout != null)
    }

    LaunchedEffect(pageId, imageUrl) {
        loadedImageUrl = null
        callout = null
        activeId = null
        dragSelectionBox = null
    }

    LaunchedEffect(exploreQueue, pageId) {
        exploreQueue
            .filter { it.type == "expand" && it.status == "done" }
            .forEach { task ->
                val result = task.result ?: return@forEach
                val annotationId = result["annotationId"]?.toString()?.takeIf { it.isNotBlank() }
                val exploredPageId = result["exploredPageId"]?.toString()?.takeIf { it.isNotBlank() }
                    ?: result["pageId"]?.toString()?.takeIf { it.isNotBlank() }
                if (!annotationId.isNullOrBlank() && !exploredPageId.isNullOrBlank()) {
                    annotationsState.markExplored(annotationId, exploredPageId)
                }
            }
    }

    fun closeCallout() {
        val panel = callout
        if (panel?.selectionTaskId != null) {
            pendingRegionTask = pendingRegionTask?.takeIf { it.id == panel.selectionTaskId }?.copy(
                userClosedCallout = true,
            )
        }
        callout = null
        activeId = null
    }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF07080F))
    ) {
        val density = LocalDensity.current
        val containerW = with(density) { maxWidth.toPx() }
        val containerH = with(density) { maxHeight.toPx() }
        var imageSize by remember { mutableStateOf(Size.Zero) }
        val imageReady = imageVisible &&
            !imageUrl.isNullOrBlank() &&
            displayImageSrc.isNotBlank() &&
            loadedImageUrl == imageUrl

        LaunchedEffect(pageId, imageUrl) {
            imageSize = Size.Zero
            // 翻页时重置双指缩放
            touchSelectionState.zoomScale = 1f
            touchSelectionState.zoomOffsetX = 0f
            touchSelectionState.zoomOffsetY = 0f
        }

        var vpW = containerW
        var vpH = containerH
        var offsetX = 0f
        var offsetY = 0f

        if (imageSize != Size.Zero && imageSize.width > 0f && imageSize.height > 0f) {
            val imgRatio = imageSize.width / imageSize.height
            val contRatio = containerW / containerH
            if (imgRatio > contRatio) {
                vpW = containerW
                vpH = containerW / imgRatio
            } else {
                vpH = containerH
                vpW = containerH * imgRatio
            }
            offsetX = (containerW - vpW) / 2f
            offsetY = (containerH - vpH) / 2f
        }

        fun syncCalloutWithLatestAnnotations() {
            val panel = callout ?: return
            val currentActiveId = panel.annotations.getOrNull(panel.activeIdx)?.id
            val merged = panel.annotations.map { item ->
                annotationsState.annotations.firstOrNull { it.id == item.id } ?: item
            }
            val mergedActiveIdx = currentActiveId?.let { id ->
                merged.indexOfFirst { it.id == id }.takeIf { it >= 0 }
            } ?: panel.activeIdx
            if (merged != panel.annotations || mergedActiveIdx != panel.activeIdx) {
                callout = panel.copy(
                    annotations = merged,
                    activeIdx = mergedActiveIdx,
                )
            }
        }

        LaunchedEffect(annotationsState.annotations, callout?.activeIdx, callout?.annotations?.size) {
            syncCalloutWithLatestAnnotations()
        }

        fun reopenCalloutByIndex(annotations: List<AnnotationRecord>, idx: Int) {
            val latestAnnotations = annotations.map { item ->
                annotationsState.annotations.firstOrNull { it.id == item.id } ?: item
            }
            val ann = latestAnnotations.getOrNull(idx) ?: return
            val calloutW = with(density) { CalloutWidthDp.toPx() }
            val calloutH = with(density) { CalloutHeightDp.toPx() }
            val pxBox = PixelBox(
                x = ann.x * vpW,
                y = ann.y * vpH,
                w = ann.w * vpW,
                h = ann.h * vpH,
            )
            val (left, top) = calcCalloutPos(pxBox, vpW, vpH, calloutW, calloutH)
            activeId = ann.id
            callout = CalloutState(
                pending = false,
                annotations = latestAnnotations,
                activeIdx = idx,
                leftPx = left,
                topPx = top,
                boxPx = pxBox,
            )
            if (ann.exploredPageId.isNullOrBlank() && !ann.id.startsWith("local-")) {
                scope.launch {
                    annotationsState.refreshAnnotation(ann.id)
                    syncCalloutWithLatestAnnotations()
                }
            }
        }

        fun reopenCalloutByAnnotationId(annotationId: String?) {
            if (annotationId.isNullOrBlank()) return
            val ann = annotationsState.annotations.firstOrNull { it.id == annotationId } ?: return
            reopenCalloutByIndex(listOf(ann), 0)
        }

        fun openPendingCallout(normBox: NormalizedBox, taskId: Long? = null) {
            val calloutW = with(density) { CalloutWidthDp.toPx() }
            val calloutH = with(density) { CalloutHeightDp.toPx() }
            val pxBox = pixelFromNorm(normBox, vpW, vpH)
            val (left, top) = calcCalloutPos(pxBox, vpW, vpH, calloutW, calloutH)
            callout = CalloutState(
                pending = true,
                annotations = emptyList(),
                activeIdx = 0,
                leftPx = left,
                topPx = top,
                boxPx = pxBox,
                selectionTaskId = taskId,
            )
        }

        fun viewRegionTask(task: RegionExplainTask) {
            val ann = task.annotation
            if (task.status == RegionExplainStatus.Done && ann != null) {
                pendingRegionTask = null
                reopenCalloutByIndex(listOf(ann), 0)
            } else if (task.status == RegionExplainStatus.Failed) {
                pendingRegionTask = null
            } else {
                openPendingCallout(task.box, task.id)
            }
        }

        fun confirmSelection(normBox: NormalizedBox) {
            if (!imageReady) return
            val mapped = annotationsState.annotations.map { ann ->
                AnnotationItem(
                    id = ann.id,
                    box = NormalizedBox(ann.x, ann.y, ann.w, ann.h),
                )
            }
            val duplicate = findDuplicate(normBox, mapped)
            if (duplicate != null) {
                val existing = annotationsState.annotations.firstOrNull { it.id == duplicate.id }
                if (existing != null) {
                    reopenCalloutByIndex(listOf(existing), 0)
                }
                return
            }

            val taskId = System.currentTimeMillis()
            pendingRegionTask = RegionExplainTask(
                id = taskId,
                box = normBox,
                status = RegionExplainStatus.Loading,
            )
            openPendingCallout(normBox, taskId)
            scope.launch {
                // Let the pending callout render before local crop and network work starts.
                delay(180)
                runCatching {
                    val imageBase64 = if (imageUrl != null) kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { cropLocalImageUtils.crop(appContext, imageUrl, normBox) } else null
                    val explanation = aiApi.explainRegion(
                        context = appContext,
                        body = mapOf(
                            "imageUrl" to imageUrl,
                            "imageBase64" to imageBase64,
                            "region" to mapOf(
                                "x1" to normBox.x,
                                "y1" to normBox.y,
                                "x2" to (normBox.x + normBox.w),
                                "y2" to (normBox.y + normBox.h),
                            ),
                        ),
                    ).get("explanation")?.asString.orEmpty()

                    val payload = mapOf(
                        "x" to normBox.x,
                        "y" to normBox.y,
                        "w" to normBox.w,
                        "h" to normBox.h,
                        "explanation" to explanation,
                    )

                    val saved = if (!pageId.isNullOrBlank()) {
                        runCatching {
                            val res = annotationsApi.create(appContext, pageId, payload)
                            parseAnnotation(pageId, res, payload)
                        }.getOrElse {
                            AnnotationRecord(
                                id = "local-${System.currentTimeMillis()}",
                                pageId = pageId,
                                x = normBox.x,
                                y = normBox.y,
                                w = normBox.w,
                                h = normBox.h,
                                explanation = explanation,
                            )
                        }
                    } else {
                        AnnotationRecord(
                            id = "local-${System.currentTimeMillis()}",
                            pageId = pageId.orEmpty(),
                            x = normBox.x,
                            y = normBox.y,
                            w = normBox.w,
                            h = normBox.h,
                            explanation = explanation,
                        )
                    }

                    val finalSaved = if (saved.id.startsWith("local-") && !pageId.isNullOrBlank()) {
                        annotationsState.refreshAnnotations()
                            .lastOrNull { ann ->
                                sameRegion(ann, normBox) &&
                                    ann.explanation == explanation &&
                                    !ann.id.startsWith("local-")
                            }
                            ?: saved
                    } else {
                        saved
                    }
                    if (annotationsState.annotations.none { it.id == finalSaved.id }) {
                        annotationsState.addAnnotation(finalSaved)
                    }
                    finalSaved
                }.onSuccess { ann ->
                    val pendingCalloutStillOpen = callout?.selectionTaskId == taskId
                    val userClosed = pendingRegionTask?.takeIf { it.id == taskId }?.userClosedCallout == true ||
                        !pendingCalloutStillOpen
                    pendingRegionTask = pendingRegionTask?.takeIf { it.id == taskId }?.copy(
                        status = RegionExplainStatus.Done,
                        annotation = ann,
                    )
                    if (!userClosed) {
                        pendingRegionTask = null
                        reopenCalloutByIndex(listOf(ann), 0)
                    }
                    if (!ann.explanation.isNullOrBlank()) {
                        if (!userClosed) {
                            runCatching { onPlayAnnotation?.invoke(ann.toRegionAnnotation()) }
                        }
                    }
                }.onFailure {
                    pendingRegionTask = pendingRegionTask?.takeIf { it.id == taskId }?.copy(
                        status = RegionExplainStatus.Failed,
                    )
                    if (callout?.selectionTaskId == taskId) {
                        callout = null
                        activeId = null
                    }
                    android.widget.Toast.makeText(appContext, "区域解读失败，请重试", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }

        val mappedItems = annotationsState.annotations.map { ann ->
            AnnotationItem(
                id = ann.id,
                box = NormalizedBox(x = ann.x, y = ann.y, w = ann.w, h = ann.h),
                exploredPageId = ann.exploredPageId,
            )
        }
        val dotGroups = groupByCenter(mappedItems)
        val dotHitRadiusPx = with(density) { 17.dp.toPx() }

        fun openCalloutByTap(localPoint: Offset): Boolean {
            // 将 viewport 物理坐标逆变换为缩放前的逻辑坐标，再做 dot 命中检测
            val scale = touchSelectionState.zoomScale
            val txOff = touchSelectionState.zoomOffsetX
            val tyOff = touchSelectionState.zoomOffsetY
            val cx0 = vpW / 2f
            val cy0 = vpH / 2f
            val logicX = (localPoint.x - txOff - cx0) / scale + cx0
            val logicY = (localPoint.y - tyOff - cy0) / scale + cy0
            val logicPoint = Offset(logicX, logicY)
            // dot 命中判断也需要在缩放后空间评估命中半径（除以 scale，等效于逻辑空间半径）
            val logicHitRadius = dotHitRadiusPx / scale
            val hitGroup = dotGroups.minByOrNull { group ->
                val dcx = group.cx * vpW
                val dcy = group.cy * vpH
                hypot(logicPoint.x - dcx, logicPoint.y - dcy)
            }?.takeIf { group ->
                val dcx = group.cx * vpW
                val dcy = group.cy * vpH
                hypot(logicPoint.x - dcx, logicPoint.y - dcy) <= logicHitRadius
            } ?: return false

            if (activeId != null && hitGroup.items.any { it.id == activeId }) {
                closeCallout()
                return true
            }
            val annList = hitGroup.items.mapNotNull { item ->
                annotationsState.annotations.firstOrNull { it.id == item.id }
            }
            if (annList.isEmpty()) return false
            reopenCalloutByIndex(annList, 0)
            return true
        }

        children()

        AsyncImage(
            model = displayImageSrc,
            contentDescription = null,
            onSuccess = { state -> 
                imageSize = state.painter.intrinsicSize
                loadedImageUrl = imageUrl
            },
            modifier = Modifier
                .fillMaxSize()
                .alpha(imageAlpha.value)
                .graphicsLayer {
                    scaleX = touchSelectionState.zoomScale
                    scaleY = touchSelectionState.zoomScale
                    translationX = touchSelectionState.zoomOffsetX
                    translationY = touchSelectionState.zoomOffsetY
                },
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .viewportTouchSelection(
                    enabled = hasCurrent && !pageId.isNullOrBlank(),
                    vpW = vpW,
                    vpH = vpH,
                    offsetX = offsetX,
                    offsetY = offsetY,
                    state = touchSelectionState,
                    onTapInViewport = ::openCalloutByTap,
                    onSelectingChange = onSelectingChange,
                    onConfirm = ::confirmSelection,
                    onSwipeNav = onSwipeNav,
                    onPageTap = onPageTap,
                    onSwipeHappened = {
                        swipeHappened = true
                        scope.launch {
                            delay(400)
                            swipeHappened = false
                        }
                    },
                )
                .pointerInput(hasCurrent, pageId, imageUrl, callout, imageReady) {
                    var dragStart: Offset? = null
                    var dragCurrent: Offset? = null
                    detectDragGesturesAfterLongPress(
                        onDragStart = { start ->
                            if (!hasCurrent || pageId.isNullOrBlank() || !imageReady) return@detectDragGesturesAfterLongPress
                            closeCallout()
                            onSelectingChange?.invoke(true)
                            val innerStart = Offset(start.x - offsetX, start.y - offsetY)
                            val clamped = clampViewportPoint(innerStart, vpW, vpH)
                            dragStart = clamped
                            dragCurrent = clamped
                            val relativeStart = androidx.compose.ui.geometry.Offset(start.x - offsetX, start.y - offsetY)
                            dragStart = relativeStart
                            dragCurrent = relativeStart
                            dragSelectionBox = null
                        },
                        onDrag = { change, dragAmount ->
                            val start = dragStart ?: return@detectDragGesturesAfterLongPress
                            val current = dragCurrent ?: return@detectDragGesturesAfterLongPress
                            val next = clampViewportPoint(
                                androidx.compose.ui.geometry.Offset(current.x + dragAmount.x, current.y + dragAmount.y),
                                vpW,
                                vpH,
                            )
                            dragCurrent = next
                            dragSelectionBox = normalizedFromPoints(start, next, vpW, vpH)
                            change.consume()
                        },
                        onDragEnd = {
                            val box = dragSelectionBox
                            onSelectingChange?.invoke(false)
                            dragStart = null
                            dragCurrent = null
                            dragSelectionBox = null
                            if (box == null) return@detectDragGesturesAfterLongPress
                            val px = pixelFromNorm(box, vpW, vpH)
                            if (px.w < 20f || px.h < 20f) return@detectDragGesturesAfterLongPress
                            confirmSelection(box)
                        },
                        onDragCancel = {
                            onSelectingChange?.invoke(false)
                            dragStart = null
                            dragCurrent = null
                            dragSelectionBox = null
                        },
                    )
                },
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset { IntOffset(offsetX.toInt(), offsetY.toInt()) }
                    .width(with(density) { vpW.toDp() })
                    .height(with(density) { vpH.toDp() })
                    // 随图片应用相同的缩放和平移变换
                    .graphicsLayer {
                        scaleX = touchSelectionState.zoomScale
                        scaleY = touchSelectionState.zoomScale
                        translationX = touchSelectionState.zoomOffsetX
                        translationY = touchSelectionState.zoomOffsetY
                    }
            ) {
                val displaySelBox = touchSelectionState.selectionBox ?: dragSelectionBox ?: pendingRegionTask?.box
                SelectionBox(
                    selBox = displaySelBox,
                    vpW = vpW,
                    vpH = vpH,
                    confirmProgress = touchSelectionState.confirmProgress,
                )
                LassoOverlay(
                    points = touchSelectionState.lassoPoints,
                    nearClose = touchSelectionState.lassoNearClose,
                    drawing = touchSelectionState.lassoDrawing,
                )

                val isTtsAnnotationActive =
                    (ttsAnnotationState == "playing" || ttsAnnotationState == "paused" || ttsAnnotationState == "loading") &&
                        !ttsAnnotationSourceId.isNullOrBlank()
                val playingAnnotation = if (isTtsAnnotationActive && callout == null) {
                    annotationsState.annotations.firstOrNull { it.id == ttsAnnotationSourceId }
                } else {
                    null
                }
                val playingBoxNorm = playingAnnotation?.let {
                    NormalizedBox(
                        x = it.x,
                        y = it.y,
                        w = it.w,
                        h = it.h,
                    )
                }
                val calloutBoxNorm = callout?.let { c ->
                    NormalizedBox(
                        x = c.boxPx.x / vpW,
                        y = c.boxPx.y / vpH,
                        w = c.boxPx.w / vpW,
                        h = c.boxPx.h / vpH,
                    )
                }
                val highlightNorm = calloutBoxNorm ?: playingBoxNorm
                val highlightInteractive = callout == null && isTtsAnnotationActive

                RegionHighlight(
                    box = highlightNorm,
                    vpW = vpW,
                    vpH = vpH,
                    isActive = highlightInteractive,
                    ttsState = ttsAnnotationState,
                    onClick = {
                        reopenCalloutByAnnotationId(ttsAnnotationSourceId)
                    },
                )

                AnnotationDots(
                    annotations = mappedItems,
                    activeId = activeId,
                    ttsState = ttsAnnotationState,
                    ttsSrcId = ttsAnnotationSourceId,
                    calloutOpen = callout != null,
                    vpW = vpW,
                    vpH = vpH,
                    onDotClick = {},
                )
            }
        } // Close outer Box

        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .offset { IntOffset(offsetX.toInt(), offsetY.toInt()) }
                .width(with(density) { vpW.toDp() })
                .height(with(density) { vpH.toDp() })
                // 随图片应用相同的缩放和平移变换，使标注点跟随图片移动
                .graphicsLayer {
                    scaleX = touchSelectionState.zoomScale
                    scaleY = touchSelectionState.zoomScale
                    translationX = touchSelectionState.zoomOffsetX
                    translationY = touchSelectionState.zoomOffsetY
                },
        ) {
            AnnotationDots(
                annotations = mappedItems,
                activeId = activeId,
                ttsState = ttsAnnotationState,
                ttsSrcId = ttsAnnotationSourceId,
                calloutOpen = callout != null,
                vpW = vpW,
                vpH = vpH,
                onDotClick = { group ->
                    // dot 点击时使用逻辑坐标（缩放前），openCalloutByTap 内部会做逆变换
                    val scale = touchSelectionState.zoomScale
                    val txOff = touchSelectionState.zoomOffsetX
                    val tyOff = touchSelectionState.zoomOffsetY
                    val cx0 = vpW / 2f
                    val cy0 = vpH / 2f
                    // 将 dot 逻辑坐标正变换为屏幕坐标，作为 openCalloutByTap 的输入
                    val logicX = group.cx * vpW
                    val logicY = group.cy * vpH
                    val screenX = (logicX - cx0) * scale + cx0 + txOff
                    val screenY = (logicY - cy0) * scale + cy0 + tyOff
                    openCalloutByTap(Offset(screenX, screenY))
                },
            )
        }

        if (!errorMsg.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .offset(y = (-60).dp)
                    .background(Color(0x1FEF4444), RoundedCornerShape(10.dp)),
            ) {
                Text(
                    text = errorMsg,
                    color = Color(0xFFFCA5A5),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(260.dp),
                )
            }
        }

        val statusTask = pendingRegionTask
        if (statusTask != null && callout == null) {
            val boxPx = pixelFromNorm(statusTask.box, vpW, vpH)
            val buttonSize = with(density) { 34.dp.toPx() }
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset {
                        IntOffset(
                            (offsetX + boxPx.x).toInt(),
                            (offsetY + boxPx.y).toInt(),
                        )
                    }
                    .size(
                        width = with(density) { boxPx.w.toDp() },
                        height = with(density) { boxPx.h.toDp() },
                    )
                    .clickable { viewRegionTask(statusTask) },
            )
            RegionExplainStatusButton(
                status = statusTask.status,
                onView = { viewRegionTask(statusTask) },
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset {
                        val rawX = offsetX + boxPx.x + boxPx.w - buttonSize - 6f
                        val rawY = offsetY + boxPx.y + boxPx.h - buttonSize - 6f
                        val clampedX = rawX.coerceIn(offsetX + 6f, offsetX + vpW - buttonSize - 6f)
                        val clampedY = rawY.coerceIn(offsetY + 6f, offsetY + vpH - buttonSize - 6f)
                        IntOffset(
                            clampedX.toInt(),
                            clampedY.toInt(),
                        )
                    },
            )
        }

        callout?.let { panel ->
            val active = panel.annotations.getOrNull(panel.activeIdx)
            AnnotationCallout(
                annotations = panel.annotations,
                activeIdx = panel.activeIdx,
                onTabChange = { idx -> reopenCalloutByIndex(panel.annotations, idx) },
                pending = panel.pending,
                onClose = ::closeCallout,
                onDeepExplore = {
                    val ann = active ?: return@AnnotationCallout
                    scope.launch {
                        val exploredPageId = ann.exploredPageId
                        if (!exploredPageId.isNullOrBlank()) {
                            onNavigateToPage?.invoke(exploredPageId)
                            closeCallout()
                            return@launch
                        }

                        onSelectingChange?.invoke(true)
                        val imageBase64 = if (imageUrl != null) kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { cropLocalImageUtils.crop(appContext, imageUrl, NormalizedBox(ann.x, ann.y, ann.w, ann.h)) } else null
                        onRegionSelect?.invoke(
                            imageBase64,
                            FlipbookRegionBox(
                                x = ann.x * vpW,
                                y = ann.y * vpH,
                                w = ann.w * vpW,
                                h = ann.h * vpH,
                            ),
                            FlipbookViewportSize(vpW, vpH),
                            ann.toRegionAnnotation(),
                        )
                        onSelectingChange?.invoke(false)
                        closeCallout()
                    }
                },
                onPlay = {
                    val ann = active ?: return@AnnotationCallout
                    onPlayAnnotation?.invoke(ann.toRegionAnnotation())
                },
                playState = when {
                    active?.id != null && active.id == ttsAnnotationSourceId -> ttsAnnotationState
                    else -> "idle"
                },
                modifier = Modifier
                    .offset { IntOffset((panel.leftPx + offsetX).toInt(), (panel.topPx + offsetY).toInt()) }
                    .width(CalloutWidthDp),
            )
        }
    }
}

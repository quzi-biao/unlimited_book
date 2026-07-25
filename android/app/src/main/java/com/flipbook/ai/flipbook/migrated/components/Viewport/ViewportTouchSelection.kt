package com.flipbook.ai.flipbook.migrated.components.viewport

import android.os.SystemClock
import android.view.MotionEvent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInteropFilter
import com.flipbook.ai.flipbook.migrated.utils.NormalizedBox
import kotlin.math.abs
import kotlin.math.hypot

private const val SWIPE_THRESHOLD = 70f
private const val SWIPE_MAX_MS = 500L
private const val SWIPE_RATIO = 2f
private const val TAP_MOVE_THRESHOLD = 10f

private const val MIN_BBOX = 20f
private const val CLOSE_THRESHOLD = 50f
private const val MIN_POINTS = 12
private const val SAMPLE_DIST = 5f
private const val TOUCH_TOOL = MotionEvent.TOOL_TYPE_FINGER

/** 双指缩放最大倍率 */
private const val MAX_ZOOM = 2f

private data class DownTouch(
    val x: Float,
    val y: Float,
    val t: Long,
)

@Stable
class ViewportTouchSelectionState internal constructor() {
    var selectionBox by mutableStateOf<NormalizedBox?>(null)
    /** 保留字段以兼容 SelectionBox 调用方，不再更新 */
    var confirmProgress by mutableFloatStateOf(0f)
    var lassoPoints by mutableStateOf<List<ViewportPoint>>(emptyList())
    var lassoNearClose by mutableStateOf(false)
    var lassoDrawing by mutableStateOf(false)

    // ── 双指缩放状态 ──────────────────────────────────────
    /** 当前缩放倍率，范围 [1f, MAX_ZOOM] */
    var zoomScale by mutableFloatStateOf(1f)
    /** 缩放后的水平平移偏移（以 viewport 像素为单位） */
    var zoomOffsetX by mutableFloatStateOf(0f)
    /** 缩放后的垂直平移偏移（以 viewport 像素为单位） */
    var zoomOffsetY by mutableFloatStateOf(0f)
}

@Composable
fun rememberViewportTouchSelectionState(): ViewportTouchSelectionState {
    return remember { ViewportTouchSelectionState() }
}

@OptIn(ExperimentalComposeUiApi::class)
fun Modifier.viewportTouchSelection(
    enabled: Boolean,
    vpW: Float,
    vpH: Float,
    offsetX: Float = 0f,
    offsetY: Float = 0f,
    state: ViewportTouchSelectionState,
    onTapInViewport: ((Offset) -> Boolean)? = null,
    onSelectingChange: ((Boolean) -> Unit)?,
    onConfirm: (NormalizedBox) -> Unit,
    onSwipeNav: (Int) -> Unit,
    onPageTap: () -> Unit,
    onSwipeHappened: () -> Unit,
): Modifier = composed {

    // ── 基础触控状态 ────────────────────────────────────────
    var firstId by remember { mutableStateOf<Int?>(null) }
    var secondId by remember { mutableStateOf<Int?>(null) }
    var p1 by remember { mutableStateOf<Offset?>(null) }
    var p2 by remember { mutableStateOf<Offset?>(null) }
    var twoDown by remember { mutableStateOf(false) }
    /** 当前触控序列中曾经出现过双指，用于防止缩放结束后误触发单指点击/滑动 */
    var hadTwoFingers by remember { mutableStateOf(false) }

    var lassoFingerId by remember { mutableStateOf<Int?>(null) }
    val lassoPath = remember { mutableStateListOf<ViewportPoint>() }

    var downTouch by remember { mutableStateOf<DownTouch?>(null) }
    var ownsCurrentGesture by remember { mutableStateOf(false) }

    // ── 双指捏合缩放跟踪（在 ACTION_POINTER_DOWN 时初始化）────
    var initSpan by remember { mutableFloatStateOf(0f) }
    var initScale by remember { mutableFloatStateOf(1f) }
    var initCentroidX by remember { mutableFloatStateOf(0f) }
    var initCentroidY by remember { mutableFloatStateOf(0f) }
    var initZoomOffsetX by remember { mutableFloatStateOf(0f) }
    var initZoomOffsetY by remember { mutableFloatStateOf(0f) }

    // ── 局部辅助函数 ────────────────────────────────────────

    fun resetLasso() {
        lassoFingerId = null
        lassoPath.clear()
        state.lassoPoints = emptyList()
        state.lassoNearClose = false
        state.lassoDrawing = false
    }

    fun resetTouchState(clearSelection: Boolean = true) {
        firstId = null
        secondId = null
        p1 = null
        p2 = null
        twoDown = false
        hadTwoFingers = false
        downTouch = null
        if (clearSelection) {
            state.selectionBox = null
        }
        resetLasso()
    }

    /** 将触摸坐标转为 viewport 内部坐标，并限制在边界内 */
    fun eventPoint(event: MotionEvent, index: Int): Offset {
        return clampViewportPoint(
            raw = Offset(event.getX(index) - offsetX, event.getY(index) - offsetY),
            vpW = vpW,
            vpH = vpH,
        )
    }

    // ── 手势事件处理 ────────────────────────────────────────

    pointerInteropFilter { event ->
        val touchEvent = (0 until event.pointerCount).any { idx ->
            event.getToolType(idx) == TOUCH_TOOL
        }
        if (!touchEvent || !enabled) {
            ownsCurrentGesture = false
            return@pointerInteropFilter false
        }
        if (event.actionMasked != MotionEvent.ACTION_DOWN && !ownsCurrentGesture) {
            return@pointerInteropFilter false
        }

        when (event.actionMasked) {

            // ── 第一根手指落下 ─────────────────────────────
            MotionEvent.ACTION_DOWN -> {
                val id = event.getPointerId(0)
                val pos = eventPoint(event, 0)
                ownsCurrentGesture = true
                firstId = id
                secondId = null
                p1 = pos
                p2 = null
                twoDown = false
                hadTwoFingers = false
                downTouch = DownTouch(x = pos.x, y = pos.y, t = SystemClock.elapsedRealtime())
                state.selectionBox = null
                resetLasso()
                true
            }

            // ── 第二根手指落下：初始化双指捏合缩放 ───────
            MotionEvent.ACTION_POINTER_DOWN -> {
                val idx = event.actionIndex
                val id = event.getPointerId(idx)
                if (firstId != null && secondId == null && id != firstId) {
                    secondId = id
                    p2 = eventPoint(event, idx)
                    twoDown = true
                    hadTwoFingers = true
                    resetLasso()

                    // 记录双指开始时的缩放基准值
                    val fp = p1!!
                    val sp = p2!!
                    initSpan = hypot(sp.x - fp.x, sp.y - fp.y).coerceAtLeast(1f)
                    initScale = state.zoomScale
                    initCentroidX = (fp.x + sp.x) / 2f
                    initCentroidY = (fp.y + sp.y) / 2f
                    initZoomOffsetX = state.zoomOffsetX
                    initZoomOffsetY = state.zoomOffsetY
                }
                true
            }

            // ── 移动 ──────────────────────────────────────
            MotionEvent.ACTION_MOVE -> {
                if (twoDown && firstId != null && secondId != null) {
                    // 双指：捏合缩放 + 质心平移
                    val i1 = event.findPointerIndex(firstId!!)
                    val i2 = event.findPointerIndex(secondId!!)
                    if (i1 >= 0) p1 = eventPoint(event, i1)
                    if (i2 >= 0) p2 = eventPoint(event, i2)
                    val fp = p1
                    val sp = p2
                    if (fp != null && sp != null) {
                        // 根据两指间距变化计算缩放
                        val span = hypot(sp.x - fp.x, sp.y - fp.y).coerceAtLeast(1f)
                        val newScale = (initScale * span / initSpan).coerceIn(1f, MAX_ZOOM)
                        state.zoomScale = newScale

                        // 根据质心位移计算平移，限制在可平移范围内
                        val cx = (fp.x + sp.x) / 2f
                        val cy = (fp.y + sp.y) / 2f
                        val maxPanX = vpW * (newScale - 1f) / 2f
                        val maxPanY = vpH * (newScale - 1f) / 2f
                        state.zoomOffsetX = (initZoomOffsetX + cx - initCentroidX)
                            .coerceIn(-maxPanX, maxPanX)
                        state.zoomOffsetY = (initZoomOffsetY + cy - initCentroidY)
                            .coerceIn(-maxPanY, maxPanY)
                    }
                } else if (state.lassoDrawing && lassoFingerId != null) {
                    // 单指套索绘制
                    val idx = event.findPointerIndex(lassoFingerId!!)
                    if (idx >= 0) {
                        val pos = eventPoint(event, idx)
                        val last = lassoPath.lastOrNull()
                        if (last == null || hypot(pos.x - last.x, pos.y - last.y) >= SAMPLE_DIST) {
                            lassoPath.add(ViewportPoint(pos.x, pos.y))
                            state.lassoPoints = lassoPath.toList()
                            if (lassoPath.size > MIN_POINTS) {
                                val first = lassoPath.first()
                                state.lassoNearClose =
                                    hypot(pos.x - first.x, pos.y - first.y) < CLOSE_THRESHOLD
                            }
                        }
                    }
                } else if (firstId != null && downTouch != null) {
                    // 单指拖动超过阈值则进入套索模式
                    val idx = event.findPointerIndex(firstId!!)
                    if (idx >= 0) {
                        val pos = eventPoint(event, idx)
                        val down = downTouch
                        val moved = if (down != null) hypot(pos.x - down.x, pos.y - down.y) else 0f
                        if (moved > TAP_MOVE_THRESHOLD) {
                            lassoFingerId = firstId
                            lassoPath.add(ViewportPoint(down!!.x, down.y))
                            lassoPath.add(ViewportPoint(pos.x, pos.y))
                            state.lassoPoints = lassoPath.toList()
                            state.lassoDrawing = true
                            onSelectingChange?.invoke(true)
                        }
                    }
                }
                true
            }

            // ── 一根手指抬起（还有另一根手指）────────────
            MotionEvent.ACTION_POINTER_UP -> {
                val idx = event.actionIndex
                val id = event.getPointerId(idx)
                if (id == firstId) {
                    firstId = secondId
                    p1 = p2
                    secondId = null
                    p2 = null
                    twoDown = false
                } else if (id == secondId) {
                    secondId = null
                    p2 = null
                    twoDown = false
                }
                true
            }

            // ── 最后一根手指抬起 ──────────────────────────
            MotionEvent.ACTION_UP -> {
                val idx = event.actionIndex
                val id = event.getPointerId(idx)
                val up = eventPoint(event, idx)
                val hadLassoMotion = lassoPath.size > 2
                var lassoConfirmed = false

                // 套索闭合确认
                if (state.lassoDrawing && id == lassoFingerId) {
                    val pts = lassoPath.toList()
                    val first = pts.firstOrNull()
                    val last = pts.lastOrNull()
                    val closed = if (first != null && last != null) {
                        hypot(last.x - first.x, last.y - first.y) < CLOSE_THRESHOLD
                    } else {
                        false
                    }
                    if (pts.size >= MIN_POINTS && closed) {
                        val minX = pts.minOf { it.x }
                        val maxX = pts.maxOf { it.x }
                        val minY = pts.minOf { it.y }
                        val maxY = pts.maxOf { it.y }
                        val w = maxX - minX
                        val h = maxY - minY
                        if (w >= MIN_BBOX && h >= MIN_BBOX) {
                            lassoConfirmed = true
                            onConfirm(
                                NormalizedBox(
                                    x = (minX / vpW).coerceIn(0f, 1f),
                                    y = (minY / vpH).coerceIn(0f, 1f),
                                    w = (w / vpW).coerceIn(0f, 1f),
                                    h = (h / vpH).coerceIn(0f, 1f),
                                ),
                            )
                        }
                    }
                }

                // 单指滑动 / 点击（双指序列中忽略）
                val down = downTouch
                if (down != null && state.selectionBox == null &&
                    !twoDown && !hadTwoFingers && !lassoConfirmed
                ) {
                    val dx = up.x - down.x
                    val dy = up.y - down.y
                    val dt = SystemClock.elapsedRealtime() - down.t
                    val absDx = abs(dx)
                    val absDy = abs(dy)
                    if (absDx > SWIPE_THRESHOLD && absDx > absDy * SWIPE_RATIO && dt < SWIPE_MAX_MS) {
                        onSwipeHappened()
                        onSwipeNav(if (dx < 0f) +1 else -1)
                    } else if (!hadLassoMotion &&
                        absDx < TAP_MOVE_THRESHOLD && absDy < TAP_MOVE_THRESHOLD
                    ) {
                        val handled = onTapInViewport?.invoke(up) == true
                        if (!handled) {
                            onPageTap()
                        }
                    }
                }

                resetTouchState(clearSelection = true)
                onSelectingChange?.invoke(false)
                ownsCurrentGesture = false
                true
            }

            MotionEvent.ACTION_CANCEL -> {
                resetTouchState(clearSelection = true)
                onSelectingChange?.invoke(false)
                ownsCurrentGesture = false
                true
            }

            else -> true
        }
    }
}

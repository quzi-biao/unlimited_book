package com.flipbook.ai.flipbook.migrated.components.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.unit.Dp

/** 引导气泡的显示方向（相对于目标元素） */
enum class TooltipAnchor { Above, Below, Left, Right }

/**
 * 单步引导的定义。
 * @param id           唯一步骤标识，用于 [GuideController.advanceTo]
 * @param targetKey    对应已注册的 UI 元素 key，用于获取高亮坐标
 * @param message      提示文案（支持 \n 换行）
 * @param anchor       气泡相对于目标的方向
 * @param showPrev     是否显示「上一步」按钮
 * @param showNext     是否显示「下一步/完成」按钮（false 时须由事件驱动推进）
 * @param showDismiss  showNext=false 时是否显示「关闭」按钮（临时隐藏浮层，不标记完成）
 * @param wideTooltip  是否使用展宽气泡（内容较多时开启）
 * @param nextLabel    下一步/完成按钮文案
 */
data class GuideStepDef(
    val id: String,
    val targetKey: String,
    val message: String,
    val anchor: TooltipAnchor = TooltipAnchor.Left,
    val showPrev: Boolean = true,
    val showNext: Boolean = true,
    val showDismiss: Boolean = false,
    val wideTooltip: Boolean = false,
    /** 高亮框的圆角半径，默认 null 表示使用全局 RING_CORNER（8dp） */
    val highlightCornerRadius: Dp? = null,
    /** true 时在遮罩层展示手指画圈选区的手势动画（用于 page_select 引导步骤） */
    val showGestureAnimation: Boolean = false,
    /** true 时在遮罩层展示瞄准十字圆圈呼吸动画（用于 page_find_area 引导步骤） */
    val showTargetAnimation: Boolean = false,
    val nextLabel: String = "下一步",
)

/** 当前激活步骤（含已解析的目标坐标） */
data class ActiveGuideStep(
    val def: GuideStepDef,
    val targetBounds: Rect?,
    val stepIndex: Int,
    val totalSteps: Int,
    val isFirst: Boolean,
    val isLast: Boolean,
)

/**
 * 全局多步骤引导控制器。
 * 通过 [LocalGuideController] 注入到组件树；
 * UI 元素调用 [registerTarget] 上报坐标；
 * [GuideOverlay] 读取 [activeStep] 渲染引导浮层。
 */
class GuideController(
    initiallyComplete: Boolean,
    private val saveCompletion: (Boolean) -> Unit,
) {

    /** 引导流程是否已完成（持久化） */
    var isOnboardingComplete by mutableStateOf(initiallyComplete)
        private set

    /** 已注册的 UI 目标坐标 key → bounds */
    private val targets = mutableStateMapOf<String, Rect>()

    /** 当前步骤索引 */
    var currentIndex by mutableStateOf(0)
        private set

    /** 引导是否可见 */
    var isVisible by mutableStateOf(false)
        private set

    /** 引导步骤列表（由 AppScreen 初始化） */
    var stepDefs by mutableStateOf<List<GuideStepDef>>(emptyList())
        private set

    /** 当前激活步骤（含坐标，供 GuideOverlay 消费） */
    val activeStep: ActiveGuideStep?
        get() {
            if (!isVisible || stepDefs.isEmpty()) return null
            val def = stepDefs.getOrNull(currentIndex) ?: return null
            return ActiveGuideStep(
                def = def,
                targetBounds = targets[def.targetKey],
                stepIndex = currentIndex,
                totalSteps = stepDefs.size,
                isFirst = currentIndex == 0,
                isLast = currentIndex == stepDefs.size - 1,
            )
        }

    /** 初始化步骤列表（仅首次调用生效） */
    fun setSteps(steps: List<GuideStepDef>) {
        if (stepDefs.isEmpty()) stepDefs = steps
    }

    /** 注册 UI 元素坐标（在 onGloballyPositioned 中调用） */
    fun registerTarget(key: String, bounds: Rect) {
        if (bounds.width > 0f && bounds.height > 0f) targets[key] = bounds
    }

    /** 从指定步骤开始展示引导 */
    fun startGuide(fromIndex: Int = 0) {
        currentIndex = fromIndex.coerceIn(0, (stepDefs.size - 1).coerceAtLeast(0))
        isVisible = true
    }

    /** 前进到下一步（最后一步则完成引导） */
    fun next() {
        if (currentIndex < stepDefs.size - 1) currentIndex++ else completeOnboarding()
    }

    /** 后退到上一步 */
    fun prev() {
        if (currentIndex > 0) currentIndex--
    }

    /**
     * 跳转到指定步骤 ID（只能前进）。
     * 通常用于事件驱动的自动推进（话题点击 → 探索任务步骤）。
     */
    fun advanceTo(stepId: String) {
        val idx = stepDefs.indexOfFirst { it.id == stepId }
        if (idx > currentIndex) currentIndex = idx
    }

    /** 标记引导完成并持久化 */
    fun completeOnboarding() {
        isVisible = false
        isOnboardingComplete = true
        saveCompletion(true)
    }

    /** 临时隐藏引导（不标记完成，重启后继续） */
    fun dismiss() { isVisible = false }
}

/** 通过 CompositionLocal 注入 GuideController */
val LocalGuideController = staticCompositionLocalOf<GuideController?> { null }

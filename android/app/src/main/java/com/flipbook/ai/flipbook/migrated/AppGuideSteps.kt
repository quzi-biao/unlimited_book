package com.flipbook.ai.flipbook.migrated

import androidx.compose.ui.unit.dp
import com.flipbook.ai.BuildConfig
import com.flipbook.ai.flipbook.migrated.components.common.GuideStepDef
import com.flipbook.ai.flipbook.migrated.components.common.TooltipAnchor

/** 初次使用的引导步骤；保持原有顺序和行为。 */
internal fun appGuideSteps(): List<GuideStepDef> = listOf(
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
                    anchor = if (BuildConfig.PHONE_UI) TooltipAnchor.Below else TooltipAnchor.Above,
                    showPrev = false,  // 已完成导航，不回退
                    highlightCornerRadius = 22.dp, // CircleButton: 44dp 圆形按鈕
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "toolbar_book",
                    targetKey = "toolbar_book_name",
                    message = "显示当前书本名称\n点击可查看\n该书所有页面列表",
                    anchor = if (BuildConfig.PHONE_UI) TooltipAnchor.Below else TooltipAnchor.Above,
                    highlightCornerRadius = 22.dp, // PillButton: RoundedCornerShape(22.dp)
                    nextLabel = "下一步",
                ),
                GuideStepDef(
                    id = "toolbar_page",
                    targetKey = "toolbar_page_name",
                    message = "显示当前书页名称\n点击可查看\nAI 生成的页面详细解析",
                    anchor = if (BuildConfig.PHONE_UI) TooltipAnchor.Below else TooltipAnchor.Above,
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

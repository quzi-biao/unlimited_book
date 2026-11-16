package com.flipbook.ai.flipbook.migrated.components.shelfpanel

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.components.common.LocalGuideController

/** 分类与话题列表，宽屏放在书架右侧，窄屏替换书本列表。 */
@Composable
internal fun ShelfTopics(
    categories: List<TopicCategory>,
    activeCategoryId: String?,
    loadingCats: Boolean,
    guidePending: Boolean,
    onCategorySelected: (String) -> Unit,
    onSelectTopic: (ShelfTopic) -> Unit,
) {
    val guideController = LocalGuideController.current
    val active = categories.firstOrNull { it.id == activeCategoryId }

    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0x33000000)),
    ) {
        // 分类列表 (.categoriesCol)
        LazyColumn(
            modifier = Modifier
                .width(120.dp)
                .fillMaxHeight()
                .padding(vertical = 8.dp),
        ) {
            if (loadingCats) {
                item {
                    Text(
                        "加载中…",
                        color = Color(0xFF9CA3AF),
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                    )
                }
            }
            items(categories, key = { it.id }) { c ->
                val isCatActive = activeCategoryId == c.id
                // 对应 .categoryItem / .categoryActive：左侧 3dp 竖条 + indigo bg
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (isCatActive) Color(0x1A6366F1) else Color.Transparent,
                        )
                        .clickable { onCategorySelected(c.id) }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // 左侧激活竖条，对应 .categoryActive::before
                    if (isCatActive) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .height(16.dp)
                                .background(Color(0xFF6366F1), RoundedCornerShape(0.dp, 4.dp, 4.dp, 0.dp))
                                .padding(end = 8.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(
                        c.name,
                        color = if (isCatActive) Color(0xFFE5E7EB) else Color(0xFF9CA3AF),
                        fontSize = 14.sp,
                        fontWeight = if (isCatActive) FontWeight.Medium else FontWeight.Normal,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }

        // 分类/话题间的竖线
        Divider(
            modifier = Modifier
                .fillMaxHeight()
                .width(1.dp),
            color = Color(0x0DFFFFFF),
        )

        // 话题列表 (.topicsCol)，注册到 topic_list key
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .padding(8.dp)
                .onGloballyPositioned { coords ->
                    guideController?.registerTarget("topic_list", coords.boundsInRoot())
                },
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            val topics = active?.topics ?: emptyList()

            if (topics.isEmpty() && !loadingCats) {
                item {
                    Text(
                        "暂无话题",
                        color = Color(0xFF9CA3AF),
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 20.dp, start = 14.dp),
                    )
                }
            }
            items(topics, key = { it.id }) { topic ->
                val isFirstTopic = guidePending && topics.indexOf(topic) == 0
                // 对应 .topicItem：hover 白色透明 bg，带 ChevronRight
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .then(
                            // 第一个 topic 注册位置，触发引导
                            if (isFirstTopic) {
                                Modifier.onGloballyPositioned { coords ->
                                    val bounds = coords.boundsInRoot()
                                    if (bounds.width > 0f) {
                                        guideController?.registerTarget("first_topic", bounds)
                                        // 不再自动 show，由 GuideController 步骤驱动
                                    }
                                }
                            } else Modifier
                        )
                        .clickable {
                            onSelectTopic(topic)
                        }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // .topicName
                    Text(
                        topic.name,
                        color = Color(0xFFE5E7EB),
                        fontSize = 14.sp,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    // .topicArrow
                    Icon(
                        Icons.Rounded.ChevronRight,
                        contentDescription = null,
                        tint = Color(0x80FFFFFF),
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
    }
}

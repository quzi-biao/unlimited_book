package com.flipbook.ai.flipbook.migrated.utils

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

private const val CENTER_DIST = 0.05f
private const val SIZE_RATIO = 0.30f

data class NormalizedBox(
    val x: Float,
    val y: Float,
    val w: Float,
    val h: Float,
)

data class AnnotationItem(
    val id: String,
    val box: NormalizedBox,
    val exploredPageId: String? = null,
)

data class AnnotationCenterGroup(
    val cx: Float,
    val cy: Float,
    val items: List<AnnotationItem>,
)

/** 对应 WebView: utils/annotationGroup.js */
fun findDuplicate(newBox: NormalizedBox, annotations: List<AnnotationItem>): AnnotationItem? {
    return annotations.firstOrNull { ann ->
        centerDist(newBox, ann.box) < CENTER_DIST && sizeClose(newBox, ann.box)
    }
}

/** 对应 WebView: utils/annotationGroup.js */
fun groupByCenter(annotations: List<AnnotationItem>): List<AnnotationCenterGroup> {
    if (annotations.isEmpty()) return emptyList()
    val groups = mutableListOf<MutableGroup>()
    for (ann in annotations) {
        val cx = ann.box.x + ann.box.w / 2f
        val cy = ann.box.y + ann.box.h / 2f
        var placed = false
        for (group in groups) {
            val dist = sqrt((cx - group.cx) * (cx - group.cx) + (cy - group.cy) * (cy - group.cy))
            if (dist < CENTER_DIST) {
                group.items.add(ann)
                val n = group.items.size.toFloat()
                group.cx = group.items.sumOf { (it.box.x + it.box.w / 2f).toDouble() }.toFloat() / n
                group.cy = group.items.sumOf { (it.box.y + it.box.h / 2f).toDouble() }.toFloat() / n
                placed = true
                break
            }
        }
        if (!placed) {
            groups.add(MutableGroup(cx = cx, cy = cy, items = mutableListOf(ann)))
        }
    }
    return groups.map { g -> AnnotationCenterGroup(cx = g.cx, cy = g.cy, items = g.items.toList()) }
}

private data class MutableGroup(
    var cx: Float,
    var cy: Float,
    val items: MutableList<AnnotationItem>,
)

private fun centerDist(a: NormalizedBox, b: NormalizedBox): Float {
    val acx = a.x + a.w / 2f
    val acy = a.y + a.h / 2f
    val bcx = b.x + b.w / 2f
    val bcy = b.y + b.h / 2f
    return sqrt((acx - bcx) * (acx - bcx) + (acy - bcy) * (acy - bcy))
}

private fun sizeClose(a: NormalizedBox, b: NormalizedBox): Boolean {
    val dw = abs(a.w - b.w) / max(max(a.w, b.w), 0.001f)
    val dh = abs(a.h - b.h) / max(max(a.h, b.h), 0.001f)
    return dw < SIZE_RATIO && dh < SIZE_RATIO
}

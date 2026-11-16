package com.flipbook.ai.flipbook.migrated.utils

/** 目录中的一行；保留原节点，让点击跳转继续使用原页面信息。 */
data class VisibleTreeRow<T>(val node: T, val depth: Int)

/**
 * 按原树的先序顺序生成已展开节点的行。
 * 使用显式栈，避免目录深度转化为递归布局或递归调用深度。
 */
fun <T> flattenVisibleTree(
    roots: List<T>,
    childrenOf: (T) -> List<T>,
    isExpanded: (T) -> Boolean,
): List<VisibleTreeRow<T>> {
    val rows = mutableListOf<VisibleTreeRow<T>>()
    val pending = ArrayDeque<VisibleTreeRow<T>>()
    roots.asReversed().forEach { pending.addLast(VisibleTreeRow(it, 0)) }
    while (pending.isNotEmpty()) {
        val row = pending.removeLast()
        rows.add(row)
        if (isExpanded(row.node)) {
            childrenOf(row.node).asReversed().forEach { child ->
                pending.addLast(VisibleTreeRow(child, row.depth + 1))
            }
        }
    }
    return rows
}

/** 查找从根到目标页的路径，使用迭代器栈以支持深层目录并保留原节点。 */
fun <T> findTreePath(
    roots: List<T>,
    childrenOf: (T) -> List<T>,
    matches: (T) -> Boolean,
): List<T> {
    val path = mutableListOf<T>()
    val levels = ArrayDeque<Iterator<T>>()
    levels.addLast(roots.iterator())
    while (levels.isNotEmpty()) {
        val siblings = levels.last()
        if (!siblings.hasNext()) {
            levels.removeLast()
            if (path.isNotEmpty()) path.removeAt(path.lastIndex)
            continue
        }
        val node = siblings.next()
        path.add(node)
        if (matches(node)) return path.toList()
        levels.addLast(childrenOf(node).iterator())
    }
    return emptyList()
}

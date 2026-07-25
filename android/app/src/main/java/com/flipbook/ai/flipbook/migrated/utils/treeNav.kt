package com.flipbook.ai.flipbook.migrated.utils

import com.flipbook.ai.flipbook.migrated.api.PageNode

data class FlatPageNode(
    val id: String,
    val imageUrl: String? = null,
    val prompt: String? = null,
    val title: String? = null,
)

/** 对应 WebView: utils/treeNav.js */
fun flattenTree(nodes: List<PageNode>?): List<FlatPageNode> {
    val result = mutableListOf<FlatPageNode>()
    fun dfs(list: List<PageNode>) {
        list.forEach { node ->
            result += FlatPageNode(
                id = node.id,
                imageUrl = node.imageUrl,
                prompt = node.prompt,
                title = node.title,
            )
            if (node.children.isNotEmpty()) {
                dfs(node.children)
            }
        }
    }
    dfs(nodes ?: emptyList())
    return result
}

/** 对应 WebView: utils/treeNav.js */
fun treeNeighbor(
    flat: List<FlatPageNode>,
    currentId: String,
    delta: Int,
): FlatPageNode? {
    val idx = flat.indexOfFirst { it.id == currentId }
    if (idx < 0) return null
    return flat.getOrNull(idx + delta)
}

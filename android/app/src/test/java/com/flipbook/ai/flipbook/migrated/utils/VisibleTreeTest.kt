package com.flipbook.ai.flipbook.migrated.utils

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/** 目录扁平化回归测试：顺序、折叠语义与深层树都不依赖安卓设备。 */
class VisibleTreeTest {
    private class Node(val id: String, val children: List<Node> = emptyList())

    /** 空目录不产生列表行。 */
    @Test
    fun emptyTreeHasNoRows() {
        assertTrue(flattenVisibleTree(emptyList<Node>(), { it.children }, { true }).isEmpty())
    }

    /** 保留父子先序、同级顺序及原节点对象，跳转信息不被重新构造。 */
    @Test
    fun expandedTreePreservesOrderDepthAndPageIdentity() {
        val grandchild = Node("grandchild")
        val child = Node("child", listOf(grandchild))
        val sibling = Node("sibling")
        val root = Node("root", listOf(child, sibling))
        val secondRoot = Node("secondRoot")

        val rows = flattenVisibleTree(listOf(root, secondRoot), { it.children }, { true })

        assertEquals(listOf("root", "child", "grandchild", "sibling", "secondRoot"), rows.map { it.node.id })
        assertEquals(listOf(0, 1, 2, 1, 0), rows.map { it.depth })
        assertSame(grandchild, rows[2].node)
        assertSame(secondRoot, rows[4].node)
    }

    /** 折叠只隐藏后代，同级节点保留；重新展开恢复原来的节点与次序。 */
    @Test
    fun collapsedBranchSkipsItsChildrenAndReopensInPlace() {
        val hidden = Node("hidden")
        val branch = Node("branch", listOf(hidden))
        val sibling = Node("sibling")
        val roots = listOf(Node("root", listOf(branch, sibling)))
        val expanded = mutableMapOf("branch" to false)
        val visited = mutableListOf<String>()
        val collapsedRows = flattenVisibleTree(
            roots,
            childrenOf = { visited.add(it.id); it.children },
            isExpanded = { expanded[it.id] ?: true },
        )

        assertEquals(listOf("root", "branch", "sibling"), collapsedRows.map { it.node.id })
        assertTrue("branch" !in visited)
        assertTrue("hidden" !in visited)

        expanded["branch"] = true
        val reopenedRows = flattenVisibleTree(roots, { it.children }, { expanded[it.id] ?: true })
        assertEquals(listOf("root", "branch", "hidden", "sibling"), reopenedRows.map { it.node.id })
        assertSame(hidden, reopenedRows[2].node)
    }

    /** 折叠一棵树的根节点不会隐藏另一棵树。 */
    @Test
    fun collapsedRootKeepsOtherRootsVisible() {
        val roots = listOf(Node("first", listOf(Node("hidden"))), Node("second", listOf(Node("visible"))))
        val rows = flattenVisibleTree(roots, { it.children }, { it.id != "first" })
        assertEquals(listOf("first", "second", "visible"), rows.map { it.node.id })
        assertEquals(listOf(0, 0, 1), rows.map { it.depth })
    }

    /** 复现森林话题的 53 页、16 层目录形状，不包含真实页面内容。 */
    @Test
    fun forestBookKeepsAllPagesInOrderAndCollapsesOnlySelectedBranch() {
        val parents = listOf(
            -1, 0, 0, 2, 3, 0, 0, 6, 7, 8, 9, 10, 11, 6, 13, 8, 15, 0,
            17, 18, 13, 5, 5, 5, 23, 23, 18, 0, 16, 28, 29, 13, 27, 20,
            33, 33, 7, 36, 37, 24, 7, 29, 41, 42, 43, 43, 45, 43, 47, 48,
            49, 50, 2,
        )
        val children = List(parents.size) { mutableListOf<Int>() }
        parents.forEachIndexed { id, parent -> if (parent >= 0) children[parent].add(id) }
        val nodes = arrayOfNulls<Node>(parents.size)
        for (id in parents.indices.reversed()) {
            nodes[id] = Node(id.toString(), children[id].map { checkNotNull(nodes[it]) })
        }
        val roots = parents.indices.filter { parents[it] == -1 }.map { checkNotNull(nodes[it]) }

        val rows = flattenVisibleTree(roots, { it.children }, { true })
        val expectedOrder = listOf(
            0, 1, 2, 3, 4, 52, 5, 21, 22, 23, 24, 39, 25, 6, 7, 8, 9, 10,
            11, 12, 15, 16, 28, 29, 30, 41, 42, 43, 44, 45, 46, 47, 48,
            49, 50, 51, 36, 37, 38, 40, 13, 14, 20, 33, 34, 35, 31, 17,
            18, 19, 26, 27, 32,
        )
        assertEquals(53, rows.size)
        assertEquals(15, rows.maxOf { it.depth })
        assertEquals(expectedOrder.map { it.toString() }, rows.map { it.node.id })
        rows.forEach { assertSame(nodes[it.node.id.toInt()], it.node) }

        val collapsed = flattenVisibleTree(roots, { it.children }, { it.id != "6" })
        val expectedCollapsed = listOf(0, 1, 2, 3, 4, 52, 5, 21, 22, 23, 24, 39, 25, 6, 17, 18, 19, 26, 27, 32)
        assertEquals(expectedCollapsed.map { it.toString() }, collapsed.map { it.node.id })
    }

    /** 两万层仍使用显式栈，不发生递归调用栈溢出或重复遍历。 */
    @Test(timeout = 5000)
    fun deeplyNestedTreeVisitsEachNodeOnce() {
        val count = 20_000
        var root = Node((count - 1).toString())
        for (id in count - 2 downTo 0) root = Node(id.toString(), listOf(root))
        var visits = 0

        val rows = flattenVisibleTree(listOf(root), { visits++; it.children }, { true })

        assertEquals(count, rows.size)
        assertEquals(count, visits)
        assertEquals(count - 1, rows.last().depth)
        assertEquals((count - 1).toString(), rows.last().node.id)
    }
}

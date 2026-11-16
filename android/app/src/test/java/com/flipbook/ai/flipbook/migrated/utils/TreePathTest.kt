package com.flipbook.ai.flipbook.migrated.utils

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/** 当前页定位回归：祖先路径、跨根节点、缺失页面和深层目录。 */
class TreePathTest {
    private class Node(val id: String, val children: List<Node> = emptyList())

    @Test
    fun pathExcludesPreviousSiblingsAndKeepsOriginalNodes() {
        val target = Node("target")
        val branch = Node("branch", listOf(Node("before"), target, Node("after")))
        val root = Node("root", listOf(Node("other", listOf(Node("unrelated"))), branch))
        val path = findTreePath(listOf(root), { it.children }, { it.id == "target" })
        assertEquals(listOf("root", "branch", "target"), path.map { it.id })
        assertSame(root, path[0])
        assertSame(branch, path[1])
        assertSame(target, path[2])
    }

    @Test
    fun locatingCurrentPageExpandsOnlyItsAncestors() {
        val target = Node("target")
        val branch = Node("branch", listOf(target))
        val other = Node("other", listOf(Node("hidden")))
        val root = Node("root", listOf(other, branch))
        val expanded = mutableMapOf("root" to false, "branch" to false, "other" to false, "target" to false)
        val path = findTreePath(listOf(root), { it.children }, { it.id == "target" })
        path.dropLast(1).forEach { expanded[it.id] = true }
        val rows = flattenVisibleTree(listOf(root), { it.children }, { expanded[it.id] ?: true })
        assertEquals(listOf("root", "other", "branch", "target"), rows.map { it.node.id })
        assertEquals(3, rows.indexOfFirst { it.node.id == "target" })
        assertEquals(2, rows.last().depth)
        assertEquals(false, expanded["other"])
        assertEquals(false, expanded["target"])
    }

    @Test
    fun targetInSecondRootDoesNotIncludeFirstRoot() {
        val target = Node("target")
        val roots = listOf(Node("first", listOf(Node("first-child"))), Node("second", listOf(target)))
        assertEquals(listOf("second", "target"), findTreePath(roots, { it.children }, { it.id == "target" }).map { it.id })
        assertEquals(listOf(roots[1]), findTreePath(roots, { it.children }, { it.id == "second" }))
    }

    @Test
    fun missingOrNotYetLoadedPageHasNoPosition() {
        assertTrue(findTreePath(emptyList<Node>(), { it.children }, { true }).isEmpty())
        assertTrue(findTreePath(listOf(Node("root", listOf(Node("child")))), { it.children }, { it.id == "missing" }).isEmpty())
    }

    @Test(timeout = 5000)
    fun deeplyNestedTargetDoesNotUseRecursiveCalls() {
        val count = 20_000
        var root = Node((count - 1).toString())
        for (id in count - 2 downTo 0) root = Node(id.toString(), listOf(root))
        var visits = 0
        val path = findTreePath(listOf(root), { it.children }, { visits++; it.id == (count - 1).toString() })
        assertEquals(count, visits)
        assertEquals(count, path.size)
        assertSame(root, path.first())
        assertEquals((count - 1).toString(), path.last().id)
    }
}

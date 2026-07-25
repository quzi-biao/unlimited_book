package com.flipbook.ai.flipbook.migrated.components.shelfpanel

import androidx.compose.ui.graphics.Color

/** 对应 WebView: components/ShelfPanel/BookGraph.module.css */
object BookGraphStyle {
    // .state color: var(--muted)
    val StateText = Color(0xFF9CA3AF)
    // .node background: transparent
    val NodeBg = Color(0x00000000)
    // .node:hover background: rgba(255,255,255,0.05)
    val NodeHover = Color(0x0DFFFFFF)
    val NodePressed = Color(0x14FFFFFF)
    // .node border: transparent
    val NodeBorder = Color(0x00000000)
    // .node:hover border-color: rgba(255,255,255,0.08)
    val NodeHoverBorder = Color(0x14FFFFFF)
    // .nodeActive background: rgba(99,102,241,0.14)
    val NodeActiveBg = Color(0x246366F1)
    // .nodeActive border-color: rgba(99,102,241,0.35)
    val NodeActiveBorder = Color(0x596366F1)
    // .label color: var(--text) ≈ rgba(255,255,255,0.85)
    val Label = Color(0xD9FFFFFF)
    // .nodeActive .label color: #c7d2fe
    val LabelActive = Color(0xFFC7D2FE)
    // .sub color: var(--muted)
    val Sub = Color(0xFF9CA3AF)
    // .line background: rgba(255,255,255,0.1)
    val Line = Color(0x1AFFFFFF)
    // .children border-left: rgba(255,255,255,0.08)
    val ChildrenLine = Color(0x14FFFFFF)
    // .thumb background: rgba(255,255,255,0.06)
    val ThumbBg = Color(0x0FFFFFFF)
    // .thumb border: rgba(255,255,255,0.08)
    val ThumbBorder = Color(0x14FFFFFF)
    // .thumbEmpty background: rgba(255,255,255,0.04)
    val ThumbEmptyBg = Color(0x0AFFFFFF)
    // .thumbEmpty border: rgba(255,255,255,0.1) dashed
    val ThumbEmptyBorder = Color(0x1AFFFFFF)
}

package com.flipbook.ai.flipbook.migrated.components.common

import android.text.Html
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.flipbook.ai.ui.AlibabaPuHuiTi

/** 纯 Compose 富文本渲染，避免 AndroidView 在深色弹窗里出现白底。 */
@Composable
fun RichText(
    content: String,
    color: Color,
    textSizeSp: Float,
    modifier: Modifier = Modifier,
) {
    val richText = remember(content, color, textSizeSp) {
        parseRichText(content, color, textSizeSp)
    }
    Text(
        text = richText,
        color = color,
        style = TextStyle(
            fontFamily = AlibabaPuHuiTi,
            fontSize = TextUnit.Unspecified,
        ),
        fontSize = textSizeSp.sp,
        lineHeight = (textSizeSp + 7f).sp,
        modifier = modifier,
    )
}

private fun toPlainText(raw: String): String {
    if (raw.isBlank()) return ""
    val looksLikeHtml = Regex("<[a-zA-Z/][^>]*>").containsMatchIn(raw)
    if (!looksLikeHtml) return raw
    return Html.fromHtml(raw, Html.FROM_HTML_MODE_LEGACY)
        .toString()
        .replace(Regex("\n{3,}"), "\n\n")
        .trim()
}

private fun parseRichText(raw: String, color: Color, textSizeSp: Float): AnnotatedString {
    val text = toPlainText(raw)
    if (text.isBlank()) return AnnotatedString("")

    return buildAnnotatedString {
        text.lines().forEachIndexed { index, sourceLine ->
            val line = sourceLine.trimEnd()
            val heading = Regex("^(#{1,6})\\s+(.+)$").find(line)
            val bullet = Regex("^[-*+]\\s+(.+)$").find(line)
            val ordered = Regex("^\\d+[.)]\\s+(.+)$").find(line)

            when {
                heading != null -> {
                    val level = heading.groupValues[1].length
                    val body = heading.groupValues[2]
                    val size = (textSizeSp + (7 - level).coerceAtLeast(1) * 0.8f).sp
                    // 对应 CSS: h1/h2/h3 color: #c7d2fe（indigo-200）
                    pushStyle(
                        SpanStyle(
                            color = Color(0xFFC7D2FE),
                            fontFamily = AlibabaPuHuiTi,
                            fontWeight = FontWeight.Bold,
                            fontSize = size,
                        ),
                    )
                    appendInlineMarkdown(body)
                    pop()
                }

                bullet != null -> {
                    // 对应 CSS: li::marker color: #818cf8（indigo-400）
                    pushStyle(SpanStyle(color = Color(0xFF818CF8)))
                    append("• ")
                    pop()
                    appendInlineMarkdown(bullet.groupValues[1])
                }

                ordered != null -> {
                    appendInlineMarkdown(line)
                }

                else -> appendInlineMarkdown(line)
            }

            if (index != text.lines().lastIndex) append("\n")
        }
    }
}

private fun AnnotatedString.Builder.appendInlineMarkdown(line: String) {
    var i = 0
    while (i < line.length) {
        when {
            line.startsWith("**", i) -> {
                val end = line.indexOf("**", startIndex = i + 2)
                if (end > i + 2) {
                    // 对应 CSS: strong color: #ffffff
                    pushStyle(SpanStyle(fontFamily = AlibabaPuHuiTi, fontWeight = FontWeight.Bold, color = Color.White))
                    append(line.substring(i + 2, end))
                    pop()
                    i = end + 2
                } else {
                    append(line[i])
                    i += 1
                }
            }

            line.startsWith("__", i) -> {
                val end = line.indexOf("__", startIndex = i + 2)
                if (end > i + 2) {
                    // 对应 CSS: strong color: #ffffff
                    pushStyle(SpanStyle(fontFamily = AlibabaPuHuiTi, fontWeight = FontWeight.Bold, color = Color.White))
                    append(line.substring(i + 2, end))
                    pop()
                    i = end + 2
                } else {
                    append(line[i])
                    i += 1
                }
            }

            line[i] == '`' -> {
                val end = line.indexOf('`', startIndex = i + 1)
                if (end > i + 1) {
                    // 对应 CSS: code color: #a5b4fc
                    pushStyle(SpanStyle(fontFamily = FontFamily.Monospace, color = Color(0xFFA5B4FC)))
                    append(line.substring(i + 1, end))
                    pop()
                    i = end + 1
                } else {
                    append(line[i])
                    i += 1
                }
            }

            line[i] == '*' -> {
                val end = line.indexOf('*', startIndex = i + 1)
                if (end > i + 1) {
                    // 对应 CSS: em color: #c4b5fd（violet-300）
                    pushStyle(SpanStyle(fontFamily = AlibabaPuHuiTi, fontStyle = FontStyle.Italic, color = Color(0xFFC4B5FD)))
                    append(line.substring(i + 1, end))
                    pop()
                    i = end + 1
                } else {
                    append(line[i])
                    i += 1
                }
            }

            line.startsWith("[", i) -> {
                val closeText = line.indexOf("](", startIndex = i + 1)
                val closeUrl = if (closeText > 0) line.indexOf(')', startIndex = closeText + 2) else -1
                if (closeText > i && closeUrl > closeText) {
                    pushStyle(SpanStyle(textDecoration = TextDecoration.Underline))
                    append(line.substring(i + 1, closeText))
                    pop()
                    i = closeUrl + 1
                } else {
                    append(line[i])
                    i += 1
                }
            }

            else -> {
                append(line[i])
                i += 1
            }
        }
    }
}

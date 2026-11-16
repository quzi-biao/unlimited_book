package com.flipbook.ai.flipbook.migrated.hooks

import android.content.Context
import com.flipbook.ai.flipbook.migrated.api.aiApi
import com.flipbook.ai.flipbook.migrated.api.booksApi
import com.flipbook.ai.flipbook.migrated.db.BookRecord
import com.flipbook.ai.flipbook.migrated.db.PageRecord
import com.flipbook.ai.flipbook.migrated.db.saveBook
import com.flipbook.ai.flipbook.migrated.db.savePage
import java.time.Instant

/** 查询并保存预生成首页，返回可直接导航的数据；缓存未就绪返回 null。 */
internal suspend fun findPreparedTopicPage(context: Context, query: String): FlipbookOpenPage? {
    val info = booksApi.topic(context, query)
    val existing = info.get("existing")?.takeIf { it.isJsonObject }?.asJsonObject
    val page = existing ?: if (info.get("prepared")?.asBoolean == true) {
        aiApi.generateImage(context, mapOf("query" to query))
    } else return null
    val bookId = page.get("bookId")?.asString ?: error("缺少书籍编号")
    val pageId = page.get("pageId")?.asString ?: error("缺少书页编号")
    val imageUrl = page.get("imageUrl")?.asString ?: error("缺少图片地址")
    val title = page.get("pageTitle")?.asString ?: query
    val bookTitle = page.get("bookTitle")?.asString ?: query
    saveBook(context, BookRecord(id = bookId, title = bookTitle, updatedAt = Instant.now().toString(), coverUrl = imageUrl))
    savePage(context, PageRecord(id = pageId, bookId = bookId, imageUrl = imageUrl, prompt = query, title = title, order = 0))
    return FlipbookOpenPage(imageUrl, pageId, bookId, title, bookTitle)
}

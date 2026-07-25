package com.flipbook.ai.flipbook.migrated.components.viewport

import com.flipbook.ai.flipbook.migrated.db.AnnotationRecord
import com.flipbook.ai.flipbook.migrated.hooks.FlipbookRegionAnnotation
import com.google.gson.JsonObject

internal fun parseAnnotation(
    pageId: String,
    response: JsonObject,
    payload: Map<String, Any>,
): AnnotationRecord {
    val annObj = response.getAsJsonObject("annotation") ?: response
    return AnnotationRecord(
        id = annObj.get("id")?.asString ?: "local-${System.currentTimeMillis()}",
        pageId = annObj.get("pageId")?.asString ?: pageId,
        x = annObj.get("x")?.asFloat ?: (payload["x"] as? Number)?.toFloat() ?: 0f,
        y = annObj.get("y")?.asFloat ?: (payload["y"] as? Number)?.toFloat() ?: 0f,
        w = annObj.get("w")?.asFloat ?: (payload["w"] as? Number)?.toFloat() ?: 0f,
        h = annObj.get("h")?.asFloat ?: (payload["h"] as? Number)?.toFloat() ?: 0f,
        explanation = annObj.get("explanation")?.asString
            ?: (payload["explanation"] as? String),
        exploredPageId = annObj.get("exploredPageId")?.asString,
    )
}

internal fun AnnotationRecord.toRegionAnnotation(): FlipbookRegionAnnotation {
    return FlipbookRegionAnnotation(
        id = id,
        x = x,
        y = y,
        w = w,
        h = h,
        explanation = explanation,
        exploredPageId = exploredPageId,
    )
}

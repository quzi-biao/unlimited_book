package com.flipbook.ai.flipbook.migrated.components.shoppage

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class ShopTab(val key: String, val label: String) {
    RECHARGE("recharge", "直接充值"),
    PLANS("plans", "套餐"),
    HISTORY("history", "订单"),
}

data class ShopWallet(
    val balance: Int = 0,
    val pointsPerYuan: Int = 100,
    val minYuan: Int = 10,
    val maxYuan: Int = 2000,
)

data class ShopPlanItem(
    val id: String,
    val name: String,
    val points: Int,
    val price: Int,
    val description: String,
    val recommended: Boolean,
)

data class ShopOrderItem(
    val id: String,
    val name: String,
    val amount: Int,
    val points: Int,
    val status: String,
    val createdAtMs: Long,
    val remainingSeconds: Int? = null,
)

data class OrderStatusUi(
    val label: String,
    val color: androidx.compose.ui.graphics.Color,
)

fun orderStatusUi(status: String): OrderStatusUi {
    return when (status) {
        "paid" -> OrderStatusUi("已支付", ShopPageStyle.Success)
        "failed" -> OrderStatusUi("支付失败", ShopPageStyle.Danger)
        "cancelled" -> OrderStatusUi("已取消", ShopPageStyle.PendingDim)
        else -> OrderStatusUi("待支付", ShopPageStyle.Warning)
    }
}

fun parseWallet(json: JsonObject, fallback: ShopWallet): ShopWallet {
    return ShopWallet(
        balance = json.intOrNull("balance") ?: fallback.balance,
        pointsPerYuan = json.intOrNull("pointsPerYuan") ?: fallback.pointsPerYuan,
        minYuan = json.intOrNull("minYuan") ?: fallback.minYuan,
        maxYuan = json.intOrNull("maxYuan") ?: fallback.maxYuan,
    )
}

fun parsePlans(json: JsonObject): List<ShopPlanItem> {
    val list = json.getAsJsonArray("plans")?.mapNotNull { el ->
        val obj = el.objectOrNull() ?: return@mapNotNull null
        val id = obj.stringOrNull("id") ?: return@mapNotNull null
        ShopPlanItem(
            id = id,
            name = obj.stringOrNull("name") ?: "套餐",
            points = obj.intOrNull("points") ?: 0,
            price = obj.intOrNull("price") ?: 0,
            description = obj.stringOrNull("description")
                ?: obj.stringOrNull("descriptionJson")
                ?: "",
            recommended = obj.boolOrNull("recommended") ?: false,
        )
    }.orEmpty()

    if (list.size < 2 || list.any { it.recommended }) return list
    val mid = list.size / 2
    return list.mapIndexed { idx, item ->
        if (idx == mid) item.copy(recommended = true) else item
    }
}

private fun parseCreatedAtMs(raw: String?): Long {
    if (raw.isNullOrBlank()) return 0L
    return runCatching { Date.parse(raw) }.getOrDefault(0L)
}

fun parseOrders(json: JsonObject): List<ShopOrderItem> {
    val now = System.currentTimeMillis()
    return json.getAsJsonArray("orders")?.mapNotNull { el ->
        val obj = el.objectOrNull() ?: return@mapNotNull null
        val id = obj.stringOrNull("id") ?: return@mapNotNull null
        val createdAtMs = parseCreatedAtMs(obj.stringOrNull("createdAt"))
        val ttlRemain = if (createdAtMs > 0L) {
            ((createdAtMs + 300_000L - now) / 1000L).toInt().coerceAtLeast(0)
        } else {
            null
        }
        val planName = obj.objectOrNull("plan")?.stringOrNull("name")
            ?: obj.stringOrNull("planName")
            ?: obj.stringOrNull("name")
            ?: "自定义充值"
        ShopOrderItem(
            id = id,
            name = planName,
            amount = obj.intOrNull("amount") ?: 0,
            points = obj.intOrNull("points") ?: 0,
            status = obj.stringOrNull("status") ?: "pending",
            createdAtMs = createdAtMs,
            remainingSeconds = obj.intOrNull("remainingSec")
                ?: obj.intOrNull("remainingSeconds")
                ?: ttlRemain,
        )
    }.orEmpty()
}

fun formatPriceFen(fen: Int): String = "¥${"%.2f".format(Locale.CHINA, fen / 100f)}"

fun formatOrderDate(createdAtMs: Long): String {
    if (createdAtMs <= 0L) return ""
    return runCatching {
        SimpleDateFormat("M月d日 HH:mm", Locale.CHINA).format(Date(createdAtMs))
    }.getOrDefault("")
}

fun toQrInfo(
    json: JsonObject,
    fallbackOrderId: String? = null,
    fallbackAmount: Int = 0,
    fallbackPoints: Int = 0,
    fallbackCountdown: Int = 300,
): QrPayInfo? {
    val orderId = json.stringOrNull("orderId")
        ?: json.stringOrNull("id")
        ?: fallbackOrderId
        ?: return null
    val codeUrl = json.stringOrNull("codeUrl")
        ?: json.stringOrNull("payUrl")
        ?: return null
    val amount = json.intOrNull("amount") ?: fallbackAmount
    val points = json.intOrNull("points") ?: fallbackPoints
    val remain = json.intOrNull("remainingSec")
        ?: json.intOrNull("remainingSeconds")
        ?: fallbackCountdown

    return QrPayInfo(
        orderId = orderId,
        codeUrl = codeUrl,
        amountFen = amount,
        points = points,
        initialCountdown = remain.coerceAtLeast(0),
    )
}

fun JsonObject.stringOrNull(key: String): String? {
    val node = get(key) ?: return null
    if (node.isJsonNull) return null
    return runCatching { node.asString }.getOrNull()
}

fun JsonObject.intOrNull(key: String): Int? {
    val node = get(key) ?: return null
    if (node.isJsonNull) return null
    return runCatching { node.asInt }.getOrNull()
}

private fun JsonObject.boolOrNull(key: String): Boolean? {
    val node = get(key) ?: return null
    if (node.isJsonNull) return null
    return runCatching { node.asBoolean }.getOrNull()
}

private fun JsonElement.objectOrNull(): JsonObject? {
    if (isJsonNull || !isJsonObject) return null
    return runCatching { asJsonObject }.getOrNull()
}

private fun JsonObject.objectOrNull(key: String): JsonObject? {
    return get(key)?.objectOrNull()
}

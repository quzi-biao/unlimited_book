package com.flipbook.ai.flipbook.migrated.components.shoppage

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountBalanceWallet
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.ShoppingCart
import androidx.compose.material.icons.rounded.Wallet
import androidx.compose.material.icons.rounded.Whatshot
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.ui.AlibabaPuHuiTi

@Composable
fun ShopNavTabs(
    tab: ShopTab,
    onTabChange: (ShopTab) -> Unit,
    balance: Int,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val tabs = listOf(
        Triple(ShopTab.RECHARGE, Icons.Rounded.Whatshot, "直接充值"),
        Triple(ShopTab.PLANS, Icons.Rounded.ShoppingCart, "套餐"),
        Triple(ShopTab.HISTORY, Icons.Rounded.History, "订单"),
    )
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 16.dp),
    ) {
        Row(
            modifier = Modifier
                .align(Alignment.Center)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 80.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.Bottom,
        ) {
            tabs.forEach { (key, icon, label) ->
                val active = tab == key
                ShopNavTabButton(
                    icon = icon,
                    label = label,
                    active = active,
                    onClick = { onTabChange(key) },
                )
            }
        }

        Row(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .clip(RoundedCornerShape(20.dp))
                .background(ShopPageStyle.VioletTint)
                .border(1.dp, Color(0x40A78BFA), RoundedCornerShape(20.dp))
                .padding(horizontal = 12.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.Wallet, contentDescription = null, tint = ShopPageStyle.Violet, modifier = Modifier.size(14.dp))
            Text("${balance} 点", color = ShopPageStyle.Violet, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(ShopPageStyle.BorderThin),
    )
}

@Composable
private fun ShopNavTabButton(
    icon: ImageVector,
    label: String,
    active: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .background(if (active) ShopPageStyle.VioletTint else Color.Transparent, RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
            .drawBehind {
                if (active) {
                    val lineHeight = 2.dp.toPx()
                    drawRect(
                        color = ShopPageStyle.Violet,
                        topLeft = Offset(0f, size.height - lineHeight),
                        size = Size(size.width, lineHeight),
                    )
                }
            }
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, contentDescription = null, tint = if (active) ShopPageStyle.Violet else ShopPageStyle.TextMuted, modifier = Modifier.size(15.dp))
        Text(
            text = label,
            color = if (active) ShopPageStyle.Violet else ShopPageStyle.TextMuted,
            fontSize = 11.sp,
        )
    }
}

@Composable
fun ShopTopBar(
    balance: Int,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .width(34.dp)
                .height(34.dp)
                .clip(CircleShape)
                .background(Color(0x14FFFFFF))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.ArrowBack, contentDescription = "返回", tint = ShopPageStyle.TextSoft)
        }

        Text(
            text = "学习点数充值",
            color = ShopPageStyle.TextStrong,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .weight(1f)
                .padding(start = 10.dp),
        )

        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(ShopPageStyle.VioletTint)
                .border(1.dp, Color(0x40A78BFA), RoundedCornerShape(20.dp))
                .padding(horizontal = 12.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.Wallet, contentDescription = null, tint = ShopPageStyle.Violet)
            Text("${balance} 点", color = ShopPageStyle.Violet, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun ShopTabs(
    tab: ShopTab,
    onTabChange: (ShopTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val tabs = listOf(
        Triple(ShopTab.RECHARGE, Icons.Rounded.Whatshot, "直接充值"),
        Triple(ShopTab.PLANS, Icons.Rounded.ShoppingCart, "套餐"),
        Triple(ShopTab.HISTORY, Icons.Rounded.History, "订单"),
    )
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .border(1.dp, ShopPageStyle.BorderThin, RoundedCornerShape(10.dp))
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        tabs.forEach { (key, icon, label) ->
            val active = tab == key
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (active) ShopPageStyle.VioletTint else Color.Transparent)
                    .clickable { onTabChange(key) }
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = if (active) ShopPageStyle.Violet else ShopPageStyle.TextMuted,
                    modifier = Modifier.padding(end = 4.dp),
                )
                Text(
                    text = label,
                    color = if (active) ShopPageStyle.Violet else ShopPageStyle.TextMuted,
                    fontSize = 13.sp,
                )
            }
        }
    }
}

@Composable
fun ShopHint(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        color = ShopPageStyle.TextMuted,
        fontSize = 13.sp,
        textAlign = TextAlign.Center,
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 36.dp),
    )
}

@Composable
fun DirectRechargeCard(
    wallet: ShopWallet,
    buying: Boolean,
    onPay: (Double) -> Unit,
    modifier: Modifier = Modifier,
) {
    var amountText by remember(wallet.minYuan, wallet.maxYuan) { mutableStateOf(wallet.minYuan.toString()) }
    val amount = amountText.toDoubleOrNull() ?: 0.0
    val valid = amount >= wallet.minYuan && amount <= wallet.maxYuan
    val points = if (amount > 0) kotlin.math.floor(amount * wallet.pointsPerYuan).toInt() else 0

    val presets = remember(wallet.minYuan, wallet.maxYuan) {
        listOf(10, 30, 50, 100, 200, 500, 1000, 2000)
            .filter { it in wallet.minYuan..wallet.maxYuan }
            .ifEmpty { listOf(wallet.minYuan.coerceAtLeast(1)) }
            .take(8)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(ShopPageStyle.CardBg)
            .border(1.dp, Color(0x33A78BFA), RoundedCornerShape(18.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.AccountBalanceWallet, contentDescription = null, tint = Color(0xFFFBBF24))
            Text(
                text = "直接充值",
                color = ShopPageStyle.TextMain,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 6.dp),
            )
            Text(
                text = "${wallet.pointsPerYuan} 点 / 元",
                color = Color(0xCCA78BFA),
                fontSize = 11.sp,
                modifier = Modifier
                    .padding(start = 8.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0x1AA78BFA))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }

        presets.chunked(4).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                row.forEach { preset ->
                    val active = amountText == preset.toString()
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .height(58.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (active) Color(0x2EA78BFA) else Color(0x0DFFFFFF))
                            .border(
                                width = if (active) 1.5.dp else 1.dp,
                                color = if (active) ShopPageStyle.Violet else Color(0x1FFFFFFF),
                                shape = RoundedCornerShape(12.dp),
                            )
                            .clickable(enabled = !buying) { amountText = preset.toString() }
                            .padding(vertical = 7.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text("¥$preset", color = if (active) ShopPageStyle.Violet else ShopPageStyle.TextSoft, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${(preset * wallet.pointsPerYuan)}点",
                            color = ShopPageStyle.TextMuted,
                            fontSize = 10.sp,
                        )
                    }
                }
                repeat(4 - row.size) {
                    SpacerBox(modifier = Modifier.weight(1f))
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(ShopPageStyle.InputBg)
                .border(1.5.dp, Color(0x1FFFFFFF), RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("¥", color = ShopPageStyle.TextMuted, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            BasicTextField(
                value = amountText,
                onValueChange = { next ->
                    if (Regex("^\\d*\\.?\\d*$").matches(next)) amountText = next
                },
                singleLine = true,
                textStyle = TextStyle(
                    color = ShopPageStyle.TextStrong,
                    fontFamily = AlibabaPuHuiTi,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 6.dp),
                decorationBox = { inner ->
                    if (amountText.isBlank()) {
                        Text(
                            text = "${wallet.minYuan} - ${wallet.maxYuan}",
                            color = Color(0x2FFFFFFF),
                            fontSize = 16.sp,
                        )
                    }
                    inner()
                },
            )
            Text("元", color = ShopPageStyle.TextMuted, fontSize = 14.sp)
        }

        Text(
            text = "充值范围：¥${wallet.minYuan} - ¥${wallet.maxYuan}",
            color = ShopPageStyle.TextMuted,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        if (points > 0) {
            Text(
                text = "充值后获得 ${points} 点",
                color = ShopPageStyle.TextSoft,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(46.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(ShopPageStyle.PrimaryBtn)
                .clickable(enabled = !buying && valid) { onPay(amount) },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (buying) "下单中..." else "立即充值 ¥${amountText.ifBlank { "—" }}",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
fun PlansGrid(
    plans: List<ShopPlanItem>,
    buying: Boolean,
    onBuy: (ShopPlanItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        plans.chunked(2).forEach { rowPlans ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                rowPlans.forEach { plan ->
                    PlanCard(plan = plan, buying = buying, onBuy = onBuy, modifier = Modifier.weight(1f))
                }
                repeat(2 - rowPlans.size) {
                    SpacerBox(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun PlanCard(
    plan: ShopPlanItem,
    buying: Boolean,
    onBuy: (ShopPlanItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (plan.recommended) Color(0x14A78BFA) else ShopPageStyle.CardBg)
            .border(1.dp, if (plan.recommended) Color(0x52A78BFA) else ShopPageStyle.BorderSoft, RoundedCornerShape(14.dp))
            .clickable(enabled = !buying) { onBuy(plan) }
            .padding(horizontal = 12.dp, vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (plan.recommended) {
            Text(
                text = "推荐",
                color = Color.White,
                fontSize = 10.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
                    .background(ShopPageStyle.PrimaryBtn)
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }
        Text(plan.name, color = ShopPageStyle.TextSoft, fontSize = 12.sp)
        Text(plan.points.toString(), color = ShopPageStyle.Violet, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
        Text(formatPriceFen(plan.price), color = ShopPageStyle.TextStrong, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        if (plan.description.isNotBlank()) {
            Text(plan.description, color = ShopPageStyle.TextMuted, fontSize = 11.sp, textAlign = TextAlign.Center)
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(32.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(ShopPageStyle.PrimaryBtn)
                .clickable(enabled = !buying) { onBuy(plan) },
            contentAlignment = Alignment.Center,
        ) {
            Text(if (buying) "下单中..." else "购买", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun OrderHistoryList(
    orders: List<ShopOrderItem>,
    reopeningOrderId: String?,
    onReopen: (ShopOrderItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        orders.forEach { order ->
            val pending = order.status == "pending"
            val statusUi = orderStatusUi(order.status)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0x08FFFFFF))
                    .border(
                        1.dp,
                        if (pending) Color(0x40FAAD14) else ShopPageStyle.BorderSoft,
                        RoundedCornerShape(10.dp),
                    )
                    .padding(horizontal = 14.dp, vertical = 11.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(order.name, color = ShopPageStyle.TextMain, fontSize = 13.sp)
                    Text(formatOrderDate(order.createdAtMs), color = ShopPageStyle.TextMuted, fontSize = 11.sp)
                }

                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("+${order.points} 点", color = ShopPageStyle.Violet, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text(formatPriceFen(order.amount), color = ShopPageStyle.TextMuted, fontSize = 11.sp)
                    if (pending) {
                        Text(
                            text = if (reopeningOrderId == order.id) "唤起中..." else "继续支付",
                            color = ShopPageStyle.Warning,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0x14FAAD14))
                                .border(1.dp, Color(0x66FAAD14), RoundedCornerShape(8.dp))
                                .clickable(enabled = reopeningOrderId == null) { onReopen(order) }
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    } else {
                        Text(statusUi.label, color = statusUi.color, fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun CenterBody(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 20.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 400.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            content()
        }
    }
}

@Composable
private fun SpacerBox(modifier: Modifier) {
    Box(modifier = modifier)
}

package com.flipbook.ai.flipbook.migrated.components.shoppage

import com.flipbook.ai.flipbook.migrated.components.common.LocalCompactLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountBalanceWallet
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.ShoppingCart
import androidx.compose.material.icons.rounded.Whatshot
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flipbook.ai.flipbook.migrated.api.paymentApi
import com.flipbook.ai.flipbook.migrated.api.plansApi
import com.flipbook.ai.flipbook.migrated.api.walletApi
import kotlinx.coroutines.launch

/** 对应 WebView: components/ShopPage/ShopPage.jsx */
@Composable
fun ShopPage(
    open: Boolean,
    onBack: () -> Unit,
    onBalanceUpdate: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!open) return

    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()

    var tab by remember { mutableStateOf(ShopTab.RECHARGE) }
    var wallet by remember { mutableStateOf(ShopWallet()) }
    var plans by remember { mutableStateOf<List<ShopPlanItem>>(emptyList()) }
    var orders by remember { mutableStateOf<List<ShopOrderItem>>(emptyList()) }

    var loadingPlans by remember { mutableStateOf(false) }
    var loadingHistory by remember { mutableStateOf(false) }
    var buying by remember { mutableStateOf(false) }
    var reopeningOrderId by remember { mutableStateOf<String?>(null) }

    var actionMsg by remember { mutableStateOf("") }
    var qrInfo by remember { mutableStateOf<QrPayInfo?>(null) }

    fun reloadWallet() {
        scope.launch {
            runCatching { walletApi.info(context) }
                .onSuccess { json ->
                    wallet = parseWallet(json, wallet)
                    onBalanceUpdate(wallet.balance)
                }
                .onFailure { actionMsg = it.message.orEmpty() }
        }
    }

    fun reloadHistory() {
        scope.launch {
            loadingHistory = true
            runCatching { paymentApi.history(context) }
                .onSuccess { json ->
                    orders = parseOrders(json)
                }
                .onFailure { actionMsg = it.message.orEmpty() }
            loadingHistory = false
        }
    }

    fun loadPlansIfNeeded(force: Boolean = false) {
        if (!force && plans.isNotEmpty()) return
        scope.launch {
            loadingPlans = true
            runCatching { plansApi.list(context) }
                .onSuccess { json -> plans = parsePlans(json) }
                .onFailure { actionMsg = it.message.orEmpty() }
            loadingPlans = false
        }
    }

    fun createOrderForPlan(plan: ShopPlanItem) {
        scope.launch {
            buying = true
            runCatching { paymentApi.create(context, plan.id) }
                .onSuccess { json ->
                    qrInfo = toQrInfo(json, fallbackCountdown = 300)
                    actionMsg = if (qrInfo == null) "下单成功，但支付信息为空" else ""
                }
                .onFailure { actionMsg = "下单失败：${it.message.orEmpty()}" }
            buying = false
            reloadHistory()
        }
    }

    fun createDirectOrder(amountYuan: Double) {
        scope.launch {
            buying = true
            runCatching { paymentApi.direct(context, amountYuan) }
                .onSuccess { json ->
                    qrInfo = toQrInfo(json, fallbackCountdown = 300)
                    actionMsg = if (qrInfo == null) "下单成功，但支付信息为空" else ""
                }
                .onFailure { actionMsg = "下单失败：${it.message.orEmpty()}" }
            buying = false
            reloadHistory()
        }
    }

    fun reopenOrder(order: ShopOrderItem) {
        scope.launch {
            reopeningOrderId = order.id
            runCatching { paymentApi.reopen(context, order.id) }
                .onSuccess { json ->
                    val status = json.stringOrNull("status")
                    if (status == "paid") {
                        val balance = json.intOrNull("balance")
                        if (balance != null) {
                            wallet = wallet.copy(balance = balance)
                            onBalanceUpdate(balance)
                        } else {
                            reloadWallet()
                        }
                    } else {
                        qrInfo = toQrInfo(
                            json = json,
                            fallbackOrderId = order.id,
                            fallbackAmount = order.amount,
                            fallbackPoints = order.points,
                            fallbackCountdown = order.remainingSeconds ?: 300,
                        )
                    }
                    reloadHistory()
                }
                .onFailure {
                    actionMsg = "继续支付失败：${it.message.orEmpty()}"
                    reloadHistory()
                }
            reopeningOrderId = null
        }
    }

    LaunchedEffect(open) {
        reloadWallet()
        reloadHistory()
        if (tab == ShopTab.PLANS) loadPlansIfNeeded(force = true)
    }

    LaunchedEffect(tab) {
        if (tab == ShopTab.PLANS) {
            loadPlansIfNeeded()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brush.linearGradient(listOf(ShopPageStyle.BgStart, ShopPageStyle.BgMid, ShopPageStyle.BgEnd))),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            if (LocalCompactLayout.current) {
                ShopTopBar(balance = wallet.balance, onBack = onBack)
                ShopTabs(tab = tab, onTabChange = { tab = it })
            } else ShopNavTabs(
                tab = tab,
                onTabChange = { tab = it },
                balance = wallet.balance,
                onBack = onBack,
                modifier = Modifier.padding(top = 18.dp),
            )

            if (actionMsg.isNotBlank()) {
                androidx.compose.material3.Text(
                    text = actionMsg,
                    color = ShopPageStyle.Violet,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp),
                )
            }

            CenterBody(modifier = Modifier.weight(1f)) {
                when (tab) {
                    ShopTab.RECHARGE -> {
                        DirectRechargeCard(
                            wallet = wallet,
                            buying = buying,
                            onPay = ::createDirectOrder,
                        )
                    }

                    ShopTab.PLANS -> {
                        when {
                            loadingPlans -> ShopHint("加载中...")
                            plans.isEmpty() -> ShopHint("暂无可用套餐")
                            else -> PlansGrid(
                                plans = plans,
                                buying = buying,
                                onBuy = ::createOrderForPlan,
                            )
                        }
                    }

                    ShopTab.HISTORY -> {
                        when {
                            loadingHistory -> ShopHint("加载中...")
                            orders.isEmpty() -> ShopHint("暂无订单记录")
                            else -> OrderHistoryList(
                                orders = orders,
                                reopeningOrderId = reopeningOrderId,
                                onReopen = ::reopenOrder,
                            )
                        }
                    }
                }
            }
        }

        qrInfo?.let { info ->
            ShopPaymentDialog(
                info = info,
                onClose = {
                    qrInfo = null
                },
                onPaid = { paidBalance ->
                    qrInfo = null
                    if (paidBalance != null) {
                        wallet = wallet.copy(balance = paidBalance)
                        onBalanceUpdate(paidBalance)
                    } else {
                        reloadWallet()
                    }
                    reloadHistory()
                },
                onCancelled = {
                    reloadHistory()
                },
                modifier = Modifier.align(Alignment.Center),
            )
        }

        // 返回按键固定在左下角
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 20.dp, bottom = 28.dp)
                .size(40.dp)
                .clip(CircleShape)
                .background(Color(0x22FFFFFF))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.ArrowBack,
                contentDescription = "返回",
                tint = ShopPageStyle.TextSoft,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

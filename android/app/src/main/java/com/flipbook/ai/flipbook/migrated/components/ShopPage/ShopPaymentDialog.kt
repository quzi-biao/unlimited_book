package com.flipbook.ai.flipbook.migrated.components.shoppage

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.HourglassBottom
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.flipbook.ai.flipbook.migrated.api.paymentApi
import com.flipbook.ai.flipbook.migrated.components.shoppage.intOrNull
import com.flipbook.ai.flipbook.migrated.components.shoppage.stringOrNull
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val PAYMENT_SUCCESS_STAY_MS = 5_000L

data class QrPayInfo(
    val orderId: String,
    val codeUrl: String,
    val amountFen: Int,
    val points: Int,
    val initialCountdown: Int = 300,
)

/** 对应 WebView: components/ShopPage/ShopPage.jsx QRModal */
@Composable
fun ShopPaymentDialog(
    info: QrPayInfo,
    onClose: () -> Unit,
    onPaid: (Int?) -> Unit,
    onCancelled: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()

    var status by remember(info.orderId) { mutableStateOf("pending") } // pending/paid/cancelled/expired/failed
    var countdown by remember(info.orderId) { mutableIntStateOf(info.initialCountdown.coerceAtLeast(0)) }
    var cancelling by remember(info.orderId) { mutableStateOf(false) }
    var paidBalance by remember(info.orderId) { mutableStateOf<Int?>(null) }

    val qrBitmap = remember(info.codeUrl) { buildQrBitmap(info.codeUrl, 220) }

    LaunchedEffect(info.orderId) {
        while (status == "pending") {
            delay(2000)
            runCatching { paymentApi.poll(context, info.orderId) }
                .onSuccess { res ->
                    when (res.stringOrNull("status")) {
                        "paid" -> {
                            paidBalance = res.intOrNull("balance")
                            status = "paid"
                        }

                        "cancelled", "failed" -> {
                            status = res.stringOrNull("status").orEmpty()
                            onCancelled()
                        }
                    }
                }
        }
    }

    LaunchedEffect(info.orderId, status) {
        while (status == "pending" && countdown > 0) {
            delay(1000)
            countdown -= 1
        }
        if (status == "pending" && countdown <= 0) {
            runCatching { paymentApi.cancel(context, info.orderId) }
                .onSuccess { res ->
                    if (res.stringOrNull("status") == "paid") {
                        paidBalance = res.intOrNull("balance")
                        status = "paid"
                    } else {
                        status = "expired"
                        onCancelled()
                    }
                }
                .onFailure {
                    status = "expired"
                    onCancelled()
                }
        }
    }

    LaunchedEffect(info.orderId, status) {
        if (status == "paid") {
            delay(PAYMENT_SUCCESS_STAY_MS)
            onPaid(paidBalance)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xA6000000)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth(0.86f)
                .background(
                    Brush.linearGradient(listOf(Color(0xFF1A1B2E), Color(0xFF252640))),
                    RoundedCornerShape(20.dp),
                )
                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(20.dp)),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "微信扫码支付",
                    color = ShopPageStyle.TextStrong,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(Color.Transparent, CircleShape)
                        .clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = "关闭", tint = ShopPageStyle.TextMuted)
                }
            }

            when (status) {
                "paid" -> {
                    ResultState(
                        icon = Icons.Rounded.CheckCircle,
                        iconColor = ShopPageStyle.Success,
                        title = "支付成功！",
                        subtitle = "已充值 ${info.points} 点",
                        subtitleColor = ShopPageStyle.TextSoft,
                    )
                }

                "cancelled" -> {
                    ResultState(
                        icon = Icons.Rounded.Close,
                        iconColor = ShopPageStyle.TextMuted,
                        title = "订单已取消",
                        subtitle = "",
                        subtitleColor = ShopPageStyle.TextMuted,
                    )
                }

                "failed" -> {
                    ResultState(
                        icon = Icons.Rounded.Close,
                        iconColor = ShopPageStyle.Danger,
                        title = "支付失败",
                        subtitle = "",
                        subtitleColor = ShopPageStyle.TextMuted,
                    )
                }

                "expired" -> {
                    ResultState(
                        icon = Icons.Rounded.HourglassBottom,
                        iconColor = ShopPageStyle.Warning,
                        title = "二维码已过期",
                        subtitle = "请返回重新发起支付",
                        subtitleColor = ShopPageStyle.TextMuted,
                    )
                }

                else -> {
                    PendingState(
                        qrBitmap = qrBitmap,
                        amountFen = info.amountFen,
                        points = info.points,
                        countdown = countdown,
                        cancelling = cancelling,
                        onCancel = {
                            scope.launch {
                                cancelling = true
                                runCatching { paymentApi.cancel(context, info.orderId) }
                                    .onSuccess { res ->
                                        if (res.stringOrNull("status") == "paid") {
                                            paidBalance = res.intOrNull("balance")
                                            status = "paid"
                                        } else {
                                            status = "cancelled"
                                            onCancelled()
                                            delay(800)
                                            onClose()
                                        }
                                    }
                                    .onFailure {
                                        status = "cancelled"
                                        onCancelled()
                                        delay(800)
                                        onClose()
                                    }
                                cancelling = false
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun PendingState(
    qrBitmap: Bitmap?,
    amountFen: Int,
    points: Int,
    countdown: Int,
    cancelling: Boolean,
    onCancel: () -> Unit,
) {
    val mm = (countdown / 60).toString().padStart(2, '0')
    val ss = (countdown % 60).toString().padStart(2, '0')

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 20.dp)
                .background(Color.White, RoundedCornerShape(10.dp))
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (qrBitmap != null) {
                AsyncImage(
                    model = qrBitmap,
                    contentDescription = "微信支付二维码",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(190.dp),
                )
            } else {
                Icon(
                    Icons.Rounded.Refresh,
                    contentDescription = null,
                    tint = ShopPageStyle.TextMuted,
                    modifier = Modifier.size(30.dp),
                )
            }
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            Text(
                text = formatPriceFen(amountFen),
                color = ShopPageStyle.TextStrong,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                text = "+$points 点",
                color = ShopPageStyle.Violet,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }

        Text(
            text = "请用微信扫描二维码完成支付",
            color = ShopPageStyle.TextMuted,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )

        Text(
            text = "有效期 $mm:$ss",
            color = ShopPageStyle.TextMuted,
            fontSize = 11.sp,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 20.dp)
                .height(38.dp)
                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(10.dp))
                .background(Color(0x0AFFFFFF), RoundedCornerShape(10.dp))
                .clickable(enabled = !cancelling, onClick = onCancel),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (cancelling) "取消中..." else "取消订单",
                color = ShopPageStyle.TextSoft,
                fontSize = 13.sp,
            )
        }
    }
}

@Composable
private fun ResultState(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconColor: Color,
    title: String,
    subtitle: String,
    subtitleColor: Color,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 34.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(52.dp))
        Text(title, color = ShopPageStyle.TextStrong, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        if (subtitle.isNotBlank()) {
            Text(subtitle, color = subtitleColor, fontSize = 13.sp)
        }
    }
}

private fun buildQrBitmap(text: String, size: Int): Bitmap? {
    if (text.isBlank() || size <= 0) return null
    return runCatching {
        val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size)
        val pixels = IntArray(size * size)
        for (y in 0 until size) {
            for (x in 0 until size) {
                pixels[y * size + x] = if (matrix[x, y]) 0xFF12131F.toInt() else 0xFFFFFFFF.toInt()
            }
        }
        Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
            setPixels(pixels, 0, size, 0, 0, size, size)
        }
    }.getOrNull()
}

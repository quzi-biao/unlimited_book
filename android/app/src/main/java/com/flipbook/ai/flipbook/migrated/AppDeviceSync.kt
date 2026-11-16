package com.flipbook.ai.flipbook.migrated

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.flipbook.migrated.api.deviceApi
import com.flipbook.ai.flipbook.migrated.api.walletApi
import com.flipbook.ai.flipbook.migrated.hooks.OtaUpdateState
import com.flipbook.ai.flipbook.migrated.utils.getDeviceToken
import com.flipbook.ai.flipbook.migrated.utils.initDevice
import kotlinx.coroutines.delay

/** 设备初始化、心跳和学习点数同步；网络服务暂留 Android 适配层。 */
@Composable
internal fun AppDeviceSync(ota: OtaUpdateState, onBalanceUpdate: (Int) -> Unit) {
    val appContext = LocalContext.current.applicationContext
    val updateBalance by rememberUpdatedState(onBalanceUpdate)
    LaunchedEffect(appContext) {
        runCatching { initDevice(appContext) }
        ota.check()
        // 启动时立刻拉取一次学习点数余额
        runCatching { walletApi.info(appContext) }
            .onSuccess { json ->
                val pts = json.get("balance")?.asInt
                if (pts != null) updateBalance(pts)
            }
        var heartbeatCount = 0
        var lastInitRetryAt = 0L
        suspend fun retryInitIfNeeded() {
            val now = System.currentTimeMillis()
            if (now - lastInitRetryAt < 30_000L) return
            lastInitRetryAt = now
            runCatching { initDevice(appContext) }
        }
        while (true) {
            if (getDeviceToken(appContext).isNullOrBlank()) {
                retryInitIfNeeded()
            }
            val heartbeatOk = runCatching { deviceApi.heartbeat(appContext) }.isSuccess
            if (!heartbeatOk) {
                retryInitIfNeeded()
            }
            // 每 6 次心跳（约 1 分钟）同步更新点数余额
            if (heartbeatCount % 6 == 0) {
                runCatching { walletApi.info(appContext) }
                    .onSuccess { json ->
                        val pts = json.get("balance")?.asInt
                        if (pts != null) updateBalance(pts)
                    }
            }
            heartbeatCount += 1
            if (heartbeatCount % 6 == 0) {
                ota.check()
            }
            delay(10_000)
        }
    }

}

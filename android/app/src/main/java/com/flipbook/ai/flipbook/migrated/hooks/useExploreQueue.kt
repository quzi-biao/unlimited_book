package com.flipbook.ai.flipbook.migrated.hooks

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.UUID

private const val PREF = "explore_queue"
private const val KEY = "explore_queue_v1"
private val gson = Gson()

data class ExploreTask(
    val id: String = "ex-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(6)}",
    val type: String = "expand", // expand | topic
    val status: String = "waiting", // waiting | exploring | done | failed
    val dedupeKey: String? = null,
    val bookTitle: String? = null,
    val sourcePageTitle: String? = null,
    val payload: Map<String, Any?> = emptyMap(),
    val result: Map<String, Any?>? = null,
    val error: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

class ExploreQueueState internal constructor(
    context: Context,
) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    var queue by mutableStateOf(loadQueue())
        private set
    var isProcessing by mutableStateOf(false)
        private set

    private fun loadQueue(): List<ExploreTask> {
        val raw = appContext.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(KEY, null) ?: return emptyList()
        return runCatching {
            val parsed = gson.fromJson<List<ExploreTask>>(raw, object : TypeToken<List<ExploreTask>>() {}.type)
            parsed.map { t ->
                if (t.status == "exploring") t.copy(status = "failed", error = "App 重启，请重试") else t
            }
        }.getOrDefault(emptyList())
    }

    private fun persist() {
        appContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY, gson.toJson(queue))
            .apply()
    }

    private fun commit(newQueue: List<ExploreTask>) {
        queue = newQueue
        persist()
    }

    fun addTask(config: ExploreTask): String? {
        if (queue.size >= 5) return "queue_full"
        if (!config.dedupeKey.isNullOrBlank() && queue.any { it.dedupeKey == config.dedupeKey }) return null
        val task = config.copy(
            id = "ex-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(6)}",
            status = "waiting",
            createdAt = System.currentTimeMillis(),
        )
        commit(queue + task)
        return task.id
    }

    fun cancelTask(taskId: String) {
        val t = queue.firstOrNull { it.id == taskId } ?: return
        if (t.status == "exploring") return
        commit(queue.filterNot { it.id == taskId })
    }

    fun retryTask(taskId: String) {
        val t = queue.firstOrNull { it.id == taskId } ?: return
        val tail = t.copy(status = "waiting", error = null, result = null)
        commit(queue.filterNot { it.id == taskId } + tail)
    }

    fun dismissTask(taskId: String) {
        commit(queue.filterNot { it.id == taskId })
    }

    fun process(processor: suspend (ExploreTask) -> Map<String, Any?>) {
        if (isProcessing) return
        val next = queue.firstOrNull { it.status == "waiting" } ?: return
        isProcessing = true
        commit(queue.map { if (it.id == next.id) it.copy(status = "exploring") else it })
        scope.launch {
            runCatching { processor(next) }
                .onSuccess { result ->
                    commit(queue.map { if (it.id == next.id) it.copy(status = "done", result = result, error = null) else it })
                }
                .onFailure { err ->
                    commit(queue.map { if (it.id == next.id) it.copy(status = "failed", error = err.message ?: "执行失败") else it })
                }
            isProcessing = false
            process(processor)
        }
    }
}

/** 对应 WebView: hooks/useExploreQueue.js */
@Composable
fun rememberExploreQueueState(
    processor: (suspend (ExploreTask) -> Map<String, Any?>)? = null,
): ExploreQueueState {
    val context = LocalContext.current.applicationContext
    val state = remember(context) { ExploreQueueState(context) }
    if (processor != null) {
        LaunchedEffect(state.queue) {
            state.process(processor)
        }
    }
    return state
}

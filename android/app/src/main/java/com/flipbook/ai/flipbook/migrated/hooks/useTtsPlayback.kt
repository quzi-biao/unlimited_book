package com.flipbook.ai.flipbook.migrated.hooks

import android.media.MediaPlayer
import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.flipbook.ai.flipbook.migrated.api.pagesApi
import com.flipbook.ai.flipbook.migrated.api.ttsApi
import com.flipbook.ai.flipbook.migrated.components.ttsplayer.TtsPlayerUiState
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume

private enum class TtsChannel { PAGE, ANNOTATION }
private data class TtsChannelMeta(val pageId: String? = null, val bookTitle: String = "", val pageTitle: String = "")

/** 对应 WebView: contexts/TtsContext.jsx（页播报 + 标注播报，双通道互斥） */
class TtsPlaybackState internal constructor(
    private val scope: CoroutineScope,
    private val appContext: android.content.Context,
) {
    private val speedList = listOf(1f, 1.25f, 1.5f, 1.75f, 2f, 2.25f)

    private var mediaPlayer: MediaPlayer? = null
    private var playJob: Job? = null
    private var tickerJob: Job? = null

    private var channel: TtsChannel = TtsChannel.PAGE
    private var activePageId: String? = null
    private var activeAnnotationId: String? = null
    private var activeAnnotationText: String? = null

    var pageState by mutableStateOf("idle")
        private set
    var annState by mutableStateOf("idle")
        private set
    var annSourceId by mutableStateOf<String?>(null)
        private set

    private var pageMeta by mutableStateOf<TtsChannelMeta?>(null)
    private var annMeta by mutableStateOf<TtsChannelMeta?>(null)

    var rate by mutableFloatStateOf(1f)
        private set
    var currentTimeSec by mutableFloatStateOf(0f)
        private set
    var durationSec by mutableFloatStateOf(0f)
        private set

    val uiState: TtsPlayerUiState
        get() {
            val annActive = isActiveState(annState)
            val pageActive = isActiveState(pageState)
            val activeMeta = if (annActive) annMeta else pageMeta
            return TtsPlayerUiState(
                playbackState = when {
                    annActive -> annState
                    pageActive -> pageState
                    else -> "idle"
                },
                rate = rate,
                currentTimeSec = currentTimeSec,
                durationSec = durationSec,
                bookTitle = activeMeta?.bookTitle.orEmpty(),
                pageTitle = activeMeta?.pageTitle.orEmpty(),
                annotationMode = annActive,
                sourcePageId = activeMeta?.pageId ?: activePageId,
            )
        }

    fun toggleRound(pageId: String?, bookTitle: String, pageTitle: String) {
        if (pageId.isNullOrBlank()) return
        when {
            annState == "paused" && !activeAnnotationId.isNullOrBlank() -> resumeCurrent(TtsChannel.ANNOTATION)
            annState == "playing" && !activeAnnotationId.isNullOrBlank() -> pauseCurrent(TtsChannel.ANNOTATION)
            annState == "loading" && !activeAnnotationId.isNullOrBlank() -> Unit
            pageState == "paused" && activePageId == pageId -> resumeCurrent(TtsChannel.PAGE)
            pageState == "playing" && activePageId == pageId -> pauseCurrent(TtsChannel.PAGE)
            pageState == "loading" && activePageId == pageId -> Unit
            else -> startPagePlayback(pageId, bookTitle, pageTitle)
        }
    }

    fun togglePlayPause(pageId: String?, bookTitle: String, pageTitle: String) {
        if (pageId.isNullOrBlank()) return
        val annotationActive = isActiveState(annState) && !activeAnnotationId.isNullOrBlank()
        if (annotationActive) {
            when (annState) {
                "playing" -> pauseCurrent(TtsChannel.ANNOTATION)
                "paused" -> resumeCurrent(TtsChannel.ANNOTATION)
                "loading" -> Unit
            }
            return
        }

        if (activePageId != pageId || pageState == "idle" || pageState == "error") {
            startPagePlayback(pageId, bookTitle, pageTitle)
            return
        }
        if (pageState == "playing") {
            pauseCurrent(TtsChannel.PAGE)
        } else if (pageState == "paused") {
            resumeCurrent(TtsChannel.PAGE)
        }
    }

    fun playAnnotation(
        annotationId: String?,
        annotationText: String?,
        bookTitle: String,
        pageTitle: String,
        pageId: String? = null,
    ) {
        val safeTitle = if (pageTitle.isBlank()) "区域解读" else pageTitle
        when {
            annState == "paused" && activeAnnotationId == annotationId -> resumeCurrent(TtsChannel.ANNOTATION)
            annState == "playing" && activeAnnotationId == annotationId -> pauseCurrent(TtsChannel.ANNOTATION)
            annState == "loading" && activeAnnotationId == annotationId -> Unit
            else -> startAnnotationPlayback(annotationId, annotationText, bookTitle, safeTitle, pageId)
        }
    }

    fun seekTo(targetSec: Float) {
        val mp = mediaPlayer ?: return
        val duration = (mp.duration / 1000f).coerceAtLeast(0f)
        if (duration <= 0f) return
        val sec = targetSec.coerceIn(0f, duration)
        mp.seekTo((sec * 1000f).toInt())
        currentTimeSec = sec
    }

    fun toggleRate() {
        val idx = speedList.indexOf(rate).let { if (it < 0) 0 else it }
        rate = speedList[(idx + 1) % speedList.size]
        applyRate()
    }

    fun stopAll() {
        stopEngine()
        pageState = "idle"
        annState = "idle"
        annSourceId = null
        pageMeta = null
        annMeta = null
        activePageId = null
        activeAnnotationId = null
        activeAnnotationText = null
        channel = TtsChannel.PAGE
    }

    private fun isActiveState(state: String): Boolean {
        return state == "loading" || state == "playing" || state == "paused"
    }

    private fun channelState(target: TtsChannel): String {
        return if (target == TtsChannel.PAGE) pageState else annState
    }

    private fun setChannelState(target: TtsChannel, state: String) {
        if (target == TtsChannel.PAGE) {
            pageState = state
        } else {
            annState = state
            annSourceId = if (state == "idle") null else activeAnnotationId
        }
    }

    private fun stopEngine() {
        playJob?.cancel()
        playJob = null
        stopTicker()
        releasePlayer()
        currentTimeSec = 0f
        durationSec = 0f
    }

    private fun startPagePlayback(pageId: String, bookTitle: String, pageTitle: String) {
        stopEngine()
        channel = TtsChannel.PAGE
        pageMeta = TtsChannelMeta(pageId = pageId, bookTitle = bookTitle, pageTitle = pageTitle)
        activePageId = pageId
        setChannelState(TtsChannel.PAGE, "loading")

        annState = "idle"
        annSourceId = null
        annMeta = null
        activeAnnotationId = null
        activeAnnotationText = null

        playJob = scope.launch {
            runCatching {
                runSegmentLoop(
                    target = TtsChannel.PAGE,
                    trigger = {
                        runCatching {
                            ttsApi.fetchPageAudio(
                                context = appContext,
                                pageId = pageId,
                                lang = "zh",
                                triggerOnly = true,
                            ).close()
                        }
                    },
                    check = {
                        ttsApi.checkPageCache(appContext, pageId, lang = "zh")
                    },
                )
            }.recoverCatching {
                val explanation = pagesApi.explanation(appContext, pageId, "zh").get("explanation")?.asString.orEmpty()
                runDirectTextLoop(TtsChannel.PAGE, explanation)
            }
                .onFailure { err ->
                    if (err !is CancellationException) onPlaybackFailure(TtsChannel.PAGE)
                }
                .onSuccess { onPlaybackSuccess(TtsChannel.PAGE) }
        }
    }

    private fun startAnnotationPlayback(
        annotationId: String?,
        annotationText: String?,
        bookTitle: String,
        pageTitle: String,
        pageId: String?,
    ) {
        stopEngine()
        channel = TtsChannel.ANNOTATION
        activeAnnotationId = annotationId
        activeAnnotationText = annotationText
        annSourceId = annotationId
        annMeta = TtsChannelMeta(pageId = pageId, bookTitle = bookTitle, pageTitle = pageTitle)
        setChannelState(TtsChannel.ANNOTATION, "loading")

        pageState = "idle"
        pageMeta = null
        activePageId = null

        playJob = scope.launch {
            runCatching {
                val serverAnnotationId = annotationId
                    ?.takeIf { it.isNotBlank() && !it.startsWith("local-") }
                    ?: error("区域解读缺少服务端标注 ID")
                runSegmentLoop(
                    target = TtsChannel.ANNOTATION,
                    trigger = {
                        ttsApi.fetchAnnotationAudio(
                            context = appContext,
                            annotationId = serverAnnotationId,
                            triggerOnly = true,
                        ).close()
                    },
                    check = {
                        ttsApi.checkAnnotationCache(appContext, serverAnnotationId)
                    },
                )
            }
                .onFailure { err ->
                    if (err !is CancellationException) onPlaybackFailure(TtsChannel.ANNOTATION)
                }
                .onSuccess { onPlaybackSuccess(TtsChannel.ANNOTATION) }
        }
    }

    private fun onPlaybackFailure(target: TtsChannel) {
        if (channel != target || channelState(target) == "paused") return
        setChannelState(target, "error")
        scope.launch {
            delay(1800)
            if (channel == target && channelState(target) == "error") {
                setChannelState(target, "idle")
            }
        }
    }

    private fun onPlaybackSuccess(target: TtsChannel) {
        if (channel != target || channelState(target) == "paused") return
        setChannelState(target, "idle")
        currentTimeSec = 0f
        durationSec = 0f
    }

    private suspend fun runSegmentLoop(
        target: TtsChannel,
        trigger: suspend () -> Unit,
        check: suspend () -> JsonObject,
    ) {
        var played = 0
        var complete = false
        var triggered = false
        while (!complete && channel == target) {
            val cache = check()
            if (channel != target) return

            val segments = parseSegments(cache.get("segments"))
            val cached = cache.get("cached")?.asBoolean ?: false
            val isComplete = cache.get("complete")?.asBoolean ?: false

            if (cached && segments.size > played) {
                val newSegs = segments.subList(played, segments.size)
                for (url in newSegs) {
                    if (channel != target) return
                    playSingleSegment(target, url)
                    played += 1
                }
            }

            if (cached && isComplete && played >= segments.size) {
                complete = true
            } else {
                if ((!cached || played >= segments.size) && !triggered) {
                    runCatching { trigger() }
                    triggered = true
                }
                if (channelState(target) != "paused") {
                    setChannelState(target, "loading")
                }
                delay(1000)
            }
        }
    }

    private suspend fun runDirectTextLoop(target: TtsChannel, text: String?) {
        val content = text?.trim().orEmpty()
        if (content.isBlank()) error("标注内容为空")

        val res = ttsApi.fetchTextAudio(appContext, content)
        val bytes = res.use {
            if (!it.isSuccessful) {
                error("文本音频生成失败")
            }
            it.body?.bytes() ?: error("文本音频为空")
        }
        val tmp = File(appContext.cacheDir, "tts_text_${System.currentTimeMillis()}.mp3")
        runCatching {
            tmp.writeBytes(bytes)
            playSingleSegment(target, tmp.absolutePath)
        }
        runCatching { tmp.delete() }
    }

    private suspend fun playSingleSegment(target: TtsChannel, source: String) {
        if (source.isBlank()) return
        suspendCancellableCoroutine { cont ->
            val mp = MediaPlayer()
            mediaPlayer = mp

            mp.setOnPreparedListener { prepared ->
                durationSec = (prepared.duration / 1000f).coerceAtLeast(0f)
                currentTimeSec = 0f
                applyRate()
                if (channel == target && channelState(target) != "paused") {
                    setChannelState(target, "playing")
                    prepared.start()
                }
                startTicker(prepared)
            }

            mp.setOnCompletionListener {
                stopTicker()
                releasePlayer()
                if (cont.isActive) cont.resume(Unit)
            }

            mp.setOnErrorListener { _, _, _ ->
                stopTicker()
                releasePlayer()
                if (cont.isActive) cont.resume(Unit)
                true
            }

            cont.invokeOnCancellation {
                stopTicker()
                releasePlayer()
            }

            runCatching {
                mp.setDataSource(source)
                mp.prepareAsync()
            }.onFailure {
                stopTicker()
                releasePlayer()
                if (cont.isActive) cont.resume(Unit)
            }
        }
    }

    private fun pauseCurrent(target: TtsChannel) {
        if (channel != target) return
        val mp = mediaPlayer ?: return
        runCatching {
            if (mp.isPlaying) mp.pause()
            setChannelState(target, "paused")
        }
    }

    private fun resumeCurrent(target: TtsChannel) {
        if (channel == target) {
            val mp = mediaPlayer
            if (mp != null) {
                runCatching {
                    mp.start()
                    setChannelState(target, "playing")
                }
                return
            }
        }

        when (target) {
            TtsChannel.PAGE -> {
                val pageId = activePageId ?: return
                val meta = pageMeta
                startPagePlayback(
                    pageId = pageId,
                    bookTitle = meta?.bookTitle.orEmpty(),
                    pageTitle = meta?.pageTitle.orEmpty(),
                )
            }

            TtsChannel.ANNOTATION -> {
                val meta = annMeta
                startAnnotationPlayback(
                    annotationId = activeAnnotationId,
                    annotationText = activeAnnotationText,
                    bookTitle = meta?.bookTitle.orEmpty(),
                    pageTitle = meta?.pageTitle.orEmpty(),
                    pageId = meta?.pageId,
                )
            }
        }
    }

    private fun startTicker(mp: MediaPlayer) {
        stopTicker()
        tickerJob = scope.launch {
            while (true) {
                val pos = runCatching { mp.currentPosition / 1000f }.getOrDefault(0f)
                currentTimeSec = pos
                delay(200)
            }
        }
    }

    private fun stopTicker() {
        tickerJob?.cancel()
        tickerJob = null
    }

    private fun releasePlayer() {
        val old = mediaPlayer
        mediaPlayer = null
        runCatching {
            old?.stop()
        }
        runCatching {
            old?.reset()
            old?.release()
        }
    }

    private fun applyRate() {
        val mp = mediaPlayer ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            runCatching {
                val params = mp.playbackParams ?: return@runCatching
                mp.playbackParams = params.setSpeed(rate)
            }
        }
    }

    private fun parseSegments(element: JsonElement?): List<String> {
        val arr = element?.takeIf { it.isJsonArray }?.asJsonArray ?: return emptyList()
        return arr.mapNotNull { node ->
            when {
                node.isJsonObject -> node.asJsonObject.get("url")?.asString
                node.isJsonPrimitive -> node.asString
                else -> null
            }
        }.filter { it.isNotBlank() }
    }
}

@Composable
fun rememberTtsPlaybackState(): TtsPlaybackState {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    val state = remember(context, scope) { TtsPlaybackState(scope = scope, appContext = context) }
    DisposableEffect(state) { onDispose { state.stopAll() } }
    return state
}

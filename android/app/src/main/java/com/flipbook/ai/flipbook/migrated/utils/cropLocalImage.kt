package com.flipbook.ai.flipbook.migrated.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.util.Base64
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** 对应 WebView: utils/cropLocalImage.js */
object cropLocalImageUtils {
    suspend fun crop(context: Context, imageUrl: String, box: NormalizedBox): String? = withContext(Dispatchers.IO) {
        try {
            val loader = context.imageLoader
            val request = ImageRequest.Builder(context)
                .data(imageUrl)
                .allowHardware(false)
                .build()

            val result = loader.execute(request)
            if (result !is SuccessResult) return@withContext null

            val drawable = result.drawable
            val bitmap = (drawable as? BitmapDrawable)?.bitmap ?: return@withContext null

            val natW = bitmap.width
            val natH = bitmap.height

            val left = (box.x * natW).toInt().coerceIn(0, natW)
            val top = (box.y * natH).toInt().coerceIn(0, natH)
            val width = (box.w * natW).toInt().coerceIn(1, natW - left)
            val height = (box.h * natH).toInt().coerceIn(1, natH - top)

            val cropped = Bitmap.createBitmap(bitmap, left, top, width, height)

            val maxDim = 1024
            val scaled = if (cropped.width > maxDim || cropped.height > maxDim) {
                val ratio = maxDim.toFloat() / maxOf(cropped.width, cropped.height)
                Bitmap.createScaledBitmap(cropped, (cropped.width * ratio).toInt(), (cropped.height * ratio).toInt(), true)
            } else {
                cropped
            }

            val out = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, 80, out)
            val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            
            "data:image/jpeg;base64,$b64"
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}

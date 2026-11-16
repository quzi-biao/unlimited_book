package com.flipbook.ai.flipbook.migrated

import com.flipbook.ai.flipbook.migrated.components.common.GuideController
import com.flipbook.ai.flipbook.migrated.components.common.GuideStepDef
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** 共享引导逻辑不依赖 Android 存储，持久化由平台提供。 */
class GuideControllerTest {
    @Test
    fun dismissAndResumeDoesNotPersistCompletion() {
        val saved = mutableListOf<Boolean>()
        val controller = GuideController(false, saved::add)
        controller.setSteps(listOf(GuideStepDef("topic", "topic", "选话题"), GuideStepDef("read", "read", "开始阅读")))
        controller.startGuide()
        controller.next()
        controller.dismiss()
        assertNull(controller.activeStep)
        assertFalse(controller.isOnboardingComplete)
        assertTrue(saved.isEmpty())
        controller.startGuide(controller.currentIndex)
        assertEquals("read", controller.activeStep?.def?.id)
        controller.next()
        assertEquals(listOf(true), saved)
        assertTrue(controller.isOnboardingComplete)
        assertFalse(controller.isVisible)
    }

    @Test
    fun lateEventsDoNotMoveGuideBackwards() {
        val controller = GuideController(false) {}
        controller.setSteps(listOf(GuideStepDef("topic", "topic", "选话题"), GuideStepDef("read", "read", "开始阅读")))
        controller.startGuide()
        controller.advanceTo("read")
        controller.advanceTo("topic")
        controller.advanceTo("unknown")
        assertEquals("read", controller.activeStep?.def?.id)
    }

    @Test
    fun completionIsRestoredFromPlatformStorage() {
        val controller = GuideController(true) { error("读取状态时不应重新写入") }
        assertTrue(controller.isOnboardingComplete)
        assertFalse(controller.isVisible)
    }
}

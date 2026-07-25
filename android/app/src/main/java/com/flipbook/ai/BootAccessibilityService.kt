package com.flipbook.ai

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class BootAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit
}

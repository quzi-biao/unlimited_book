# WebView -> Android 原生迁移清单

- 规则：按 `legacy-webview-src` 的文件逐个迁移。
- 流程：每次只迁移 1 个 WebView 文件并完成编译验证。
- 状态：`Pending` / `In Progress` / `Done`

| WebView 文件 | Android 原生目标 | 状态 |
|---|---|---|
| `App.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/AppScreen.kt` | In Progress |
| `api/client.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/api/client.kt` | In Progress |
| `api/flipbook.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/api/flipbook.kt` | Done |
| `api/utils.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/api/utils.kt` | Done |
| `components/Annotations/AnnotationCallout.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Annotations/AnnotationCallout.kt` | Pending |
| `components/Annotations/AnnotationCallout.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Annotations/AnnotationCallout.module.kt` | Pending |
| `components/Annotations/AnnotationLayer.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Annotations/AnnotationLayer.kt` | Pending |
| `components/Annotations/AnnotationLayer.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Annotations/AnnotationLayer.module.kt` | Pending |
| `components/Auth/AuthModal.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Auth/AuthModal.kt` | Pending |
| `components/Auth/AuthModal.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Auth/AuthModal.module.kt` | Pending |
| `components/BookShelf/BookShelf.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/BookShelf/BookShelf.kt` | Pending |
| `components/BookShelf/BookShelf.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/BookShelf/BookShelf.module.kt` | Pending |
| `components/BookShelf/PageTree.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/BookShelf/PageTree.kt` | Pending |
| `components/BookShelf/PageTree.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/BookShelf/PageTree.module.kt` | Pending |
| `components/CachedImg/CachedImg.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/CachedImg/CachedImg.kt` | Done |
| `components/ExplanationPanel/ExplanationPanel.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ExplanationPanel/ExplanationPanel.kt` | Pending |
| `components/ExplanationPanel/ExplanationPanel.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ExplanationPanel/ExplanationPanel.module.kt` | Pending |
| `components/ExploreQueue/ExploreQueueBtn.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ExploreQueue/ExploreQueueBtn.kt` | Pending |
| `components/ExploreQueue/ExploreQueueBtn.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ExploreQueue/ExploreQueueBtn.module.kt` | Pending |
| `components/ExploreQueue/ExploreQueueDoneCards.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ExploreQueue/ExploreQueueDoneCards.kt` | Pending |
| `components/ExploreQueue/ExploreQueueDoneCards.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ExploreQueue/ExploreQueueDoneCards.module.kt` | Pending |
| `components/ExploreQueue/ExploreQueuePanel.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ExploreQueue/ExploreQueuePanel.kt` | Pending |
| `components/ExploreQueue/ExploreQueuePanel.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ExploreQueue/ExploreQueuePanel.module.kt` | Pending |
| `components/Landing/Landing.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Landing/Landing.kt` | In Progress |
| `components/Landing/Landing.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Landing/Landing.module.kt` | In Progress |
| `components/OtaUpdate/OtaUpdate.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/OtaUpdate/OtaUpdate.kt` | Done |
| `components/OtaUpdate/OtaUpdate.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/OtaUpdate/OtaUpdate.module.kt` | Done |
| `components/PageTreePanel/PageTreePanel.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/PageTreePanel/PageTreePanel.kt` | Pending |
| `components/PageTreePanel/PageTreePanel.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/PageTreePanel/PageTreePanel.module.kt` | Pending |
| `components/SettingsPage/BrightnessTab.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/SettingsPage/BrightnessTab.kt` | Pending |
| `components/SettingsPage/PromptStyleTab.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/SettingsPage/PromptStyleTab.kt` | Pending |
| `components/SettingsPage/SettingsPage.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/SettingsPage/SettingsPage.kt` | Pending |
| `components/SettingsPage/SettingsPage.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/SettingsPage/SettingsPage.module.kt` | Pending |
| `components/SettingsPage/WifiTab.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/SettingsPage/WifiTab.kt` | Pending |
| `components/ShelfPanel/BookGraph.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ShelfPanel/BookGraph.kt` | Pending |
| `components/ShelfPanel/BookGraph.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ShelfPanel/BookGraph.module.kt` | Pending |
| `components/ShelfPanel/ShelfPanel.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ShelfPanel/ShelfPanel.kt` | Pending |
| `components/ShelfPanel/ShelfPanel.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ShelfPanel/ShelfPanel.module.kt` | Pending |
| `components/ShopPage/ShopPage.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ShopPage/ShopPage.kt` | Pending |
| `components/ShopPage/ShopPage.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ShopPage/ShopPage.module.kt` | Pending |
| `components/SpeakButton/SpeakButton.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/SpeakButton/SpeakButton.kt` | Pending |
| `components/SpeakButton/SpeakButton.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/SpeakButton/SpeakButton.module.kt` | Pending |
| `components/ToolBar/ToolBar.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ToolBar/ToolBar.kt` | Done |
| `components/ToolBar/ToolBar.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/ToolBar/ToolBar.module.kt` | Done |
| `components/TtsPlayer/TtsPlayer.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/TtsPlayer/TtsPlayer.kt` | In Progress |
| `components/TtsPlayer/TtsPlayer.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/TtsPlayer/TtsPlayer.module.kt` | In Progress |
| `components/Viewport/AnnotationDots.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Viewport/AnnotationDots.kt` | Done |
| `components/Viewport/LassoOverlay.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Viewport/LassoOverlay.kt` | Done |
| `components/Viewport/RegionHighlight.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Viewport/RegionHighlight.kt` | Done |
| `components/Viewport/SelectionBox.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Viewport/SelectionBox.kt` | Done |
| `components/Viewport/Viewport.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Viewport/Viewport.kt` | In Progress |
| `components/Viewport/Viewport.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/Viewport/Viewport.module.kt` | In Progress |
| `components/VoiceSettings/VoiceSettings.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/VoiceSettings/VoiceSettings.kt` | Pending |
| `components/VoiceSettings/VoiceSettings.module.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/components/VoiceSettings/VoiceSettings.module.kt` | Pending |
| `contexts/TtsContext.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/contexts/TtsContext.kt` | Pending |
| `db/localDB.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/db/localDB.kt` | In Progress |
| `db/nativeStore.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/db/nativeStore.kt` | In Progress |
| `hooks/useAnnotations.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useAnnotations.kt` | Pending |
| `hooks/useBookPages.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useBookPages.kt` | Pending |
| `hooks/useBooks.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useBooks.kt` | In Progress |
| `hooks/useExploreQueue.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useExploreQueue.kt` | Pending |
| `hooks/useFlipbook.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useFlipbook.kt` | Pending |
| `hooks/useFlipbookHistory.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useFlipbookHistory.kt` | Pending |
| `hooks/useImageSrc.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useImageSrc.kt` | In Progress |
| `hooks/useLassoSelection.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useLassoSelection.kt` | Pending |
| `hooks/useMouseSelection.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useMouseSelection.kt` | Pending |
| `hooks/useOtaUpdate.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useOtaUpdate.kt` | Pending |
| `hooks/useTouchSelection.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/hooks/useTouchSelection.kt` | Pending |
| `index.css` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/index.kt` | Pending |
| `main.jsx` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/MainEntry.kt` | Done |
| `polyfill.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/polyfill.kt` | Pending |
| `utils/annotationGroup.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/annotationGroup.kt` | Done |
| `utils/audioCache.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/audioCache.kt` | Pending |
| `utils/calloutUtils.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/calloutUtils.kt` | Pending |
| `utils/cropLocalImage.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/cropLocalImage.kt` | Pending |
| `utils/deviceAuth.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/deviceAuth.kt` | Pending |
| `utils/fingerprint.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/fingerprint.kt` | Pending |
| `utils/galleryWatcher.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/galleryWatcher.kt` | Pending |
| `utils/imageCache.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/imageCache.kt` | In Progress |
| `utils/nativeTools.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/nativeTools.kt` | Pending |
| `utils/ossUrl.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/ossUrl.kt` | Done |
| `utils/saveToGallery.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/saveToGallery.kt` | Pending |
| `utils/treeNav.js` | `android/app/src/main/java/com/flipbook/ai/flipbook/migrated/utils/treeNav.kt` | Done |

import { createHash } from 'node:crypto';
import { imageStyleSignature } from '../ai/deviceConfig.js';

/** 评测与实际模型配置绑定，换模型后旧报告不能启用新版本。 */
export function evaluationSignature(release, aiConfig) {
  return createHash('sha256').update(JSON.stringify({engine:'knowledge-original-images-1',base:release.base,safety:release.safety,
    defaultImageStyle:imageStyleSignature(aiConfig?.defaultStyle, aiConfig?.configMap),
    imageModels:['gpt-image-2','gemini-3-pro-image-preview'],
    endpoints:[process.env.GPTIMAGE_BASE_URL || 'https://api.openlux.ai',process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta'],
    models:[process.env.KNOWLEDGE_REGION_MODEL || 'gpt-4.1-mini',process.env.IMAGE_PROVIDER || 'gptimage',process.env.GPTIMAGE_TEXT_MODEL || 'gpt-4.1-mini',process.env.KNOWLEDGE_ROOT_MODEL || '',process.env.KNOWLEDGE_EXTENSION_MODEL || '',process.env.KNOWLEDGE_REVIEW_MODEL || '']})).digest('hex');
}


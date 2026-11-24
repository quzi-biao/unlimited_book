import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** 本机知识树预览沿用项目的模型配置；数据库、文件存储和认证配置独立。 */
const database = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/knowledge') {
  throw new Error('本地知识树预览需要指定本机 knowledge 数据库');
}
process.env.LISTEN_HOST = '127.0.0.1';
process.env.DISABLE_BACKGROUND_JOBS = 'true';
process.env.PORT ??= '8898';
process.env.LOCAL_UPLOAD_DIR ??= fileURLToPath(new URL('../../.local-data/knowledge-uploads/', import.meta.url));
const modelConfig = dotenv.parse(readFileSync(new URL('../../.env', import.meta.url)));
for (const key of [
  'IMAGE_PROVIDER', 'GPTIMAGE_API_KEY', 'GPTIMAGE_BASE_URL', 'GPTIMAGE_TEXT_MODEL',
  'GEMINI_API_KEY', 'GEMINI_BASE', 'KNOWLEDGE_ROOT_MODEL', 'KNOWLEDGE_REGION_MODEL',
  'KNOWLEDGE_EXTENSION_MODEL', 'KNOWLEDGE_REVIEW_MODEL',
]) {
  if (modelConfig[key]) process.env[key] ??= modelConfig[key];
}

import { createHash } from 'node:crypto';
import prisma from '../../config/db.js';
import { originalPromptStyle } from './originalPromptStyle.js';

/** 原书架与知识树共用设备的选择；新数据库未初始化时也有完整原版提示词。 */
export async function getDeviceAiConfig(deviceId, db = prisma) {
  const device = deviceId && await db.device.findUnique({ where: { id: deviceId }, select: { promptStyle: true } });
  const defaultStyle = await db.promptStyle.findUnique({ where: { name: originalPromptStyle.name } }) || originalPromptStyle;
  const configs = await db.globalConfig.findMany({ where: { key: { in: ['model_image_gen', 'model_page_desc', 'model_region_expl'] } } });
  return { promptStyle: device?.promptStyle || defaultStyle, defaultStyle, configMap: Object.fromEntries(configs.map(c => [c.key, c.value])) };
}

/** 绑定实际送入原生图流程的模板内容与模型，不使用可改名的风格标签作为缓存键。 */
export function imageStyleSignature(style = originalPromptStyle, configMap = {}) {
  return createHash('sha256').update(JSON.stringify([
    (style.imageModel || configMap.model_image_gen || process.env.IMAGE_PROVIDER || 'gptimage').toLowerCase(),
    style.topicExploration, style.regionExploration, style.deepExploration, style.unifiedStyle,
  ])).digest('hex');
}

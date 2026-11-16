/**
 * 控制首次打开话题时是否复用公共图片；用户自己的已有书始终可以直接阅读。
 * 默认保留线上行为，本地通过 Compose 显式关闭，不删除任何缓存或图片。
 * @param {object} env 服务端环境配置
 * @returns {boolean} 是否读取、写入共享话题图片缓存
 */
export function sharedTopicImagesEnabled(env = process.env) {
  return env.SHARED_TOPIC_IMAGES_ENABLED !== 'false';
}

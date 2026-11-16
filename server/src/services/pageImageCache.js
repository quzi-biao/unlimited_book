/**
 * 保存页面及首次生成的画幅缓存，竞争同一缓存键时仍保留当前页面层级。
 * @param {object} prisma 数据库客户端
 * @param {object} data 页面数据
 * @returns {Promise<object>} 新建页面
 */
export async function createPageWithImageCache(prisma, data) {
  try {
    return await prisma.page.create({ data });
  } catch (error) {
    if (!data.promptHash || error.code !== 'P2002'
      || !error.meta?.target?.includes('promptHash')) throw error;
    // 并发任务已写入相同图片缓存；不再调用 AI，也不覆盖另一页面。
    return prisma.page.create({ data: { ...data, promptHash: null } });
  }
}

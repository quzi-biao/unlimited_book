const pendingTopics = new Map();

/** 归一化书名用于匹配；保留中文标点差异。@param {string} title @returns {string} */
export function topicBookKey(title) {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** 获取带身份类型的去重键，避免用户和设备 ID 混用。@returns {string} */
export function ownerTopicKey(owner, title, mode = 'book') {
  return JSON.stringify([owner.deviceId ? 'device' : 'user', owner.deviceId || owner.userId, mode, topicBookKey(title)]);
}

/**
 * 同一设备/用户的同名请求排队，首次完成后复用结果，失败后允许重试。
 * @param {object} owner 身份过滤条件
 * @param {string} title 话题
 * @param {string} [mode] 书籍模式
 * @returns {Promise<Function>} 释放当前请求的函数，必须在 finally 中调用
 */
export async function acquireTopicBookLock(owner, title, mode = 'book') {
  const key = ownerTopicKey(owner, title, mode);
  const previous = pendingTopics.get(key);
  let release;
  const current = new Promise(resolve => { release = resolve; });
  pendingTopics.set(key, current);
  if (previous) await previous;
  return () => {
    if (pendingTopics.get(key) === current) pendingTopics.delete(key);
    release();
  };
}

/**
 * 查找本书架的同名书。历史有多本时优先页数最多的一本，不删除任何记录。
 * @param {object} db Prisma 客户端或事务
 * @param {object} owner 已认证的归属条件
 * @param {string} title 话题
 * @param {string} [mode] 书籍模式
 * @returns {Promise<object|null>} 同名书及可打开的首页
 */
export async function findTopicBook(db, owner, title, mode = 'book') {
  const key = topicBookKey(title);
  const books = await db.book.findMany({
    where: { ...owner, mode },
    select: { id: true, title: true, coverUrl: true, createdAt: true, _count: { select: { pages: true } } },
    orderBy: [{ pages: { _count: 'desc' } }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  const book = books.find(item => topicBookKey(item.title) === key);
  if (!book) return null;
  const page = await db.page.findFirst({
    where: { bookId: book.id },
    orderBy: [{ parentPageId: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  return { book, page };
}

/** 将已有书转换为原生成接口兼容的响应。@param {object} existing @returns {object} */
export function existingTopicResponse({ book, page }) {
  return {
    bookId: book.id, bookTitle: book.title, pageId: page.id, imageUrl: page.imageUrl,
    pageTitle: page.title || page.prompt || book.title, reusedBook: true,
  };
}

/**
 * 在短事务内锁定同一书名，跨后端进程也不会创建两本同名书。
 * @param {object} db 数据库
 * @param {object} owner 归属
 * @param {string} title 书名
 * @param {string} mode 模式
 * @param {Function} action 锁内数据库操作；不得在其中调用 AI
 * @returns {Promise<object>} 操作结果
 */
export function withTopicBookTransaction(db, owner, title, mode, action) {
  const key = ownerTopicKey(owner, title, mode);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS locked`;
    return action(tx);
  });
}

/**
 * 原子保存新书首页；已存在时复用，空书补首页，已有内容不覆盖。
 * @param {object} db 数据库
 * @param {object} owner 归属
 * @param {string} title 书名
 * @param {object} pageData 首页数据
 * @returns {Promise<object>} 书籍、页面及复用标记
 */
export async function saveTopicRoot(db, owner, title, pageData) {
  const result = await withTopicBookTransaction(db, owner, title, 'book', async tx => {
    const existing = await findTopicBook(tx, owner, title);
    if (existing?.page) return { ...existing, reusedBook: true };
    const book = existing?.book || await tx.book.create({
      data: { ...owner, title, mode: 'book', prompt: title, coverUrl: pageData.imageUrl },
    });
    const page = await tx.page.create({ data: { ...pageData, bookId: book.id, promptHash: null } });
    if (existing) await tx.book.update({ where: { id: book.id }, data: { coverUrl: pageData.imageUrl } });
    return { book, page, reusedBook: false };
  });
  // 缓存唯一键竞争不能导致刚保存的书籍事务失败；缓存写入单独处理。
  if (!result.reusedBook && pageData.promptHash) {
    try {
      await db.page.update({ where: { id: result.page.id }, data: { promptHash: pageData.promptHash } });
    } catch (error) {
      if (error.code !== 'P2002') console.warn('[topic-book] 缓存指纹保存失败:', error.message);
    }
  }
  return result;
}

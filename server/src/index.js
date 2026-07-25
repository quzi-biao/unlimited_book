import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import prisma          from './config/db.js';
import booksRouter      from './routes/books.js';
import pagesRouter      from './routes/pages.js';      // /:bookId/pages 路由
import singlePageRouter from './routes/singlePage.js'; // /pages/:id 路由
import aiRouter         from './routes/ai.js';
import uploadRouter     from './routes/upload.js';
import promptsRouter    from './routes/prompts.js';
import annotationsRouter, { deleteAnnotation } from './routes/annotations.js';
import ttsRouter        from './routes/tts.js';        // Minimax 语音合成
import deviceRouter     from './routes/device.js';     // 设备注册/心跳
import adminRouter      from './routes/admin/index.js'; // Admin 后台
import paymentRouter    from './routes/payment.js';     // 支付（套餐购买）
import agreementsRouter from './routes/agreements.js';  // 客户端协议
import ticketsRouter    from './routes/tickets.js';     // 客户端工单
import { requireAuth } from './middleware/auth.js';
import { startVoiceSyncJob } from './services/ai/voiceSync.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3007;
const isProd = process.env.NODE_ENV === 'production';

// ── 中间件 ──────────────────────────────────────────────
// gzip 压缩已在 Nginx 层配置（gzip_types 覆盖所有文本/JSON 接口）
app.use(helmet({ contentSecurityPolicy: false })); // 生产关闭 CSP 以兼容内联资源
app.use(cors({
  // 生产环境允许同源访问；开发环境允许 Vite dev server
  origin: isProd
    ? true
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
}));
app.set('trust proxy', true);
app.use(morgan(':method :url :status :response-time ms - :res[content-length] - IP: :remote-addr'));
app.use(express.json({ limit: '50mb' })); // base64 图片可能较大

// ── 路由挂载 ────────────────────────────────────────────
app.use('/api/books',   booksRouter);
app.use('/api/books',   pagesRouter);      // /api/books/:bookId/pages
app.use('/api/pages',   singlePageRouter); // /api/pages/:id, /api/pages/cache/:hash
app.use('/api/ai',      aiRouter);
app.use('/api/upload',  uploadRouter);
app.use('/api/prompts', promptsRouter);
app.use('/api/pages/:pageId/annotations', annotationsRouter); // 探索标注
app.delete('/api/annotations/:id', requireAuth, deleteAnnotation);
app.use('/api/tts',     ttsRouter);        // Minimax 语音合成
app.use('/api/device',  deviceRouter);     // 设备注册/心跳/信息
app.use('/api/device',  paymentRouter);    // 套餐购买 & 支付
app.use('/api/agreements', agreementsRouter); // 客户端协议
app.use('/api/tickets', ticketsRouter);       // 客户端工单
app.use('/api/admin',   adminRouter);      // Admin 后台接口


// ── 健康检查 ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── 生产环境：静态伺服 Admin 后台构建产物 ─────────────────
if (isProd) {
  const adminDistPath = path.resolve(__dirname, '../../admin-frontend/dist');

  // Admin 后台静态文件（/admin 路径）
  app.use('/admin', express.static(adminDistPath));
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  });
}

// Native App 模式：根路径仅返回服务信息，不再承载 Web 前端。
app.get('/', (_req, res) => {
  res.json({ service: 'flipbook-server', mode: 'android-native' });
});

// ── 全局错误处理 ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message, err.stack);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || '服务器内部错误' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Flipbook server running on http://localhost:${PORT}`);
  // 启动时同步音色，之后每 24h 自动重夏
  startVoiceSyncJob();
});

// ── PostgreSQL 连接保活（每 60s 执行 SELECT 1，防止服务端关闭空闲连接）──
// 双重保险：连接串已加 keepalives TCP 参数，这里再加应用层 ping
const dbKeepaliveTimer = setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.warn('[DB keepalive] ping 失败，Prisma 会在下次请求时自动重连:', e.message);
  }
}, 60_000); // 60s，小于 PostgreSQL 默认 idle timeout
dbKeepaliveTimer.unref(); // 不阻止进程退出

// ── 优雅关闭：释放 Prisma 连接池，防止重启后连接耗尽 ──────
async function shutdown(signal) {
  console.log(`\n[${signal}] 正在关闭服务器...`);
  clearInterval(dbKeepaliveTimer);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Prisma 连接已释放，进程退出');
    process.exit(0);
  });
  // 超时强制退出
  setTimeout(() => process.exit(1), 8000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

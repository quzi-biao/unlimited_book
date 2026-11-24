import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { fail } from '../../services/knowledge/policy.js';
import { uploadBase64 } from '../../services/oss.js';
import { regenerateNodeImage } from '../../services/knowledge/imageRegeneration.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

/** 仅生成候选图，管理员保存图文后才更新节点。 */
router.post('/regenerate', async (req, res, next) => {
  try {
    res.status(201).json(await regenerateNodeImage(req.body, req.adminUser.id));
  } catch (error) { next(error); }
});

/** 接收管理员替换的图片，验证真实格式并重新编码后保存。 */
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, error => {
    if (error) return next(Object.assign(new Error(error.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 10 MB' : '图片上传失败，请重新选择图片'), { status: 400 }));
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) fail(400, '请选择图片');
    let buffer;
    try {
      const image = sharp(req.file.buffer, { limitInputPixels: 40000000 });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) fail(400, '仅支持 JPG、PNG、WebP 图片');
      buffer = await image.rotate().png().toBuffer();
    } catch (error) {
      if (error.status === 400) throw error;
      fail(400, '图片无法读取，请选择有效的 JPG、PNG 或 WebP 图片（最多 4000 万像素）');
    }
    const imageUrl = await uploadBase64(`data:image/png;base64,${buffer.toString('base64')}`, 'knowledge', req.adminUser.id);
    res.status(201).json({ imageUrl });
  } catch (error) { next(error); }
});

export default router;

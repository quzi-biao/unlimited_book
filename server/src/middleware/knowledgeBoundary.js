import { requireAuth } from './auth.js';
import prisma from '../config/db.js';
import { resolveReader } from '../services/knowledge/readerAuth.js';
import { assertGeneration, fail } from '../services/knowledge/policy.js';

/** 旧端请求同样受新模式控制，禁止通过旧 AI、上传、标题、TTS 路由绕开。 */
export function knowledgeBoundary(req,res,next) {
  const path = req.path;
  const isAi = path.startsWith('/ai/');
  const isGeneration = isAi || path.startsWith('/upload') || path.startsWith('/tts') && req.method === 'POST' || /^\/pages\/[^/]+\/(explanation|refresh-title)/.test(path) || /^\/books\/[^/]+\/pages$/.test(path) && req.method === 'POST';
  const isLegacyContent = /^\/(books|pages|annotations)(\/|$)/.test(path);
  if (!isGeneration && !isLegacyContent) return next();
  requireAuth(req,res,authError => {
    if (authError) return next(authError);
    if (!req.deviceId) return next();
    resolveReader(req,res,async error => {
      if (error) return next(error);
      try {
        if (req.reader.mode === 'safe' && isLegacyContent) fail(403,'安全模式请使用已发布的公共知识树');
        const owner = await prisma.legacyImportOwner.findUnique({where:{deviceId:req.deviceId}});
        if (owner ? owner.profileId !== req.reader.id : req.reader.deviceId !== req.deviceId) {
          fail(403,'请使用自己的设备书架或从知识树打开图册');
        }
        if (isGeneration) assertGeneration(req.reader);
        next();
      } catch(err) {next(err);}
    });
  });
}

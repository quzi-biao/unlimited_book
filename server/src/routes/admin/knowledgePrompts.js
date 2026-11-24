import { Router } from 'express';
import prisma from '../../config/db.js';
import { evaluateRelease, assertReleaseReady } from '../../services/knowledge/evaluation.js';
import { uploadBase64 } from '../../services/oss.js';
import { fail } from '../../services/knowledge/policy.js';
import { getDeviceAiConfig } from '../../services/ai/deviceConfig.js';

const router=Router();
/** 显式运行真实模型评测，结果永久记录，失败不会激活提示词。 */
router.post('/:id/evaluate',async(req,res,next)=>{
  try {
    const release=await prisma.promptRelease.findUnique({where:{id:req.params.id}});
    if(!release) fail(404,'提示词版本不存在');
    const report=await evaluateRelease(release);
    for(const item of report.cases) if(item.image) {item.imageUrl=await uploadBase64(item.image,'evals',release.id);delete item.image;}
    await prisma.promptRelease.update({where:{id:release.id},data:{evals:report}});
    res.json({report});
  }catch(error){next(error);}
});

router.post('/:id/activate',async(req,res,next)=>{
  try {
    const release=await prisma.promptRelease.findUnique({where:{id:req.params.id}});
    if(!release) fail(404,'提示词版本不存在');
    assertReleaseReady(release,req.body.rollout,await getDeviceAiConfig());
    await prisma.promptRelease.update({where:{id:release.id},data:{status:req.body.rollout?'active':'draft',rollout:req.body.rollout}});
    res.json({saved:true});
  }catch(error){next(error);}
});
export default router;

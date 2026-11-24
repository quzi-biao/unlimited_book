import prisma from '../config/db.js';
import { refundOrder, queryRefund } from './wechat.js';
import { fail, monthPeriod } from './knowledge/policy.js';

/** 只有渠道确认成功才撤销权益；并发重试按原支付订单加锁，仅扣回一次。 */
export async function settleRefund(orderId, db = prisma) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))::text`;
    const order = await tx.order.findUnique({where:{id:orderId}});
    if (!order) fail(404,'订单不存在');
    if (order.status === 'refunded') return {status:'refunded',alreadyRefunded:true};
    if (!['paid','refund_pending'].includes(order.status)) fail(409,'订单尚未支付');
    const wallet = await tx.deviceWallet.update({where:{deviceId:order.deviceId},data:{balance:{decrement:order.points}}});
    await tx.pointLedger.create({data:{walletId:wallet.id,deviceId:order.deviceId,delta:-order.points,balance:wallet.balance,type:'refund',refId:order.id,reason:'支付渠道确认退款，撤回原订单点数'}});
    if (order.monthlyAllowance > 0 && order.readerProfileId && order.paidAt) {
      const {period}=monthPeriod(order.paidAt);
      // 已消耗的历史保留，额度不足会阻止下一次生成；不删除用户已有内容。
      await tx.readerEntitlement.updateMany({where:{profileId:order.readerProfileId,period},data:{allowance:{decrement:order.monthlyAllowance}}});
    }
    await tx.order.update({where:{id:order.id},data:{status:'refunded'}});
    return {status:'refunded',alreadyRefunded:false};
  });
}

/** 同一退款单号可安全重试；处理中由后台继续查询，不把受理当作到账。 */
export async function requestRefund(orderId, dependencies = {}) {
  const db=dependencies.db || prisma;
  const order=await db.order.findUnique({where:{id:orderId},include:{payment:true}});
  if (!order) fail(404,'订单不存在');
  if (order.status === 'refunded') return {success:true,status:'refunded',message:'该订单已退款'};
  if (!['paid','refund_pending'].includes(order.status)) fail(400,'只能对已支付的订单发起退款');
  if (!order.payment) fail(409,'缺少支付记录，请先核对账目');
  if (order.payment.channel !== 'wechat') fail(400,'该渠道需先在线下完成退款并对账，不能直接标记成功');
  const number=`REFUND_${order.id}`;
  const result=order.status === 'refund_pending'
    ? await (dependencies.query || queryRefund)(number)
    : await (dependencies.refund || refundOrder)(order.id,number,order.amount,order.amount,'管理员后台发起退款');
  const data=result.data || result;
  if (data.out_trade_no !== order.id || data.out_refund_no !== number || data.amount?.refund !== order.amount || data.amount?.total !== order.amount) fail(502,'退款响应与原订单不符');
  if (data.status === 'SUCCESS') {
    await settleRefund(order.id,db);
    return {success:true,status:'refunded',message:'渠道已确认退款，原订单权益已撤回'};
  }
  if (data.status === 'PROCESSING') {
    await db.order.updateMany({where:{id:order.id,status:'paid'},data:{status:'refund_pending'}});
    return {success:true,status:'refund_pending',message:'退款处理中，可刷新查询到账结果'};
  }
  fail(409,`退款尚未成功（${data.status || '未知状态'}），请核对支付渠道`);
}

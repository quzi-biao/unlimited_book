import prisma from '../config/db.js';
import { fail, monthPeriod } from './knowledge/policy.js';

/** 已验签的支付成功数据原子入账；并发回调只能充值一次，权益按订单快照发放。 */
export async function handleOrderPaid(outTradeNo, wxData, db = prisma) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${outTradeNo}))::text`;
    const order = await tx.order.findUnique({where:{id:outTradeNo}});
    if (!order) fail(404,'订单不存在');
    if (['paid','refund_pending'].includes(order.status)) return {alreadyPaid:true};
    if (order.status === 'refunded') fail(409,'订单已退款');
    if (!wxData.transaction_id || wxData.amount?.total !== order.amount || wxData.amount?.currency && wxData.amount.currency !== 'CNY') fail(400,'支付金额或币种与订单不符');
    await tx.order.update({where:{id:order.id},data:{status:'paid',paidAt:new Date()}});
    await tx.payment.create({data:{orderId:order.id,channel:'wechat',channelOrderId:wxData.transaction_id,rawResponse:wxData,paidAt:new Date()}});
    const wallet = await tx.deviceWallet.upsert({where:{deviceId:order.deviceId},create:{deviceId:order.deviceId,balance:order.points},update:{balance:{increment:order.points}}});
    await tx.pointLedger.create({data:{walletId:wallet.id,deviceId:order.deviceId,delta:order.points,balance:wallet.balance,type:'purchase',refId:order.id,reason:`微信支付充值 ${order.points} 点`}});
    if (order.monthlyAllowance > 0 && order.readerProfileId) {
      const {period,expiresAt}=monthPeriod();
      await tx.readerEntitlement.upsert({where:{profileId_period:{profileId:order.readerProfileId,period}},
        create:{profileId:order.readerProfileId,period,expiresAt,allowance:order.monthlyAllowance},update:{allowance:{increment:order.monthlyAllowance}}});
    }
    return {alreadyPaid:false};
  });
}

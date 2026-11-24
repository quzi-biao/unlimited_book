import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { get, post } from '../api/client.js';

/** 按月购买算力额度；价格由后台配置，公共树与缓存仍免费。 */
export function MonthlyPlans({ toast }) {
  const [plans,setPlans]=useState([]);const [order,setOrder]=useState(null);const [qr,setQr]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{get('/api/device/plans').then(data=>setPlans(data.plans.filter(p=>p.monthlyAllowance>0))).catch(e=>toast(e.message));},[toast]);
  useEffect(()=>{
    if(!order)return;
    const timer=setInterval(async()=>{try{const data=await get(`/api/device/payment/order/${order.orderId}`);if(data.status==='paid'){clearInterval(timer);setOrder(null);toast('本月生成额度已到账，请刷新查看');}}catch(error){toast(error.message);}},5000);
    return()=>clearInterval(timer);
  },[order,toast]);
  /** 只有用户明确点击购买才创建订单，不自动扣费或自动续订。 */
  async function buy(plan){setBusy(true);try{const result=await post('/api/device/payment/create',{planId:plan.id});setOrder(result);setQr(await QRCode.toDataURL(result.codeUrl));}catch(error){toast(error.message);}finally{setBusy(false);}}
  return <section><h3>本月算力套餐</h3><p>额度有效至本月末（UTC），不自动续订。已经保存的内容可以继续使用。</p>{!plans.length&&<p>暂未上架月度套餐。</p>}{plans.map(p=><div key={p.id} className="action-row"><span>{p.name} · {p.monthlyAllowance} 次 · ¥{(p.price/100).toFixed(2)}</span><button disabled={busy} onClick={()=>buy(p)}>购买</button></div>)}{order&&<div><img src={qr} alt="微信支付二维码" width="220"/><p>请使用微信扫码支付 ¥{(order.amount/100).toFixed(2)}</p><button onClick={()=>setOrder(null)}>关闭支付窗口</button></div>}</section>;
}

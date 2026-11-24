import { useEffect, useState } from 'react';
import { knowledgeApi } from './api.js';
import { MonthlyPlans } from './MonthlyPlans.jsx';
import { exportLibrary } from './export.js';
import { TreeMap } from './TreeMap.jsx';

/** 账号、可重置偏好、监护许可都由用户主动操作。 */
export function AccountPanel({ profile, switchAccount, settings, toast, onClose }) {
  const [login, setLogin] = useState(true);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [ageBand, setAgeBand] = useState('minor'); const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false); const [code, setCode] = useState('');
  const [children, setChildren] = useState([]); const [report, setReport] = useState(null);
  const [entitlement, setEntitlement] = useState(null);
  const [voices, setVoices] = useState([]);
  const prefs = profile.preferences || {};

  /** 后端校验成人／儿童绑定关系，界面不代替权限检查。 */
  async function loadChildren() {
    try { const data = await knowledgeApi('/guardian/children'); setChildren(data.children); }
    catch (error) { toast(error.message); }
  }
  useEffect(() => {
    if (profile.username) loadChildren();
    knowledgeApi('/entitlement').then(data => setEntitlement(data.entitlement)).catch(error => toast(error.message));
    knowledgeApi('/voices').then(data=>setVoices(data.voices)).catch(error=>toast(error.message));
  }, [profile.id]);

  /** 成功登录后切换独立本地空间，原有离线数据不删除。 */
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await knowledgeApi(`/account/${login ? 'login' : 'register'}`, { username, password, ageBand, displayName });
      setPassword(''); await switchAccount(result.token); toast('账号已连接，可在其他设备登录同一座知识库');
    } catch (error) { toast(error.message); } finally { setBusy(false); }
  }

  /** 监护人的每一项许可独立保存，家庭设置与读者的探索模式独立。 */
  async function changeChild(child, values) {
    try { await knowledgeApi(`/guardian/children/${child.id}`, { revision: child.settingsRevision, ...values }, 'PATCH'); await loadChildren(); }
    catch (error) { toast(error.message); await loadChildren(); }
  }

  return <section className="knowledge-panel" aria-label="我的账号"><header><h2>我的知识库</h2><button onClick={onClose}>关闭</button></header>
    <p>{profile.username ? `已登录：${profile.displayName}（${profile.username}）` : '当前数据属于这台设备。创建账号后，可以在手机、平板和电脑上打开同一座知识库。'}</p>
    <div className="action-row"><button onClick={() => setLogin(true)}>登录已有账号</button>{!profile.username && <button onClick={() => setLogin(false)}>创建账号</button>}
      {profile.username && <button onClick={() => switchAccount(null)}>切回本机身份</button>}</div>
    <form onSubmit={submit}><h3>{login ? '账号登录' : '创建账号'}</h3><label>账号<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={64}/></label>
      <label>密码<input type="password" autoComplete={login ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={10} maxLength={128} required/></label>
      {!login && <><label>昵称<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} required/></label><label>使用者<select value={ageBand} onChange={e => setAgeBand(e.target.value)}><option value="minor">未成年人</option><option value="adult">成年人</option></select></label></>}
      <button disabled={busy}>{busy ? '连接中…' : login ? '登录' : '创建并保留本机轨迹'}</button></form>
    <section><h3>表达方式由你决定</h3><p>这些偏好只影响怎么讲、怎么画，不屏蔽其他领域的内容。</p>
      <label>解读语言<select value={prefs.language || 'zh'} onChange={e => settings({ preferences: { ...prefs, language: e.target.value } })}><option value="zh">中文</option><option value="en">English</option></select></label>
      <label>阅读目的<select value={prefs.purpose || 'explore'} onChange={e => settings({ preferences: { ...prefs, purpose: e.target.value } })}><option value="explore">随好奇心探索</option><option value="goal">带着目标阅读</option></select></label>
      <label>主模态<select value={prefs.modality || 'image'} onChange={e => settings({ preferences: { ...prefs, modality: e.target.value } })}><option value="image">以图片为主</option><option value="text">以文字为主</option></select></label>
      <label>讲解深度<select value={prefs.level || 'general'} onChange={e => settings({ preferences: { ...prefs, level: e.target.value } })}><option value="beginner">入门</option><option value="general">一般</option><option value="advanced">深入</option></select></label>
      <label><input type="checkbox" checked={prefs.adaptive !== false} onChange={e=>settings({preferences:{...prefs,adaptive:e.target.checked}})}/>依据这页的自评调整下一步讲解梯度</label><p>刚接触时先给具体例子，回想过再连接，能讲清时向深一层展开；不会据此给你贴能力标签。</p>
      <label>朗读音色<select value={prefs.voice || ''} disabled={profile.permissions?.disabledPreferences?.voice} onChange={e=>settings({preferences:{...prefs,voice:e.target.value}})}><option value="">设备默认音色（离线可用）</option>{voices.map(v=><option key={v.voiceId} value={v.voiceId}>{v.voiceName || v.description || v.voiceId}</option>)}</select></label><p>云端音色首次合成使用生成额度；安全模式只播放已保存的音轨，缺失时使用设备朗读。</p>
      <label><input type="checkbox" checked={prefs.personalization !== false} onChange={e => settings({ preferences: { ...prefs, personalization: e.target.checked } })}/>使用我的表达偏好</label>
      <button onClick={() => settings({ preferences: {} })}>重置全部偏好</button></section>
    {entitlement && <section><h3>本月生成额度</h3><p>{entitlement.period} · 已用 {entitlement.consumed} / {entitlement.allowance} 次。已有内容与公共树探索不消耗生成额度。</p></section>}
    {profile.username && <MonthlyPlans toast={toast}/>}
    <section><h3>带走自己的数据</h3><button onClick={() => exportLibrary().catch(e => toast(e.message))}>导出知识库与完整轨迹</button><p>JSON 包含节点、笔记、连接、修订与尚未同步的记录；阅读页可单独导出可打印的分枝。</p></section>
    {profile.username && (profile.ageBand === 'adult' || !profile.guardianId) && <details>
      <summary>家庭设置</summary>
    {profile.ageBand !== 'adult' && <section><h3>邀请监护人</h3><button onClick={async () => { try { const data = await knowledgeApi('/guardian/invite', {}); setCode(data.code); } catch(e) { toast(e.message); } }}>生成十分钟邀请码</button>{code && <p className="invite-code">{code}</p>}</section>}
    {profile.ageBand === 'adult' && <section><h3>监护人观察端</h3><label>孩子提供的邀请码<input value={code} onChange={e => setCode(e.target.value)} /></label>
      <button onClick={async () => { try { await knowledgeApi('/guardian/accept', { code }); setCode(''); loadChildren(); } catch(e) { toast(e.message); } }}>绑定儿童账号</button>
      {children.map(child => <article key={child.id} className="child-card"><h3>{child.displayName}</h3>{[['diagnosis','允许主动使用有限之书'],['nearby','允许开启邻域共学']].map(([key,label]) => <label key={key}><input type="checkbox" checked={!!child.permissions[key]} onChange={e => changeChild(child,{ permissions: { [key]: e.target.checked } })}/>{label}</label>)}
        <p>当前表达偏好：{JSON.stringify(Object.fromEntries(Object.entries(child.preferences).filter(([key])=>key!=='style')))}</p>{[['language','解读语言'],['voice','音色'],['purpose','阅读目的'],['modality','主模态'],['level','讲解深度'],['adaptive','自评后的梯度调整']].map(([key,label])=><label key={key}><input type="checkbox" checked={!child.permissions.disabledPreferences?.[key]} onChange={e=>changeChild(child,{disabledPreferences:{[key]:!e.target.checked}})}/>{label}</label>)}<button onClick={() => changeChild(child,{ resetPreferences: true })}>重置偏好</button>
        <label><input type="checkbox" checked={child.preferences.personalization !== false} onChange={e => changeChild(child,{ personalization: e.target.checked })}/>使用表达偏好</label>
        <button onClick={async () => { try { setReport((await knowledgeApi(`/guardian/children/${child.id}/report`)).report); } catch(e) { toast(e.message); } }}>查看本周探险报</button></article>)}
      {report && <Report report={report}/>}</section>}
    </details>}
  </section>;
}

/** 报告仅呈现行为事实和孩子的原始表达。 */
export function Report({ report }) {
  const [selected,setSelected]=useState(null);
  return <section className="observation"><h3>{report.days === 7 ? '本周探险报' : '我的知识树月报'}</h3><p>这些是走过的路，各有自己的形状。</p><p>打开了 {report.opened} 次页面。</p>
    {!!report.tree?.length&&<TreeMap nodes={report.tree} onSelect={setSelected}/>}{selected&&<p>「{selected.asset.title}」：{selected.asset.explanations?.[selected.asset.language]}</p>}
    <p>新枝：{report.branches.map(n => n.title).join('、') || '这一段时间还没有新枝'}</p><p>再次回看：{report.revisits.join('、') || '暂无'}</p>
    {report.expressions.map((e,i) => <blockquote key={i}>{e.text}</blockquote>)}<p>{report.conversation}</p></section>;
}

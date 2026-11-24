/** 新读者账号凭证与设备凭证独立，旧客户端与新客户端可并存。 */
export async function knowledgeApi(path, body, method = body === undefined ? 'GET' : 'POST') {
  const token = localStorage.getItem('wuxian_token');
  // 重新登录只需设备凭证，过期的旧账号凭证不能阻挡密码登录。
  const reader = path === '/account/login' ? null : localStorage.getItem('knowledge_reader_token');
  const base = window.unlimitedBookNative?.apiBase || '';
  const response = await fetch(`${base}/api/knowledge${path}`, { method, headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(reader ? { 'X-Reader-Token': reader } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || '请求失败'), { status: response.status });
  return result;
}

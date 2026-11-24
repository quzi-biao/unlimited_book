/** 终端表达同样遵守逐项监护许可，与服务端保持相同语义。 */
export function readerPreferences(profile) {
  if (profile.permissions?.personalization === false || profile.preferences?.personalization === false) return {};
  return Object.fromEntries(Object.entries(profile.preferences || {}).filter(([key])=>!profile.permissions?.disabledPreferences?.[key]));
}

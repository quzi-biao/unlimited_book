/** 个性化只调整表达；监护人可以逐项关闭，不能减少内容池。 */
export function effectivePreferences(profile) {
  if (profile.permissions?.personalization === false || profile.preferences?.personalization === false) return {};
  return Object.fromEntries(Object.entries(profile.preferences || {}).filter(([key])=>profile.permissions?.disabledPreferences?.[key] !== true));
}

/** 最近发展区以当前节点的明确自评为依据，只调整本次解释梯度。 */
export function challengeLevel(profile, node) {
  const prefs=effectivePreferences(profile);
  if (prefs.adaptive === false || profile.permissions?.disabledPreferences?.adaptive) return 'general';
  if (prefs.level && prefs.level !== 'general') return prefs.level;
  return node?.mastery >= 4 ? 'one-step-deeper' : node?.mastery >= 2 ? 'guided-connection' : 'concrete-example';
}

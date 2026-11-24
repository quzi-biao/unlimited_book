/** 读取正式 iOS 阅读器注入的安装标识，避免不同 iPhone 使用相同网页指纹。 */
export function getNativeDevice(scope = window) {
  const device = scope.unlimitedBookNative;
  if (!['ios','android'].includes(device?.platform)) return null;
  if (device.platform === 'ios' && !/^ios-[0-9a-f-]{36}$/i.test(device.fingerprint || '')) return null;
  if (device.platform === 'android' && !/^[a-zA-Z0-9_-]{6,100}$/.test(device.fingerprint || '')) return null;
  return device;
}

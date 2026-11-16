/** 读取正式 iOS 阅读器注入的安装标识，避免不同 iPhone 使用相同网页指纹。 */
export function getNativeDevice(scope = window) {
  const device = scope.unlimitedBookNative;
  if (device?.platform !== 'ios' || !/^ios-[0-9a-f-]{36}$/i.test(device.fingerprint || '')) return null;
  return device;
}

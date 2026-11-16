# 2026-11-16 生产更新与 iOS TestFlight

## 已上线

- 后端：`ubuntu@10.138.10.122`，容器 `flipbook`，镜像 `flipbook:wide-20261116-148`。
- 内网网页：容器 `flipbook-web`，镜像 `flipbook-web:wide-20261116-148-ui2`。
- 公网网页：`https://www.wenyi-tech.cn/app/`，服务器 `14.103.42.128`。
- 新话题按需调用 AI；`SHARED_TOPIC_IMAGES_ENABLED=false`，不读取公共预生成图片。
- 已有个人同名话题继续复用，不重复生成或扣点；预生成图片及旧图书数据保留。
- 新图要求 `1536x864`、16:9；实际返回按画幅校验，允许像素舍入。
- 主动风格的旧 3:2 提示已定向改为 16:9，修改前另存原始提示备份。
- 手机搜索与朗读总宽度为显示图片宽度的 60%；网页图标适配 /app 子路径。
- 修复 iOS 输入框聚焦自动放大问题：手机搜索输入字号至少 16px。
- 未发布新 Android APK；线上手机 APK 仍为 1.0.147，平板 OTA 保持原版本。

## 验证

- 本地与候选生产容器：25 项后端测试通过；5 项网页测试通过。
- 候选容器及上线后：健康检查、已有话题复用、53 页书籍读取通过，验证前后书籍/页数/点数不变。
- 提示更新前后：137 本书、431 页、577 个标注、161 条话题缓存，数量一致。
- 真实上游探测：36 秒返回 1672×941 PNG，约 16:9；未写入任何用户书架或扣点台账。
- 公网首页、图标、JS、CSS 共 8 个关键文件的哈希与最终构建一致。
- iPhone 17 Pro 模拟器：正式 HTTPS 服务注册、余额读取、横屏、安全区域、图标、顶部控件与输入不缩放均通过。
- 两次 iPhone 真实生成请求返回 OpenLux `Current group upstream load is saturated`；未完成书页生成，余额维持 10000。此次发布不解决上游容量问题。
- 微信内容检查仍有缺少配置的既有日志；当前请求继续到生图服务。

## iOS

- 工程：`ios/UnlimitedBook.xcodeproj`；UIKit + WKWebView 全屏阅读器。
- 加载正式网页；不依赖 localhost，不内置接口密钥，不打包书页图片。
- Bundle ID：`cn.wenyi.unlimitedbook`；版本：`1.0.0 (1)`；最低 iOS 17，支持 iPhone/iPad。
- 默认横屏，无地址栏；每次安装生成独立 UUID，保存于应用 UserDefaults，向正式主页面注入。
- Apple Distribution 签名导出与严格签名检查通过；App Store Connect 上传成功。
- App Store Connect ID：`6835387291`。
- TestFlight 已处理完成；内部群组“无限之书”有 1 个构建版本、1 个测试员。
- 用户指定的开发者账号已显示“已邀请”；用户需要在 iPhone TestFlight 接受邀请并安装。
- 并未提交 App Store 正式审核，也未发布公共测试链接。

## 备份与发布证据

- 本地发布目录：`.local-data/releases/20261116-wide-148`。
- 后端备份：`/home/ubuntu/flipbook/backups/20261116-wide-148`，含数据库、原容器配置、源代码、compose 和提示原文。
- 后端回滚：该目录 `rollback.sh` 恢复上一版本 compose；若同时回退提示，用 `prompts-before.json` 仅恢复本次修改的三个提示字段，不还原整个数据库。
- 公网最初备份：`/var/backups/unlimited-book/20261116-wide-148`；`rollback-web.sh` 可恢复上线前首页。
- UI 修补备份分别在 `20261116-wide-148-ui` 与 `20261116-wide-148-ui2`；旧哈希资源均保留。
- 内网回滚 compose：对应后端备份目录 `web-compose.yml`，复制回 `/home/ubuntu/flipbook-web/docker-compose.yml` 后重建 web 服务。
- iOS IPA、archive、上传日志、包 SHA256、TestFlight 邀请截图均在本地发布目录。
- 批量生图保持停止；本地旧新图片去重合并任务未恢复。

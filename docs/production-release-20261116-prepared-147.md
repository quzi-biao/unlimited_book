# 2026-11-16 首层预生成与阅读界面发布（147）

## 当前发布

- 公网网页：https://www.wenyi-tech.cn/app/。
- 公网静态目录：14.103.42.128:/var/www/wenyi-tech.cn/app。
- 后端：ubuntu@10.138.10.122，镜像 flipbook:prepared-20261116-147。
- 内网网页：10.138.10.122:8890，镜像 flipbook-web:prepared-20261116-147。
- 手机 APK：1.0.147-phone，versionCode 147，包名 com.flipbook.ai.phone。
- 下载：https://www.wenyi-tech.cn/downloads/unlimited-book/unlimited-book-phone-1.0.147.apk。
- 本地 APK：android/releases/unlimited-book-phone-1.0.147.apk。
- APK 大小 37,247,485 字节；SHA256 a37ab6baf7305b00f4d19d4c29063e0d85182ebb7bdb5809f9460590b10f922d。
- 签名证书 SHA256 ce0783da862ffe8dd3e573e06a52a29cbf24a42b8e302cd4021b4b3839980226，与 146 手机包一致，可覆盖更新。

## 功能范围

顶部目录/书名/页名、余额/充值/设置各自独立框；底部搜索与朗读独立悬浮，不再共用外框。
网页首页保留禁用的朗读入口，打开内容后启用。
网页和安卓话题分类优先打开已有书或共享预生成图片；百科缓存不再等待 AI 起标题。
固定请求尺寸 1536×1024，沿用之前回退策略；不再按设备比例生成。
预设可探索区域尚未实施，原有框选行为保持。

本地数据清空记录和内容重置标识没有部署到线上；线上原有书籍、页面、标注、账号、余额保持。
新版包含本地专用内容版本兼容逻辑，线上未设置本地上传目录，因此不会清理线上浏览器阅读记录。
平板 OTA 仍为 1.0.140，本轮未修改版本表、未给硬件推送手机包。

## 图片发布

本次快照包含 88 张已生成的首层图片。每张上传到生产 OSS 后下载核对 SHA256，再写入 TopicCache。
OSS 路径使用 flipbook/prepared-topics/<内容SHA256>.<扩展名>，有正确 image/png 或 image/jpeg MIME。
已有同名共享缓存更新为本次图片，原用户书页仍引用原图片；旧 OSS 文件保留。
没有把本地数据库整体导入生产，没有删除生产用户内容或扣减用户余额。
生产首层图片不进入 APK，客户端通过服务端返回的 OSS 地址加载。

本地剩余话题继续生成。后续完成图片仍需执行增量上传/缓存发布；本轮没有启动自动线上同步服务。
增量发布脚本：server/scripts/publish-topic-roots.js，默认仅校验，显式 --execute 才上传及写缓存。
本次清单、上传记录及旧映射在生产 releases/20261116-prepared-147/topic-batch-01。
发布脚本检查话题、图片格式、SHA256和旧缓存映射；失败可续跑，成功项目不会重复上传。

## 验证

- 候选后端 16 项隔离测试全部通过。
- 生产依赖和 Prisma schema 与原版本一致，没有执行迁移或 seed；实际源码覆盖变化为 4 个文件。
- 候选和正式服务均验证既有书查询/复用、53 页目录、标注读取及余额不变。
- 88 个生产缓存地址逐一与发布记录匹配；真实公网黄山缓存首次打开约 260ms，图片 HTTP 200 且 MIME 正确；重复打开复用同一书页。
- 临时验证书籍已清理，没有扣设备余额。
- Web 公网 HTML、全部 JS/CSS 资源与构建清单哈希一致，未包含本地共用身份。
- 浏览器确认公网首页、朗读禁用入口和话题分类正常渲染。
- Android assemblePhoneRelease、lintVitalPhoneRelease 通过；手机 11、平板 11、共享模块 3 项测试通过。
- APK 检查：正式域名 API、默认横屏、非 debuggable、签名匹配，包内包含预生成话题直开代码。
- 公网 APK HTTPS 完整下载后 SHA256 与本地一致。没有连接真机，尚未进行本版安装和音频实机验收。

## 备份与回滚

- 后端备份：/home/ubuntu/flipbook/backups/20261116-prepared-147，包含旧 Compose、容器配置、源码、数据库 dump 及 pg_restore --list 验证。
- 后端代码回滚：sh /home/ubuntu/flipbook/backups/20261116-prepared-147/rollback.sh。仅切回代码，不恢复业务数据库。
- 内网网页：备份 web-compose.yml 及旧镜像 flipbook-web:before-prepared-147。
- 公网备份：/var/backups/unlimited-book/20261116-prepared-147，含旧 app 归档；rollback-web.sh 仅恢复旧入口，旧哈希资源保留。
- 图片映射回滚脚本：/home/ubuntu/flipbook/releases/20261116-prepared-147/rollback-topic-caches.mjs。需在可访问 Prisma 的服务环境中传入 topic-batch-01 绝对目录运行；仅回滚仍指向本次 URL 的映射，不覆盖后续变更，保留 OSS 对象和用户书页。
- 本地记录、构建产物、脚本和不含私密配置的客户端源码归档：.local-data/releases/20261116-prepared-147。

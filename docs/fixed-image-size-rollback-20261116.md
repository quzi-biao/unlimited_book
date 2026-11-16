# 固定生图尺寸回退（2026-11-16）

> 后续本地变更：新生图已统一为 1536×864（16:9），详见 local-wide-images-20261116.md。以下为之前回退到 3:2 的历史记录；线上未进行这次 16:9 更新。

按用户要求，只回退按设备/窗口比例生图，恢复新生成图片请求尺寸 1536×1024（3:2）。文生图和区域探索共用后端尺寸入口，已安装 1.0.146-phone 及已打开网页继续兼容；客户端传入的 viewport 不再参与尺寸选择，也不再因无效 viewport 拒绝请求。没有重新打包或修改 APK 下载文件。

## 部署范围

- 本地和生产仅修改运行时代码 src/services/ai/imageSize.js 的 resolveImageSize。
- 生产镜像：flipbook:fixed-image-size-20261116；原镜像 flipbook:reader-20261116-146 保留。
- 生产服务器：ubuntu@10.138.10.122，/home/ubuntu/flipbook。
- 发布目录：/home/ubuntu/flipbook/releases/20261116-fixed-image-size。
- 备份目录：/home/ubuntu/flipbook/backups/20261116-fixed-image-size，保留前版 Compose、容器配置、该文件及完整源码哈希清单。
- 回到自适应版本：sh /home/ubuntu/flipbook/backups/20261116-fixed-image-size/rollback.sh。
- 本次没有数据库迁移、seed、旧图片转换或删除。之前的自适应图片保留，打开已有同名书仍复用该书原图。
- 顶部导航、底栏、探索结果显隐、同名书去重、图片等比显示、热点坐标保持不变。网页静态文件、Android 源码、版本和签名没有修改。

## 验证

- 本地及候选容器各 15 项隔离测试通过，包含横竖屏/平板尺寸均返回固定值、百科原缓存、区域探索跨窗口缓存、不同父页层级、同名并发保护、失败重试、供应商 JSON/FormData 实际 size 参数均为 1536x1024。
- Mock 供应商，无付费生图请求。
- 候选与生产源码哈希核对：只有 src/services/ai/imageSize.js 一个文件变化；SHA-256 为 58d86c04e44b3330d08c7b380d5006639b670b4fe81f3c0a62eee809b05d9ba0。
- 原线上环境变量逐项保持一致。
- 正式内网与公网 HTTPS 验证健康、同名书查询与无生成复用、53 页书籍读取、标注读取，前后书页/流水数量及余额一致。
- 已发布客户端无需更新，后端对后续新生图请求统一使用固定尺寸。

本地日志：.local-data/releases/20261116-fixed-image-size/。

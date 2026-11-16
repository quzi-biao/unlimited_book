# 本地恢复按需生图（2026-11-16）

用户要求先在本地停用预生成图片直开，线上暂不调整。

## 当前行为

- 本地 Compose 显式设置 `SHARED_TOPIC_IMAGES_ENABLED=false`。
- `/api/books/topic` 对尚未加入当前书架的话题返回 `prepared:false`；网页和 Android 现有客户端会进入原来的生成队列。
- `/api/ai/generate-image` 在当前书架没有同名书时调用 AI，不读取 TopicCache 或其他用户 Page.promptHash 的公共图片，不改写预生成缓存。
- 用户自己的同名书仍复用；同一用户并发重复提交仍只生成一次，重新打开已有书不扣生成点数。
- 区域探索、既有页面阅读和其缓存逻辑保持现状。
- 187 张本地预生成图片及数据库映射均保留；后台批量生成任务继续停止。
- 线上 1.0.147 的预生成读取模式及已发布 88 张图片未调整；安卓安装包未重新打包。苹果模拟器预览加载 localhost，因此使用本地按需模式。

## 验证

- 21 项隔离测试通过，包含共享模式兼容、本地模式跳过缓存、同名并发去重、失败后重试和已有书免生成。模型请求全部模拟，未调用收费生图。
- 本地真实 API：喜马拉雅山缓存仍存在，未拥有该书的测试身份查询得到 existing:null / prepared:false。已有黄山书仍可直接打开。
- 修改前后逐表 SHA256 核对：books、pages、annotations、topic_caches、device_wallets、point_ledgers、prompt_styles、topics、topic_categories 均未改变。
- 本地后端与网页代理健康，生成 worker 仍为 exited。

备份：`.local-data/backups/before-local-on-demand-20261116-171917`。
回滚镜像：`flipbook:before-local-on-demand-20261116-171917`。
校验记录：`.local-data/diagnostics/20261116-local-on-demand/verification.json`。

以后需要恢复共享图片时，将本地 Compose 的开关改为 true 并重新创建后端容器。不要通过旧数据库覆盖恢复；现有书籍和图片无需删除。

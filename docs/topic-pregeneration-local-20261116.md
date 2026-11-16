# 本地首层预生成与重置（2026-11-16）

## 用户确认范围

- 本机先备份，再清空旧图册与生成数据，然后生成所有话题首层图。
- 保留话题分类、话题、提示词风格、账号、设备、余额、流水及接口配置。
- 预设可探索区域暂不实施；原有框选行为保持。
- 仅操作本地 unlimited_book 容器；未部署线上、未发布 APK。
- 固定请求尺寸 1536×1024，使用现有 OpenLux gpt-image-2、low 质量和数据库现用提示词。

## 已完成的备份与清空

备份目录：.local-data/backups/before-topic-pregeneration-20261116-145309。
包含完整 PostgreSQL dump、导入媒体和本地上传归档、源码与私有配置快照。
数据库已还原到隔离临时库，逐表验证行数和完整内容 SHA256 后删除临时库。
详细记录见备份内 manifest.json、RESTORE.md。备份包含秘密配置，禁止公开。

清空：131 本图册、422 张书页、566 条标注、154 条解读、86 条首图缓存、412 份语音主记录及 3901 段语音。
删除 4517 个已备份的生成资源，保留仍被其他业务表引用的头像/试听等资源。
清空事务没有使用 CASCADE；所有非目标表逐行核对未改变。
记录：.local-data/maintenance/topic-reset.json。

## 批量生成

- 共 1569 个话题；启用分类下 1387 个，其余 182 个仍由现有分类 API 放入“其他”，故全部包含。
- 每个话题仅生成一张根图写入 TopicCache；不提前创建用户书架，不生成子页，不扣用户设备点数。上游正常计费。
- 独立本地 Docker 任务：unlimited_book-topic-roots-20261116，并发 2。
- 进度：.local-data/topic-preparation/progress.json，每项记录状态、时间、实际尺寸、地址与错误。
- 成功图片位于 .local-data/uploads/。模型偶尔返回不同尺寸；记录实际尺寸并完整展示，不裁剪、不自动重复付费生成。
- 首两张确认成功后已继续全量。最终进度以 JSON 为准，不能将任务已启动描述为全部完成。
- 连续 5 次失败或发现鉴权/余额问题时停止接新任务；失败默认不自动重试。

脚本：server/scripts/prepare-topic-roots.js。只在本地数据库及资源目录运行，且要求已验证的备份/清空凭证。
恢复时仅续跑 pending；已下载但未入库的图片重试写库，不重生成。
需要重试失败项时显式使用 --retry-failed；可能发生上游重复计费，先阅读错误。
不要同时运行多个 worker。不要把本地 reset.json、progress.json 或 .env 部署到生产。

查看进度：docker logs --tail 20 unlimited_book-topic-roots-20261116。
温和停止：docker kill --signal=TERM unlimited_book-topic-roots-20261116，等在途请求结束。
续跑：确认任务已退出，再删除该退出容器，运行 python3 .local-data/maintenance/run-topic-batch.py --execute --concurrency=2。

## 客户端打开与缓存

- 已准备话题使用话题名作标题，避免缓存命中仍等待 AI 起标题。
- /api/books/topic 增加 prepared 标识；网页及 Android 分类优先直接打开已准备的首图。
- 既有同名书去重及用户计费规则保持；图片准备任务本身不产生设备扣点。
- 本地 /api/health 从上传目录的 .content-revision 返回内容版本。
- 网页启动时先比较版本；变化后只清理 flipbook_session 和 flipbook_explore_queue_v1，再加载阅读状态，避免旧图闪现。
- 登录 token、设备标识、个人设置保留；相同版本刷新不删除新阅读记录；断网或旧版后端不误清数据。
- 后端返回书籍 404 时也会清理当前失效阅读位置。
- 首页朗读入口保持显示；没有当前书页时置灰，并提示“请先打开一个话题再朗读”。打开内容后正常启用。

## 验证

- 16 项尺寸/缓存/并发去重路由测试通过。
- 3 项内容重置浏览器存储测试通过。
- Web 构建成功，Android phone/tablet Kotlin 编译成功；没有生成发布 APK。
- 本地真实缓存请求：首图约 21ms 返回，图片 HTTP 200、PNG MIME 正确；再次访问复用同一页面。
- API 验证使用临时测试归属并清理测试书籍，没有消耗设备余额。
- 用户 Chrome 刷新后旧图片及探索结果入口消失，余额仍为 70；随后确认首页禁用朗读按钮显示。

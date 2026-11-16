# 2026-11-16 阅读界面与生图发布

> 后续变更（2026-11-16 14:39，Asia/Shanghai）：仅生图尺寸策略已回退至固定 1536×1024，当前后端镜像为 flipbook:fixed-image-size-20261116。安卓包仍为 1.0.146-phone，网页界面及其他功能不变。详见 fixed-image-size-rollback-20261116.md。

## 已发布

- 公网网页：https://www.wenyi-tech.cn/app/，14.103.42.128:/var/www/wenyi-tech.cn/app。
- 后端：ubuntu@10.138.10.122，镜像 flipbook:reader-20261116-146。
- 内网网页：10.138.10.122:8890，镜像 flipbook-web:reader-20261116-146。
- 安卓手机包：1.0.146-phone / versionCode 146 / com.flipbook.ai.phone。
- 公网下载：https://www.wenyi-tech.cn/downloads/unlimited-book/unlimited-book-phone-1.0.146.apk。
- 本地安装包：android/releases/unlimited-book-phone-1.0.146.apk。
- APK 大小：37,247,485 字节，SHA-256：d1a93bce6c3b364614915589774c87c1b66e55d959a66342111c31bd3cb0ce59。
- 签名证书 SHA-256：ce0783da862ffe8dd3e573e06a52a29cbf24a42b8e302cd4021b4b3839980226，与已发布手机包一致，可覆盖更新。

## 内容

目录、书名、页名移至左上角；余额、充值、设置在右上角，两侧统一单层半透明胶囊。底栏仅保留搜索和朗读，居中悬浮。探索结果跟随阅读控件显隐，隐藏时保留结果且收起展开面板。新图按阅读区域比例生成；重复输入已有书名复用原书，不因浏览器尺寸变化重复创建。

保留旧图、历史同名书和旧安装包。平板界面、签名及 OTA 表没有发布更新。145 仅有先前本地构建，为避免与旧文件混淆，本次使用 146。

## 发布与验证

- 后端依赖清单、锁文件和 Prisma schema 与之前线上一致，基于旧运行时镜像仅更新源码；57 个源码文件 SHA-256 与本地发布清单一致。
- 候选实例先验证后再切换，原生产环境变量逐项一致；未迁移数据库、未 seed、未复制本地业务数据到线上。
- 后端 15 项隔离测试通过。候选、正式内网和公网域名均验证健康、书架、已有书复用、53 页书籍读取、标注及无效画幅拒绝；验证前后该书架书籍、页面、流水数量及余额一致，没有实际付费生图。
- 网页生产构建不含本地共用阅读身份；公网首页与 JS/CSS 哈希和本地发布产物一致。已发布静态资源在六种浏览器尺寸下完成隔离交互检查，API 使用模拟响应避免生成或收费。
- 安卓 assemblePhoneRelease 与 lintVitalPhoneRelease 通过；共享模块 3 项、手机 Release 11 项、平板 Debug 11 项单元测试通过。默认横屏、非调试包、正式域名 API、签名均核对。
- 公网 HTTPS 下载实际完成，APK 校验和一致。没有连接安卓真机，尚未进行安装、触摸、音频的实机验收。
- 运行中后端与内网网页均 healthy。无效 viewport 校验测试会产生预期的 400 错误日志。

## 备份与回滚

- 后端发布目录：/home/ubuntu/flipbook/releases/20261116-reader-146。
- 后端备份目录：/home/ubuntu/flipbook/backups/20261116-reader-146，含旧容器配置、Compose、服务源码、PostgreSQL 自定义格式备份；pg_restore --list 已验证。
- 后端回滚：sh /home/ubuntu/flipbook/backups/20261116-reader-146/rollback.sh，不恢复或回退业务数据库。
- 内网网页回滚：将备份中的 web-compose.yml 恢复到 /home/ubuntu/flipbook-web/docker-compose.yml，再执行 docker compose up -d --no-deps --force-recreate web。旧镜像额外保留为 flipbook-web:before-reader-146。
- 公网备份目录：/var/backups/unlimited-book/20261116-reader-146，含旧 app 完整压缩包。回滚入口：sh /var/backups/unlimited-book/20261116-reader-146/rollback-web.sh。新旧哈希资源同时保留，不影响已打开页面。
- 部署不修改其他项目、Nginx 配置、后台构建或现有证书。
- 本地验证记录与源码归档：.local-data/releases/20261116-reader-146/。客户端源码归档也保存在后端发布目录，未包含 .env、签名私钥或签名密码配置。

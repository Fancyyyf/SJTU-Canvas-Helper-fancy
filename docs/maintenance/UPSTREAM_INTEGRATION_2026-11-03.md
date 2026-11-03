# upstream 整合实施记录（2026-11-03）

## 基线与范围

- 本地基线：`f2ddf1c`；upstream：`ff03ee9`；共同祖先：`f804dd5`。完整 312 路径差异及双方提交见 [合并前比对](UPSTREAM_COMPARE_2026-11-03.md)。
- 保留本地版本号 `3.0.17`、fork 下载与更新地址、`app-v*` Windows 发布流程。本轮不创建 Release，不推送远端，不提高版本号。
- 合并前创建 `backup/pre-upstream-20261103`，用于回看原本地实现。下表记录用户批准后的实际取舍；“忽略”指刻意不采用对应上游行为，不代表丢弃整个文件。

## 逐项决策与改动

| 编号 | 采用 / 合并 / 忽略的决策 | 详细修改与核验依据 |
| --- | --- | --- |
| D01 课堂转写、精校与主题 | **合并上游并适配本地字幕工作台。** | 接入 `client/transcription.rs`、`client/subtitle_proofread.rs`、`app/video_artifacts.rs` 及前端字幕版本、主题和任务入口；本地 `subtitle_archive.rs` 与 `public/subtitle_archive/` 保留，原始 JSON 和 Agent 文本不被转写结果覆盖。验证转写、精校、缓存、版本和按账号隔离的单元测试。 |
| D02 视频认证 | **采用上游认证主流程，保留本地视频补丁。** | 合入 `video_auth.rs`、`canvas_session.rs`、`client/video.rs` 的官方认证、Token 与扫码回退；保留本地全课程分页、原始字幕下载、直播入口。通过认证与视频 Mock 测试验证返回值、请求隔离和回退。 |
| D03 应用数据与下载 | **合并上游数据管理，保留本地资料。** | 接入 `app/data.rs`、`app/downloads.rs`、`utils/download.rs`、应用数据与下载设置 UI；迁移、备份、清理仅处理被识别的应用数据类别，保留本地字幕归档、个人日历、签到与旧下载路径。验证跨目录回滚、账号隔离、旧目录兼容和删除范围。 |
| D04 分类设置 | **采用上游分类界面，迁入本地配置。** | `settings.tsx` 保留本地托盘关闭行为与开机自启，并通过同一个“保存全部设置”保存；保留签到、Agent、更新配置。系统设置读取失败时提示并禁用对应控件，避免以默认值覆盖原设置。 |
| D05 诊断与本地日志 | **规范化诊断接口，同时保留本地错误日志供用户查看（用户修订）。** | `diagnostics.rs` 负责新结构化 `diagnostics.log`、脱敏及报告；`local_error_log.rs` 保留本地前端事件入口；`main.rs` 同时注册两侧命令。日志窗口显示脱敏报告和历史 `app.log`，后者只在本机查看，不自动附入反馈。`AppError` 序列化脱敏带签名的 URL；日志文件失败时继续启动。 |
| D06 二维码 | **合并上游扫描增强，保留签到。** | 接入多码、反色识别和错误提示；保留 `attendance.rs`、Python 资源、签到页和对应命令。二维码扫描与签到使用各自入口。 |
| D07 直播与画中画 | **合并双方功能。** | 采用上游连续播放、画中画和代理端口；保留本地双屏播放、进度/暂停/速度同步及导航状态。用直播面板、播放器和代理测试验证回归。 |
| D08 PPT、文件预览 | **合并上游 OCR 清理和错误分类，保留本地排序与预览。** | `client/video.rs`、`app/ppt.rs` 使用上游去重与 OCR 处理；`files.tsx`、`preview_modal.tsx` 保留本地交互。额外修复 PPT 图片 401 错误序列化时泄漏签名 URL 的问题。 |
| D09 个人日历 | **保留本地。** | `personal_calendar.rs`、ICS 导入、Canvas DDL 同步和 Agent 日历工具保留；相关读取、写入与账号路径测试继续执行。 |
| D10 本地桌面外壳 | **保留本地并适配新页面。** | `layout.tsx`、`router.tsx`、`main.tsx` 保留首页、学期范围、侧栏定制、主题、托盘与自启；新增页面进入现有路由。反馈入口打开本地日志与反馈窗口。 |
| D11 字幕归档 | **保留本地并接入上游资料能力。** | 32 份原始 JSON、2 份结果文本与 manifest 保留；转写、精校产物使用其独立存储，不修改原始字幕档案。 |
| D12 更新日志 | **采用上游日志展示，保留 fork 更新后端。** | 合并 `change_log_modal.tsx` 格式化与 `change_logs.json`，补回 fork 的 3.0.15–3.0.17 记录；`update_notice.tsx` 仍使用本地 Release 检查、校验和安装入口。upstream 3.0.14 的发行说明与 fork 同号版本不一致，未伪装成已发布的 fork 说明；新整合功能待将来版本发布时另写说明。 |
| D13 发布流程 | **保留本地；忽略上游改成 release 分支触发和多平台发布。** | `release.yml` 保留 `app-v*` Windows 安装包、便携包和校验流程；上游 Linux 依赖修复仅对上游多平台构建适用。此次只运行本地预览，不运行 Release 构建或发布。 |
| D14 依赖与 CI | **逐项合并。** | `package.json` 保留 `ical.js`、`mpegts.js` 并纳入上游依赖升级；`Cargo.toml` 保留本地托盘、自动启动等依赖并加入 `os_info`；重新生成 `yarn.lock`、`Cargo.lock`。保留本地检查脚本并合入上游 Rust 测试工作流。 |
| D15 脚本目录 | **所有脚本统一放入 `script/`，删除 `scripts/`（用户修订）。** | 迁移本地预览、Release、版本同步、Rust 检查及测试脚本，合并安装脚本；修改 `package.json`、README、makefile、Husky 和 CI 调用。原 `scripts/` 已移除，后续新增脚本仅使用 `script/`。Mac 安装脚本下载 upstream 版本，README 明确标注。 |
| D16 文档、模板与资源 | **合并 Issue 模板和贡献记录，保留 fork 文档/下载链接；忽略默认占位图。** | README 和中英文网站说明新增课堂视频能力，同时保留 fork 安装、日历、签到、字幕工作台说明；设置截图采用上游图，仅作为分类设置示意。`public/tauri.svg`、`public/vite.svg` 不恢复。 |

## 冲突处理原则和兼容性

36 处 Git 冲突已按上述功能决策逐处解决：入口/模型文件合并命令与字段，诊断文件采用上游实现并另存本地事件适配器，设置页采用上游分类并补本地字段，更新与发布文件保留 fork 后端和触发方式。自动合并但语义相关的文件也按功能测试核对。既有用户数据不通过手工迁移或清理脚本改写；数据管理操作仍须由用户在应用中触发。

## 验证与交付

- `yarn typecheck`：通过。
- `yarn lint`：通过，0 错误、57 条警告；警告为现有代码中的类型、Hook 依赖和 Fast Refresh 提示，本轮未更改其行为。
- `yarn test`：64 个测试文件、328 项测试全部通过。
- `yarn check:rust`：Clippy 严格检查通过；181 项 Rust 单元测试通过、18 项需要账号、外部服务或明确输入的测试按原设置跳过。
- `node --test script/check-rust.node-test.mjs`：2 项脚本测试通过。
- `git -c core.whitespace=cr-at-eol diff --cached --check`：通过；`git ls-files -u` 为空，冲突全部消除。`git ls-files 'scripts/*'` 为空，脚本目录迁移完成。
- `yarn build:preview:local`：通过，包含 `tsc`、Vite 生产前端打包及 Tauri debug 无安装包构建。预览程序：`H:\Daily_project_vault\SJTU-Canvas-Helper-fancy\local-preview\20261103-181556\SJTU Canvas Helper.exe`（92,997,632 字节，SHA-256 `e1491d4b29fbd7f1d7cc28fb12c0fbe6b40bae05beb7788594909a6dc131d6fa`，与同目录 `SHA256SUMS.txt` 一致）。构建未创建 GitHub Release。

修复过程：首次 Rust 全量测试暴露 PPT 图片 401 错误序列化时泄漏签名 URL，已在 `AppError` 返回前统一脱敏并通过复测。首次前端全量测试暴露新增设置页测试对 MUI 禁用属性断言错误，调整为检查 `aria-disabled` 后全量通过。首次预览编译发现合并后的 Debug 页 JSX 标签拼写错误，已修正并重新通过 TypeScript 检查。

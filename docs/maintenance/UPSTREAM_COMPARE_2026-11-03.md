# upstream 同步比对与实施决策基线（2026-11-03）

> 本文保留合并前的原始差异、建议和 312 条路径清单，供追溯使用。用户已批准逐项实施，并对 D05、D15 提出修订。最终决策、具体改动和测试结果见 [实施记录](UPSTREAM_INTEGRATION_2026-11-03.md)；下文的“待确认”“拟处理”描述只代表当时的基线，不代表当前状态。

## 1. 比对基线与范围

| 项目 | 值 |
| --- | --- |
| 本地工作分支 | `main`，`f2ddf1c`，与 `origin/main` 一致；拉取前工作区干净 |
| upstream | `git@github.com:Okabe-Rintarou-0/SJTU-Canvas-Helper.git` 的 `main`，本次 `git fetch upstream main` 从 `3fb4a1b` 更新至 `ff03ee9` |
| 共同祖先 | `f804dd55477418a7c21eaa5401e2dc59e04ef50c` |
| 分叉提交 | 本地独有 23 个、upstream 独有 40 个（含合并提交） |
| 路径差异 | 本地独有 151、upstream 独有 117、双方修改 44，共 312 个；完整逐路径清单见附录 A |
| 合并预演 | `git merge-tree --write-tree main upstream/main` 报告 36 处冲突；未改动工作树或分支 |
| 版本 | 本地 `3.0.17`；upstream `3.0.14`。本次整合建议保持 `3.0.17`，暂不创建新版本或 Release |

**口径**：附录记录的是“共同祖先 → 本地”和“共同祖先 → upstream”的路径级变更，故本地独有文件在 `git diff main upstream/main` 中显示为删除，并不代表 Git 正常合并会删除它。`M/A/D` 分别表示修改/新增/删除。路径清单不等于每一行代码都已审定；双方修改的源文件必须按下表逐项落实并验证行为。上游提交和功能以本次 fetch 到的 `ff03ee9` 为准。

## 2. 功能、实现与取舍记录（建议，待确认）

| 编号 | 差异与关联路径 | 决策建议 | 具体实施与验收重点 |
| --- | --- | --- | --- |
| D01 | upstream 新增课堂转写、字幕 AI 精校、字幕版本选择及课堂主题：`client/transcription.rs`、`client/subtitle_proofread.rs`、`app/video_artifacts.rs`、视频页和会话模块 | **合入并适配** | 接入现有视频中心与本地字幕归档；保留原始字幕 JSON 和 Agent 整理结果的可访问性；确认转写/精校失败可恢复、账号切换不串资料。 |
| D02 | upstream 重做 Canvas 视频认证（官方流程、Canvas Token 和扫码回退）：`client/video_auth.rs`、`client/video.rs`、`client/canvas_session.rs` | **采用上游核心，合并本地补丁** | 保留本地全课分页拉取、原始字幕字节保存和直播入口；核对 Token 不写日志、回退扫码流程及播放代理。 |
| D03 | upstream 新增应用数据迁移、备份、清理和分课程下载目录：`app/data.rs`、`app/downloads.rs`、`utils/download.rs`、设置及文件页 | **合入并修改兼容层** | 旧下载文件仍可查找；本地字幕归档、个人日历、签到配置和账号目录不能被清理/迁移误删；跨目录迁移须校验失败回滚。 |
| D04 | upstream 设置页拆分为分类组件，增加 Canvas Token 指引、代理端口、主色重置；本地设置页含托盘/开机启动、签到、更新及 Agent 配置 | **采用上游分类结构，移植本地功能** | 在 `src/page/settings.tsx` 等保留本地设置的读写、默认值、未保存状态；避免同一设置出现两个相互覆盖的状态源。 |
| D05 | upstream 新日志脱敏、诊断报告与反馈表单；本地已有日志、启动容错和错误边界：`diagnostics.rs`、`client/debug.rs`、`main.rs`、`log_modal.tsx` | **手工合并** | 统一为一个诊断初始化/导出入口；保留本地日志文件失败时仍可启动的行为，核查 Token、Cookie、个人信息脱敏。upstream 的 `src-tauri/src/diagnostics.rs` 与本地为 add/add 冲突。 |
| D06 | upstream 改进二维码多码/反色扫描和失败提示；本地签到守望使用二维码与额外 Python 资源 | **合入扫描改进，保留签到** | 维持 `attendance.rs`、签到页、Tauri 命令及 Python 打包资源；将上游扫码 UI/后端能力接入现有入口，测试扫码与签到互不干扰。 |
| D07 | upstream 直播跨课次连续播放、画中画、代理端口设置和视频页状态保留；本地有双屏进度/暂停/速度同步 | **合并两侧能力** | 处理 `video_live_player.tsx`、`video_library_player.tsx` 和 `video_sync.ts` 的事件同步，验证关同步后独立播放、页面导航后播放不中断。 |
| D08 | upstream PPT OCR 清理和空教学大纲错误处理；本地文件排序、预览与页面导航修复 | **合入上游，保留本地交互** | 检查 PPT 去重不误删公式/数字页；文件下载、预览和排序状态稳定；空大纲显示可恢复错误。 |
| D09 | 本地独有个人日历、ICS 导入、Canvas DDL 同步、Agent 日历查询/显式写入：`personal_calendar.rs`、`calendar_tools.rs`、日历页 | **保留本地** | 核对 upstream 的账号/缓存/模型变更不破坏日历隔离；Agent 写日程仍须用户明确要求，课程等查询仍只读。 |
| D10 | 本地独有首页、可拖动/隐藏侧边栏、启动主题、系统托盘、开机自启 | **保留本地并适配上游布局** | `layout.tsx`、`router.tsx`、`main.tsx`、`Cargo.toml`、`tauri.conf.json` 手工接线；验证首次启动主题、排序持久化、托盘退出/关闭行为。 |
| D11 | 本地独有字幕归档、Agent 分块处理、捆绑课程数据（`public/subtitle_archive/`） | **保留本地并对接上游转写/精校** | 保留本地 32 份原始 JSON、32 份结果文本和 manifest；划清归档数据、精校版本和下载目录，避免重复存储或覆盖。 |
| D12 | upstream 累积更新日志 JSON、格式化展示和更新成功提示；本地已有 fork Release 下载/安装器及 `v3.0.17` 更新说明 | **合入展示，保留本地更新后端** | 合并 `change_log_modal.tsx`、`update_notice.tsx`，将本地 3.0.15–3.0.17 说明纳入日志；更新提示继续使用 fork Release 检查与校验安装，不直接切回 upstream Tauri updater。 |
| D13 | upstream `release.yml` 改为 release 分支触发的多平台发布，并修复 Linux 依赖安装；本地为 `app-v*` 标签的 Windows 安装包/便携版/校验和与失败容错 | **保留本地发布流程；评估增补平台矩阵** | 本轮仅整合与本地流程相容的 CI 修复。upstream Linux 依赖修复仅在新增 Linux 构建时采用；不改变触发条件、资产命名和 fork 更新地址。 |
| D14 | upstream 刷新前端/Rust 依赖、Rust PR 测试和跨平台测试；本地依赖有 `ical.js`、`mpegts.js`、托盘/semver/sha2 等 | **逐项合并依赖并重算锁文件** | 保留本地功能依赖，纳入 upstream 新依赖如 `os_info`；审查上游升级的兼容性。`Cargo.lock`、`yarn.lock` 由最终清单重新生成/校验，不能整份选择一侧。 |
| D15 | upstream 在 `script/` 更新安装脚本；本地已迁到 `scripts/` 并新增本地预览/发布脚本 | **保留 `scripts/` 路径，移植有效脚本改动** | 保持 `yarn app:dev`、`yarn build:preview:local` 和对应文档；所有 CI、README、package 调用统一到 `scripts/`。旧 `script/install.bat` 冲突按迁移处理。 |
| D16 | upstream 简化 Issue 模板、更新 README/网站截图和贡献者信息；本地 README、网站含 fork 功能/安装信息 | **合并文档，忽略默认占位素材** | 新 Issue 模板和维护署名可纳入；README/网站保留 fork 下载链接、安装说明及本地功能，再加入上游新功能。`public/tauri.svg`、`public/vite.svg` 是默认占位素材，建议不恢复；设置截图应按最终 UI 检查。 |

## 3. 冲突清单与处理责任

`git merge-tree` 报告的 36 处冲突属于四组。逐文件状态见附录 A 的“冲突”列。

1. **发布、文档、版本和脚本（6）**：`.github/workflows/release.yml`、`README.md`、`package.json`、`script/install.bat`、`scripts/install_mac.sh`、`src-tauri/Cargo.lock`。按 D12–D16 合成；锁文件随依赖重新核对。
2. **Rust 配置、应用入口、认证和诊断（13）**：`src-tauri/Cargo.toml`、`src-tauri/src/app/basic.rs`、`app/mod.rs`、`client/ai.rs`、`client/basic.rs`、`client/common.rs`、`client/debug.rs`、`client/jbox.rs`、`client/video.rs`、`diagnostics.rs`、`error/mod.rs`、`main.rs`、`tauri.conf.json`。以保留本地日历/签到/托盘/字幕命令为前提接入上游新命令及日志系统。
3. **前端组件、状态与页面（15）**：`change_log_modal.tsx`、`course_select.tsx`、`ipynb_renderer.tsx`、`layout.tsx`、`video_aggregator.tsx`、`video_library_player.tsx`、`hooks.tsx`、`model.ts`、`update_notice.tsx`、`utils.tsx`、`main.tsx`、`assignments.tsx`、`qrcode.tsx`、`settings.tsx`、`users.tsx`。逐功能回归，不按文件整份覆盖。
4. **网站（2）**：`website/en.html`、`website/index.html`。保留 fork 下载与版本表述后更新上游文案。

另外 9 个双方修改路径未报直接冲突：`script/install_mac.sh`、`src-tauri/src/app/video.rs`、`src-tauri/src/model/mod.rs`、`src/components/__tests__/agent_navigation.test.tsx`、`src/components/router.tsx`、`src/lib/ai_sessions.test.tsx`、`src/page/agent.tsx`、`src/page/files.tsx`、`yarn.lock`。其中旧路径安装脚本由 Git 识别为重命名冲突，锁文件仍须重算；其余路径也需人工检查语义和命令参数。自动合并成功不代表接口或功能兼容。

## 4. 详细实施计划（确认后执行）

1. **固定基线**：再次 `git fetch upstream main` 并核对目标是否仍为 `ff03ee9`；如 upstream 已前进，先更新本记录。建立独立整合分支/快照，保持当前 `main` 和现有发布版本可回退。
2. **形成三方合并工作树**：合并 upstream；按 D01–D16 逐项处理 36 处冲突，先 Rust 依赖/入口与数据模型，再前端状态/路由/设置，最后发布脚本与文档。每处冲突记录最终采用的代码片段或行为、原因和关联测试。
3. **数据兼容与安全核查**：用隔离账户/配置目录检查旧下载、字幕归档、个人日历和设置迁移；核对删除/清理范围、账号隔离、Token/Cookie 脱敏和更新下载地址。不使用真实凭据做破坏性测试。
4. **相关检查**：运行 `yarn install --frozen-lockfile`（锁文件需更新时先重算）、`yarn typecheck`、`yarn lint`、`yarn test`、`yarn check:rust`，并针对日历、签到、字幕、视频、下载、设置、发布脚本运行对应测试。根据结果修复真实回归，再复测受影响范围。
5. **本地预览**：按 `AGENTS.md` 运行 `yarn build:preview:local`，确认生成的可执行文件能启动并报告其完整路径；不发布 GitHub Release，不自动更新版本号。`yarn app:dev` 可用于需要交互核验的阶段。
6. **完成记录**：将 D01–D16 从“建议”更新为“已执行/调整/未采用”，附实际提交、测试结果、剩余限制和可执行文件路径，供最终复核。

## 5. 当前未执行事项

本次仅更新了 upstream 远端跟踪引用并生成分析文档。**尚未合并、修改应用代码、安装依赖、运行测试或构建**。以下附录的“拟处理”是路径级默认建议；表 2 的具体决策优先于默认建议。

## 附录 A：完整逐路径差异与拟处理

| 路径 | 本地 | upstream | 预演冲突 | 拟处理 |
| --- | :---: | :---: | :---: | --- |
| `.all-contributorsrc` | — | M | — | 合入上游变更 |
| `.codespellrc` | M | — | — | 保留本地变更 |
| `.github/ISSUE_TEMPLATE/01-bug.yml` | — | A | — | 合入上游变更 |
| `.github/ISSUE_TEMPLATE/02-feature.yml` | — | A | — | 合入上游变更 |
| `.github/ISSUE_TEMPLATE/config.yml` | — | A | — | 合入上游变更 |
| `.github/workflows/frontend_lint.yml` | M | — | — | 保留本地变更 |
| `.github/workflows/release.yml` | M | M | 是 | 保留本地发布流程，选择性吸收上游修复（D13） |
| `.github/workflows/rust_lint.yml` | M | — | — | 保留本地变更 |
| `.github/workflows/rust_tests.yml` | — | M | — | 合入上游变更 |
| `.github/workflows/windows-portable/build-ci.mjs` | A | — | — | 保留本地变更 |
| `.gitignore` | M | — | — | 保留本地变更 |
| `.husky/pre-commit` | M | — | — | 保留本地变更 |
| `AGENTS.md` | A | — | — | 保留本地变更 |
| `CONTRIBUTING.md` | — | M | — | 合入上游变更 |
| `docs/agent-tools.md` | A | — | — | 保留本地变更 |
| `docs/local-preview.md` | A | — | — | 保留本地变更 |
| `docs/maintenance/FUNCTION_AUDIT_2026-10-21.md` | A | — | — | 保留本地变更 |
| `docs/maintenance/RELEASE_3.0.14.md` | A | — | — | 保留本地变更 |
| `docs/maintenance/RELEASE_3.0.15.md` | A | — | — | 保留本地变更 |
| `docs/maintenance/RELEASE_3.0.17.md` | A | — | — | 保留本地变更 |
| `docs/maintenance/UPSTREAM_MERGE_2026-10-21.md` | A | — | — | 保留本地变更 |
| `images/settings.png` | — | M | — | 最终设置 UI 核对后更新截图（D16） |
| `index.html` | M | — | — | 保留本地变更 |
| `makefile` | M | — | — | 保留本地变更 |
| `package.json` | M | M | 是 | 保留本地脚本/依赖，合入上游更新（D14–15） |
| `public/favicon.png` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse10.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse3.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse4.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse5.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse6.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse7.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse8.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/cse9.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/economic_6_2_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/economic_6_2_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/economic_6_2_3.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/ics_5_18_class2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web_5_12_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web_5_14_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web_6_16_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web_6_16_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_1_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_1_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_2_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_2_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_3_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_3_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_4_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_4_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_5_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_5_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_6_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_6_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_7_1.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/json_data/web2_7_2.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/manifest.json` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse10_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse3_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse4_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse5_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse6_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse7_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse8_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/cse9_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/economic_6_2_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/economic_6_2_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/economic_6_2_3_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/ics_5_18_class2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web_5_12_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web_5_14_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web_6_16_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web_6_16_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_1_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_1_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_2_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_2_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_3_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_3_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_4_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_4_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_5_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_5_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_6_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_6_2_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_7_1_result.txt` | A | — | — | 保留本地变更 |
| `public/subtitle_archive/results/web2_7_2_result.txt` | A | — | — | 保留本地变更 |
| `public/tauri.svg` | D | — | — | 保留本地变更 |
| `public/vite.svg` | D | — | — | 保留本地变更 |
| `python/attendance/nn.py` | A | — | — | 保留本地变更 |
| `python/attendance/README.md` | A | — | — | 保留本地变更 |
| `python/attendance/requirements.txt` | A | — | — | 保留本地变更 |
| `python/attendance/surveil.py` | A | — | — | 保留本地变更 |
| `python/json_transfer/app.py` | A | — | — | 保留本地变更 |
| `python/json_transfer/fetch_course.py` | A | — | — | 保留本地变更 |
| `python/json_transfer/README.md` | A | — | — | 保留本地变更 |
| `python/json_transfer/requirements.txt` | A | — | — | 保留本地变更 |
| `python/json_transfer/transfer.py` | A | — | — | 保留本地变更 |
| `python/json_transfer/web/app.css` | A | — | — | 保留本地变更 |
| `python/json_transfer/web/app.js` | A | — | — | 保留本地变更 |
| `python/json_transfer/web/index.html` | A | — | — | 保留本地变更 |
| `README.md` | M | M | 是 | 合并双方功能与下载说明（D16） |
| `script/bump_version.py` | D | — | — | 保留本地变更 |
| `script/check-rust.mjs` | D | — | — | 保留本地变更 |
| `script/check-rust.node-test.mjs` | D | — | — | 保留本地变更 |
| `script/install_mac.sh` | D | M | — | 维持删除，改动移植到 scripts/（D15） |
| `script/install.bat` | D | M | 是 | 维持删除，改动移植到 scripts/（D15） |
| `scripts/build-local-preview.ps1` | A | — | — | 保留本地变更 |
| `scripts/build-local-release.ps1` | A | — | — | 保留本地变更 |
| `scripts/bump_version.py` | A | — | — | 保留本地变更 |
| `scripts/check-rust.mjs` | A | — | — | 保留本地变更 |
| `scripts/check-rust.node-test.mjs` | A | — | — | 保留本地变更 |
| `scripts/install_mac.sh` | A | — | 是 | 保留本地路径，移植上游改动（D15） |
| `scripts/install.bat` | A | — | — | 保留本地变更 |
| `src-tauri/Cargo.lock` | M | M | 是 | 随最终 Cargo.toml 重算并核对（D14） |
| `src-tauri/Cargo.toml` | M | M | 是 | 合入上游依赖，保留本地托盘等依赖与版本（D10/14） |
| `src-tauri/gen/schemas/acl-manifests.json` | M | — | — | 保留本地变更 |
| `src-tauri/gen/schemas/desktop-schema.json` | M | — | — | 保留本地变更 |
| `src-tauri/gen/schemas/windows-schema.json` | M | — | — | 保留本地变更 |
| `src-tauri/src/app/attendance.rs` | A | — | — | 保留本地变更 |
| `src-tauri/src/app/basic.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/app/data.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/app/downloads.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/app/mod.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/app/ppt_audit.rs` | — | M | — | 合入上游变更 |
| `src-tauri/src/app/ppt.rs` | — | M | — | 合入上游变更 |
| `src-tauri/src/app/qrcode.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/app/video_artifacts.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/app/video_library.rs` | — | M | — | 合入上游变更 |
| `src-tauri/src/app/video.rs` | M | M | — | 自动合并后核对语义 |
| `src-tauri/src/canvas_agent/calendar_tools.rs` | A | — | — | 保留本地变更 |
| `src-tauri/src/canvas_agent/mod.rs` | M | — | — | 保留本地变更 |
| `src-tauri/src/client/ai.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/client/basic.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/client/canvas_session.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/client/common.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/client/debug.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/client/fixtures/ppt_animation_sequence.json` | — | D | — | 核对测试替代后接受上游删除（D08） |
| `src-tauri/src/client/jbox.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/client/mod.rs` | — | M | — | 合入上游变更 |
| `src-tauri/src/client/subtitle_proofread.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/client/transcription.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/client/video_auth.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/client/video_library.rs` | — | M | — | 合入上游变更 |
| `src-tauri/src/client/video.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/diagnostics.rs` | A | A | 是 | 合并双方日志与脱敏实现（D05） |
| `src-tauri/src/error/mod.rs` | M | M | 是 | 手工合并双方改动 |
| `src-tauri/src/main.rs` | M | M | 是 | 手工接线双方 Tauri 命令（D01–12） |
| `src-tauri/src/model/mod.rs` | M | M | — | 自动合并后核对语义 |
| `src-tauri/src/model/subtitle_proofread_prompts.json` | — | A | — | 合入上游变更 |
| `src-tauri/src/model/subtitle_proofread.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/personal_calendar.rs` | A | — | — | 保留本地变更 |
| `src-tauri/src/release_update.rs` | A | — | — | 保留本地变更 |
| `src-tauri/src/subtitle_archive.rs` | A | — | — | 保留本地变更 |
| `src-tauri/src/utils/download.rs` | — | A | — | 合入上游变更 |
| `src-tauri/src/utils/file.rs` | — | M | — | 合入上游变更 |
| `src-tauri/src/utils/json.rs` | — | M | — | 合入上游变更 |
| `src-tauri/src/utils/mod.rs` | — | M | — | 合入上游变更 |
| `src-tauri/src/utils/qrcode.rs` | — | A | — | 合入上游变更 |
| `src-tauri/tauri.conf.json` | M | M | 是 | 保留本地资源/配置与版本，合入上游必要配置（D10/14） |
| `src-tauri/tauri.local.conf.json` | A | — | — | 保留本地变更 |
| `src/App.tsx` | M | — | — | 保留本地变更 |
| `src/components/__tests__/agent_navigation.test.tsx` | M | M | — | 自动合并后核对语义 |
| `src/components/__tests__/app_data_settings.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/archive_renderer.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/code_renderer.test.tsx` | M | — | — | 保留本地变更 |
| `src/components/__tests__/course_select.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/debug_diagnostics.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/downloaded_files_settings.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/error_boundary.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/file_ai_navigation.test.tsx` | — | M | — | 合入上游变更 |
| `src/components/__tests__/layout_drag.test.tsx` | A | — | — | 保留本地变更 |
| `src/components/__tests__/layout_feedback.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/log_modal.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/markdown_renderer.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/preview_modal.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/primary_color_field.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/qrcode_page.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/retained_video_workspace.test.tsx` | M | — | — | 保留本地变更 |
| `src/components/__tests__/settings_page.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/syllabus_page.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/video_library_page.test.tsx` | — | M | — | 合入上游变更 |
| `src/components/__tests__/video_library_player.test.tsx` | — | M | — | 合入上游变更 |
| `src/components/__tests__/video_live_panel.test.tsx` | — | M | — | 合入上游变更 |
| `src/components/__tests__/video_live_player.test.tsx` | — | M | — | 合入上游变更 |
| `src/components/__tests__/video_summary_sources.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/__tests__/workspace_select.test.tsx` | — | A | — | 合入上游变更 |
| `src/components/app_data_settings.tsx` | — | A | — | 合入上游变更 |
| `src/components/archive_renderer.tsx` | — | M | — | 合入上游变更 |
| `src/components/canvas_token_guide.tsx` | — | A | — | 合入上游变更 |
| `src/components/change_log_modal.tsx` | M | M | 是 | 上游 JSON/格式化 + 本地版本记录（D12） |
| `src/components/change_log_text.tsx` | — | A | — | 合入上游变更 |
| `src/components/course_select.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/components/diagnostic_error_boundary.tsx` | A | — | — | 保留本地变更 |
| `src/components/downloaded_files_settings.tsx` | — | A | — | 合入上游变更 |
| `src/components/error_boundary.tsx` | — | A | — | 合入上游变更 |
| `src/components/ipynb_renderer.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/components/layout.tsx` | M | M | 是 | 上游状态修复 + 本地首页/侧栏/工作区（D07/10） |
| `src/components/log_modal.tsx` | — | M | — | 合入上游变更 |
| `src/components/login_alert.tsx` | — | M | — | 合入上游变更 |
| `src/components/markdown_renderer.tsx` | — | M | — | 合入上游变更 |
| `src/components/playback_proxy_alert.tsx` | — | A | — | 合入上游变更 |
| `src/components/playback_proxy_settings_link.tsx` | — | A | — | 合入上游变更 |
| `src/components/preview_modal.tsx` | — | M | — | 合入上游变更 |
| `src/components/primary_color_field.tsx` | — | A | — | 合入上游变更 |
| `src/components/router.tsx` | M | M | — | 自动合并后核对语义 |
| `src/components/settings_shell.tsx` | — | A | — | 合入上游变更 |
| `src/components/subtitle_agent_dialog.tsx` | A | — | — | 保留本地变更 |
| `src/components/video_aggregator.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/components/video_library_player.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/components/video_library_tasks.tsx` | — | M | — | 合入上游变更 |
| `src/components/video_live_panel.tsx` | — | M | — | 合入上游变更 |
| `src/components/video_live_player.tsx` | — | M | — | 合入上游变更 |
| `src/components/video_summary_scope.tsx` | — | A | — | 合入上游变更 |
| `src/components/video_summary_settings.tsx` | — | M | — | 合入上游变更 |
| `src/components/video_summary_sources.tsx` | — | A | — | 合入上游变更 |
| `src/components/video_track_downloads.tsx` | — | M | — | 合入上游变更 |
| `src/lib/__tests__/calendar_filter.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/__tests__/canvas_calendar_cache.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/__tests__/logger.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/__tests__/personal_calendar.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/__tests__/sidebar_order.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/__tests__/term.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/__tests__/video_sync.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/ai_sessions.test.tsx` | M | M | — | 自动合并后核对语义 |
| `src/lib/app_data.test.ts` | — | A | — | 合入上游变更 |
| `src/lib/app_data.ts` | — | A | — | 合入上游变更 |
| `src/lib/calendar_filter.ts` | A | — | — | 保留本地变更 |
| `src/lib/canvas_agent_session.ts` | M | — | — | 保留本地变更 |
| `src/lib/canvas_calendar_cache.ts` | A | — | — | 保留本地变更 |
| `src/lib/change_logs.json` | — | A | — | 合入上游变更 |
| `src/lib/course_syllabus.ts` | — | A | — | 合入上游变更 |
| `src/lib/diagnostics.test.ts` | — | A | — | 合入上游变更 |
| `src/lib/diagnostics.ts` | — | A | — | 合入上游变更 |
| `src/lib/download_context.ts` | — | A | — | 合入上游变更 |
| `src/lib/downloads.test.ts` | — | A | — | 合入上游变更 |
| `src/lib/downloads.ts` | — | A | — | 合入上游变更 |
| `src/lib/events.ts` | M | — | — | 保留本地变更 |
| `src/lib/hooks.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/lib/logger.ts` | A | — | — | 保留本地变更 |
| `src/lib/message.tsx` | M | — | — | 保留本地变更 |
| `src/lib/model.ts` | M | M | 是 | 手工合并双方改动 |
| `src/lib/pdf_tasks.test.ts` | — | M | — | 合入上游变更 |
| `src/lib/pdf_tasks.ts` | — | M | — | 合入上游变更 |
| `src/lib/personal_calendar.ts` | A | — | — | 保留本地变更 |
| `src/lib/playback_proxy.ts` | — | A | — | 合入上游变更 |
| `src/lib/release_update.ts` | A | — | — | 保留本地变更 |
| `src/lib/run_limited.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/run_limited.ts` | A | — | — | 保留本地变更 |
| `src/lib/sidebar_order.ts` | A | — | — | 保留本地变更 |
| `src/lib/store.ts` | M | — | — | 保留本地变更 |
| `src/lib/subtitle_agent_progress.ts` | A | — | — | 保留本地变更 |
| `src/lib/subtitle_agent_targets.test.ts` | A | — | — | 保留本地变更 |
| `src/lib/subtitle_agent_targets.ts` | A | — | — | 保留本地变更 |
| `src/lib/subtitle_format.test.ts` | — | A | — | 合入上游变更 |
| `src/lib/subtitle_format.ts` | — | A | — | 合入上游变更 |
| `src/lib/task_manager.test.ts` | — | M | — | 合入上游变更 |
| `src/lib/task_manager.ts` | — | M | — | 合入上游变更 |
| `src/lib/term.ts` | A | — | — | 保留本地变更 |
| `src/lib/update_changelog.test.ts` | — | A | — | 合入上游变更 |
| `src/lib/update_changelog.ts` | — | A | — | 合入上游变更 |
| `src/lib/update_notice.test.tsx` | — | A | — | 合入上游变更 |
| `src/lib/update_notice.tsx` | M | M | 是 | 上游累计日志展示 + 本地更新后端（D12） |
| `src/lib/upload_tasks.test.ts` | — | M | — | 合入上游变更 |
| `src/lib/upload_tasks.ts` | — | M | — | 合入上游变更 |
| `src/lib/utils.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/lib/video_library_tasks.test.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_library_tasks.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_library.test.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_library.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_live.test.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_live.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_picture_in_picture.test.ts` | — | A | — | 合入上游变更 |
| `src/lib/video_picture_in_picture.ts` | — | A | — | 合入上游变更 |
| `src/lib/video_summary_cache.test.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_summary_cache.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_summary_preflight.test.ts` | — | A | — | 合入上游变更 |
| `src/lib/video_summary_preflight.ts` | — | A | — | 合入上游变更 |
| `src/lib/video_summary_prompt.ts` | — | A | — | 合入上游变更 |
| `src/lib/video_summary_session.ts` | — | M | — | 合入上游变更 |
| `src/lib/video_summary_sources.ts` | — | A | — | 合入上游变更 |
| `src/lib/video_sync.ts` | A | — | — | 保留本地变更 |
| `src/lib/video_topics.test.ts` | — | A | — | 合入上游变更 |
| `src/lib/video_topics.ts` | — | A | — | 合入上游变更 |
| `src/main.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/page/agent.tsx` | M | M | — | 自动合并后核对语义 |
| `src/page/annual.tsx` | — | M | — | 合入上游变更 |
| `src/page/assignments.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/page/attendance.tsx` | A | — | — | 保留本地变更 |
| `src/page/calendar.tsx` | M | — | — | 保留本地变更 |
| `src/page/debug.tsx` | — | M | — | 合入上游变更 |
| `src/page/discussions.tsx` | — | M | — | 合入上游变更 |
| `src/page/files.tsx` | M | M | — | 自动合并后核对语义 |
| `src/page/grades.tsx` | — | M | — | 合入上游变更 |
| `src/page/home.tsx` | A | — | — | 保留本地变更 |
| `src/page/qrcode.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/page/settings.tsx` | M | M | 是 | 上游分类结构 + 本地设置项（D04） |
| `src/page/submissions.tsx` | — | M | — | 合入上游变更 |
| `src/page/subtitle_archive.tsx` | A | — | — | 保留本地变更 |
| `src/page/syllabus.tsx` | — | M | — | 合入上游变更 |
| `src/page/users.tsx` | M | M | 是 | 手工合并双方改动 |
| `src/page/video.tsx` | — | M | — | 合入上游变更 |
| `src/test/app_data_mock.ts` | — | A | — | 合入上游变更 |
| `src/test/startup_theme.test.tsx` | A | — | — | 保留本地变更 |
| `vitest.config.ts` | — | M | — | 合入上游变更 |
| `website/en.html` | M | M | 是 | 手工合并双方改动 |
| `website/index.html` | M | M | 是 | 手工合并双方改动 |
| `yarn.lock` | M | M | — | 随最终 package.json 重算并核对（D14） |

## 附录 B：分叉后提交清单

提交列表含合并提交；功能决策仍以第 2 节和附录 A 的实际文件差异为准。

### upstream 独有提交（40）

| 提交 | 日期 | 说明 |
| --- | --- | --- |
| `ff03ee9` | 2026-11-01 | fix: restore Linux release dependency installation |
| `a3beb14` | 2026-11-01 | chore: bump version |
| `7718705` | 2026-10-31 | fix: stabilize CI tests across platforms |
| `a6f9f0b` | 2026-10-31 | refactor: rebuild Canvas video authentication from official flow |
| `d9c7f9f` | 2026-10-31 | feat: add classroom transcription and subtitle proofreading |
| `e60484b` | 2026-10-31 | feat: unify application data and download management |
| `b79620e` | 2026-10-31 | feat: show formatted cumulative release notes after updates |
| `f551577` | 2026-10-29 | feat: show cumulative release notes in update prompt |
| `375384b` | 2026-10-29 | fix: preserve interaction state during background updates |
| `7b324d4` | 2026-10-28 | feat: authenticate classroom videos with Canvas tokens |
| `00fd184` | 2026-10-28 | fix: remove duplicate latest changelog highlight |
| `0cb7a99` | 2026-10-28 | fix: make playback proxy ports configurable and improve feedback |
| `25fb240` | 2026-10-28 | fix: smooth primary color selection and add default reset |
| `3fb4a1b` | 2026-10-27 | chore: update process dependency (#121) |
| `0e26a5b` | 2026-10-27 | chore: refresh frontend dependencies (#143) |
| `b1d1f0e` | 2026-10-27 | chore: update shell dependency (#118) |
| `7dd4ab7` | 2026-10-27 | chore: refresh frontend dependency baseline |
| `e6b3760` | 2026-10-27 | ci: enable pull request Rust tests |
| `64ae980` | 2026-10-27 | ci: enable pull request Rust tests |
| `55d0fc8` | 2026-10-27 | ci: run Rust tests on pull requests |
| `99a2abe` | 2026-10-27 | docs: add maintenance credit (#136) |
| `7b0508b` | 2026-10-27 | chore: refresh reviewed frontend dependencies |
| `4822538` | 2026-10-27 | chore: refresh process dependency against main |
| `f0eef96` | 2026-10-27 | chore: refresh shell dependency against main |
| `64fc446` | 2026-10-27 | docs: refresh maintenance credit against main |
| `e0c4da9` | 2026-10-27 | fix: avoid codespell false positive in Unicode regex |
| `d2af528` | 2026-10-26 | fix: improve OCR-based PPT cleanup |
| `b11982a` | 2026-10-26 | fix: handle empty syllabuses and show recoverable errors |
| `f5fae5a` | 2026-10-26 | fix: improve course QR scanning and management |
| `017c227` | 2026-10-26 | feat: streamline settings and guide Canvas token setup |
| `58c96ea` | 2026-10-26 | feat: continue classroom live playback across lessons |
| `a46f76b` | 2026-10-25 | feat: simplify issue forms and include system versions |
| `ff665a1` | 2026-10-25 | test: wait for course sync before checking video navigation |
| `f75f6fb` | 2026-10-25 | feat: add redacted diagnostic logs and report export |
| `c676d92` | 2026-10-25 | feat: add simple issue reporting forms |
| `d877935` | 2026-10-14 | Merge branch 'main' into all-contributors/add-yingyx |
| `50bf001` | 2026-09-28 | docs: update .all-contributorsrc [skip ci] |
| `4d2685c` | 2026-09-28 | docs: update README.md [skip ci] |
| `8cd4336` | 2026-01-02 | chore(deps): bump tauri-plugin-process from 2.3.0 to 2.3.1 in /src-tauri |
| `8227f0b` | 2026-01-02 | chore(deps): bump tauri-plugin-shell from 2.3.0 to 2.3.3 in /src-tauri |

### 本地独有提交（23）

| 提交 | 日期 | 说明 |
| --- | --- | --- |
| `f2ddf1c` | 2026-10-27 | Release v3.0.17 with local calendar and agent improvements |
| `a315e3d` | 2026-10-22 | Prefer built-in GitHub token for release publishing |
| `41c4aa2` | 2026-10-22 | Keep release builds available when GitHub token cannot publish |
| `c190e42` | 2026-10-22 | Keep release asset names compatible with updater |
| `b7d623e` | 2026-10-22 | Fix CI and add fork release updates |
| `abb3db3` | 2026-10-22 | Fix direct sidebar reordering and release v3.0.15 |
| `f5224b6` | 2026-10-22 | Prepare v3.0.14 release and organize project artifacts |
| `0c3b150` | 2026-10-21 | Fix startup theme and calendar filters, sync dual-screen playback |
| `c7c9072` | 2026-10-21 | Keep versioned local release executable when app is running |
| `ceaee5c` | 2026-10-21 | Integrate local subtitle archive with upstream v3.0.13 |
| `2271273` | 2026-10-21 | Merge remote-tracking branch 'upstream/main' |
| `ce7b209` | 2026-09-21 | 合并 upstream 视频回放功能 |
| `d5d16a2` | 2026-09-21 | Merge remote-tracking branch 'upstream/main' |
| `5fc68a4` | 2026-09-21 | 合并直播分支 |
| `ff0e81d` | 2026-09-20 | Merge remote-tracking branch 'origin/feat/live' |
| `00ebd6d` | 2026-09-20 | feat: add classroom live stream panel to video page |
| `ce8e018` | 2026-09-20 | feat: add Canvas classroom live stream info and mss2 proxy route |
| `9fbd970` | 2026-09-20 | 最小化和开机自启 |
| `29a78db` | 2026-09-18 | file filter，schedule repair，first release |
| `edd9e72` | 2026-09-17 | sidebar |
| `10a026b` | 2026-09-17 | log fix2 |
| `21ec20e` | 2026-09-17 | log update |
| `c6c4923` | 2026-09-17 | login fix and auto check-in |

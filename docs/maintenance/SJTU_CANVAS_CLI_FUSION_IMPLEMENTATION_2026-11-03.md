# sjtu-canvas-cli 融合实施记录

对照决策见 [融合计划](SJTU_CANVAS_CLI_FUSION_PLAN_2026-11-03.md)。本文件记录本轮代码实现与偏离原因，不发布 Release、不改版本号。

| 项 | 本轮结果 | 位置与说明 |
| --- | --- | --- |
| C01 机器可读接口 | 已实现 | `script/canvas-cli.mjs` 通过桌面应用 MCP 提供只读 `health/tools/call`；stdout 单行 JSON，stderr 单行 JSON。MCP 内部错误附 `AppError.code` 并先脱敏。继续保留 D05 本地错误日志。 |
| C02 课程资源视图 | 已实现首版 | MCP `course_snapshot` 以当前账号课程 ID 校验，返回有限条数的作业/文件元数据、总数、偏移、生成时间和局部错误；不返回签名文件 URL。生成时间不冒充上游抓取时间。没有复制 Go VFS 或软链接。 |
| C03 分层缓存 | 内存层与加密磁盘层已实现 | 课程 24 小时内存缓存；作业/文件安全投影分别以 5 分钟/1 小时保存到 `metadata-cache-v1/`，AES-GCM 密钥由系统凭据库中的 Canvas Token 派生。完整 File/Assignment、签名 URL、签到/直播/媒体 URL 不持久化。键包含账号、Canvas 实例及 Token 摘要；切号、凭据变更和相关写操作使缓存失效。 |
| C04 签到状态/历史 | 已实现受控读取 | `surveil.py --attendance-read` 只调用状态或本人记录 API；检测业务层 `10001` 后重建会话并最多重试一次。Tauri 命令与签到守望页面提供状态/分页读取，原提交路径不变；读操作只需 Python `requests` 和现有额外扫码登录态。接口仍需受控真实账号验证。 |
| C05 分域健康 | 已实现手动检查 | Canvas、jAccount、视频、mLearning 四域显示正常/失效/未知；暂时网络故障不标成认证失效；只有状态变迁才发 Tauri 事件。未引入常驻 daemon、系统定时探测或外部命令通知。 |
| C06 凭据存储 | 已实施并通过 Windows 验证 | 见 [凭据迁移设计与实施说明](CREDENTIAL_STORE_MIGRATION_DESIGN_2026-11-03.md)。按账号懒迁移旧配置，系统凭据库读回校验后原子替换磁盘文件；设置页预览去秘密字段，缺失条目可重试或明确清除引用后重新登录。跨设备恢复需重新登录。macOS/Linux 实机行为仍待对应平台验证。 |
| C07 视频能力 | 保留本地实现 | 继续使用现有 Range 下载、代理、字幕与 AI 工作台；安全课程摘要排除签名 URL。 |
| C08 TUI/daemon | 暂不接入 | JSON CLI 已可脚本组合；桌面 UI 和 MCP 覆盖交互与 AI 调用。若出现持续终端交互需求再评估 TUI，复用同一数据接口而非增加第二套登录栈。 |
| 项目知识 skill/教程 | 已实现 | `skills/sjtu-canvas-helper/SKILL.md` 及两份按需读取的参考文档；侧栏“使用教程”新页面说明桌面、AI/CLI、技术结构和 TUI 决策。所有可执行脚本仍只在 `script/`。 |

## 验证记录

Rust 快速检查脚本复用 Cargo 默认 `src-tauri/target`：`yarn check:rust:fast` 只做 `cargo check --tests`；`yarn test:rust:focused <filter>` 只执行匹配测试。首轮仍要编译测试二进制，过滤器不会省去首次编译。

| 检查 | 结果 |
| --- | --- |
| `yarn typecheck` | 通过 |
| `yarn lint` | 0 错误，57 条警告；现有 lint 基线仍不干净 |
| `yarn test` | 64 个测试文件、330 项通过 |
| `yarn test:cli` | 3 项通过；独立 Node 测试文件采用 `.node-test.mjs`，避免被 Vitest 误收集 |
| `python -m py_compile surveil.py`、`python -m unittest test_surveil_read.py` | 通过，3 项 Mock 测试覆盖只读、单次重试和非法参数 |
| skill-creator `quick_validate.py` | 通过 |
| `yarn check:rust:fast` | 通过 |
| `yarn check:rust` | Clippy 与全量 Rust 测试通过：190 通过，19 项需真实账号/环境的测试按标记跳过 |
| Windows 凭据库实机测试 | 使用临时虚构凭据验证写入、读回、缺失条目及清理，1 项通过；未访问真实账号凭据 |
| `rustfmt --edition 2021 --check` | 新增 `credentials.rs`、`cache.rs`、`snapshot.rs` 通过；仓库已有大量全局格式差异，本轮未批量改写无关 Rust 文件 |
| `git diff --check` | 通过；仅提示两处既有 CRLF 换行转换 |
| `yarn build:preview:local` | 通过；预览程序：`H:\Daily_project_vault\SJTU-Canvas-Helper-fancy\local-preview\20261103-224834\SJTU Canvas Helper.exe`。随附签到 Python 文件及程序与 `SHA256SUMS.txt` 逐项核对通过；未发布 Release。 |

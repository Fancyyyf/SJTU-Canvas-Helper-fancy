# sjtu-canvas-cli 功能与实现对照及融合计划

记录日期：2026-11-03。对照基线：本仓库 `a5d28fe`，参考仓库 [`404MaximWang/sjtu-canvas-cli` 的 `398ec346`](https://github.com/404MaximWang/sjtu-canvas-cli/tree/398ec3468a28fad71cb83facf0ce5772445c2a56)。这是独立的 Go CLI 项目，不是本仓库的 Git upstream；以下均为设计借鉴或定向移植计划，不执行整仓合并。

本轮实施进度与调整见[实施记录](SJTU_CANVAS_CLI_FUSION_IMPLEMENTATION_2026-11-03.md)。

## 当前项目定位

本地是 React/Tauri 桌面应用，已具备课程/作业/文件/日历/讨论、视频播放下载及字幕工作台、AI 能力、签到守望、MCP Server、本地诊断日志等。参考项目是可供脚本或 UI 后端调用的 Go CLI，提供 VFS、签到读写、分层元数据缓存、凭据存储和可选 daemon。参考项目 README 明确只适配 macOS 与 systemd GNU/Linux，不能直接作为本地 Windows 桌面能力依赖。

本地此前 D05 决策是规范化错误接口并保留用户可查看的本地错误日志；D15 决策是脚本只存放在 `script/`，旧 `scripts/` 已删除。融合必须延续这两项已实施决策。

## 逐项对照与决策

| 编号 | 参考实现 | 本地现状 | 决策 | 具体融合方式 |
| --- | --- | --- | --- | --- |
| C01 | `stdout` 单行 JSON、`stderr` 结构化错误、固定退出码；适合脚本组合。[契约](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/internal/cli/docs/cli.md) | 已有 Tauri/MCP 接口、`AppError` 错误码与本地诊断日志。 | **部分采用** | 先为新增的 MCP/内部服务响应定义稳定字段、错误类型、分页与超时；若以后开发独立 CLI，再采用 stdout/stderr/退出码约定。保留 D05 本地日志查看入口。 |
| C02 | `/courses/...` VFS 集中呈现课程、作业、公告、讨论、文件、签到、直播、回放/字幕/PPT。[契约](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/internal/cli/docs/cli.md) | 页面功能更丰富，MCP 已有课程、作业、文件等工具；全局学期筛选已实现。 | **取数据组织思想，不照搬 VFS** | 用现有 Rust 数据模型实现只读课程快照/资源索引，明确课程 ID、来源、更新时间和分页；按权限只开放必要字段，不增加 POSIX 软链接及第二套完整路由。 |
| C03 | 元数据分层 TTL：课程 24 小时，文件 1 小时，作业/公告/讨论及回放列表 5 分钟；签到、直播、文件内容和签名媒体 URL 不缓存。[缓存源码](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/internal/vfs/cache.go) | 后端有进程内 HashMap 缓存，课程列表使用它；前端另有账号隔离的日历 localStorage 快照。 | **采用并改造** | 在现有 App/Client 层按资源制定 TTL 和刷新策略；磁盘缓存采用原子写入、失败不阻断请求；缓存键必须包含账号与 Canvas 实例，写操作/切号时失效，UI 展示数据时间与过期状态。不要直接复用参考项目 `course-<id>` 键，避免多账号同 ID 混读。 |
| C04 | mLearning 提供 `attendance/status` 和 `attendance/records` 只读投影；检测 HTTP 200 内 `resultCode=10001` 后清除域 Cookie、重走 SSO、最多重试一次。[源码](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/internal/mlearning/client.go) | 本地签到守望以 Python 执行扫码/登录/提交，尚无对应课程签到状态和历史读取页面。 | **优先采用** | 在现有登录态之上增加只读的本人签到状态/历史查询，先用 Mock 固定接口契约；处理过期、并发刷新和分页。提交操作仍由现有显式签到流程负责，不让状态探测触发签到。 |
| C05 | daemon 对 Canvas、jAccount、视频、mLearning 分域健康检查；区分失效与暂时网络故障，仅状态变迁通知。[契约](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/internal/cli/docs/daemon.md) | 本地有 Token/额外登录测试及签到状态、诊断事件，但缺统一的分域健康视图。 | **采用状态模型，不引入 daemon** | 在 Tauri 内汇总四域 `ok/fail/unknown`、最近检查与补救提示；业务请求可刷新状态，轮询需限频；通知仅状态变化时触发，并写入现有脱敏日志。 |
| C06 | 系统 keyring 优先，无可用服务时退回权限受限的明文文件。[源码](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/internal/cred/cred.go) | `AppConfig` 含 Token、Cookie、密码；`save_config` 将配置序列化为账号 JSON，日志脱敏不等于静态加密。 | **借鉴，单独设计迁移** | 评估 Windows Credential Manager/macOS Keychain/Linux Secret Service 的跨平台后端；秘密字段以引用替代配置明文，兼容旧配置迁移、备份/还原、多账号和无密钥环环境；回退方式须可见并由产品策略决定。 |
| C07 | VFS 可输出回放签名 URL，进入回放目录会逐路视角探测媒体大小。[源码](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/internal/vfs/video.go) | 已有视频播放、分段 Range 下载/顺序回退、字幕/PPT/AI 工作台。 | **不移植下载器和 URL 投影** | 继续使用现有下载与媒体代理；新增只读数据接口只返回必要的回放状态/素材元数据，签名 URL 不进入 MCP、缓存或日志。避免列目录时逐路媒体探测。 |
| C08 | 可选 Unix Socket daemon、TUI、安装/自更新脚本与系统服务。[CLI/daemon 契约](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/internal/cli/docs/daemon.md) | Tauri 常驻应用、MCP、Windows 预览/安装和更新机制已存在。 | **暂不融合** | 没有独立脚本客户端需求前不维护第二套 CLI/daemon；将来如确有需求，从 Rust 核心薄封装独立 CLI，脚本仅放 `script/`。 |

## 实施顺序与验收条件（待确认后实施）

1. **接口与权限基线。** 梳理现有 Tauri/MCP 的读写能力、账户边界、回环 HTTP 访问控制、错误映射和日志脱敏。先确定只读资源清单与字段白名单；验证 MCP 框架自身的 Origin/Host 等防护，再决定是否增加会话鉴权。验收：外部进程不能仅靠猜测端口取得超出用户授权的数据；现有 MCP 调用不回归；D05 日志窗口和报告仍可用。
2. **课程只读视图与签到查询。** 在现有 Rust App/Client 复用 Canvas/视频模型，增加课程资源索引；在签到模块新增状态和本人历史读取及过期重试。验收：切号无串数据；课程/回放未就绪有明确状态；签到读操作不会提交签到；分页、超时和网络错误均有稳定类型及补救信息。
3. **分层缓存。** 先对课程与只读元数据引入账号隔离 TTL、强制刷新和写后失效；缓存写失败时仍返回网络结果。验收：过期刷新、并发请求、切号、坏文件和离线场景覆盖；签到/直播/签名 URL 不落盘；UI 明确标出旧数据。
4. **健康状态与通知。** 复用已有诊断体系加入四域状态机，区分认证失效、业务错误与暂时网络故障，必要时只重试一次。验收：相同故障不反复通知，恢复只通知一次；不记录凭据、签名 URL 或个人敏感内容。
5. **凭据迁移（独立高风险改动）。** 先形成各平台存储/备份/恢复方案与回滚步骤，再实现旧账号配置迁移。验收：旧用户升级后登录态可用或有明确恢复路径；备份/还原和多账号正常；迁移失败不丢原数据。未经单独设计确认不把参考项目的静默明文回退原样引入。

实现阶段使用本项目测试门禁：相关 TypeScript/Vitest、Rust 定向测试和 `yarn check:rust`；桌面应用有改动时依 AGENTS.md 运行 `yarn build:preview:local`，报告本地可执行文件完整路径。预览构建不发布 Release，也不改版本号。

## 约束与风险

- 参考项目的磁盘缓存键只按课程 ID 命名，当前源码中未见账号隔离；直接移植会带来跨账号残留风险。此处为基于源码的推断，实施时应以数据流测试验证。
- 参考 VFS 的回放 `url` 投影包含签名媒体 URL；本地 MCP 对 AI 客户端开放数据，必须额外收紧敏感字段。现有 MCP 服务绑定回环地址，但是否已有框架层 Origin/Host 防护须实测，不能仅凭源码判断安全性。
- mLearning 接口属于非公开稳定契约，具体字段和过期语义可能变化；新读取能力应封装在适配层，并以 Mock/受控实测验证。
- 若定向复制参考仓库代码，遵守其 [MIT 许可证](https://github.com/404MaximWang/sjtu-canvas-cli/blob/398ec3468a28fad71cb83facf0ce5772445c2a56/LICENSE)的版权与许可声明要求；优先独立实现明确的数据契约。

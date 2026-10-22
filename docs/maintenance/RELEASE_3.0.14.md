# 3.0.14 发布记录

## 主要改动

- 合并上游 3.0.13 的视频中心、任务中心、PPT OCR 和模型配置，同时保留本地签到守望、系统行为设置、首页与字幕工作台。
- 修复启动主题、日程筛选、双屏播放同步、账户初始化等问题。
- 字幕抓取可跳过已有结果并补齐缺失的 TXT；字幕 Agent 可按课次与分块限流并发，显示各课次进度，复用非空结果，并对超时及临时服务错误重试。
- 维护记录归入 `docs/maintenance/`；本地安装包按版本输出到 `release/<版本号>/`，附 SHA-256 清单。

## 构建与验证

在仓库根目录运行 `yarn build:release:local`。脚本使用 `src-tauri/tauri.local.conf.json` 构建本地 Windows 安装包；该配置关闭自动更新产物，不能替代 GitHub Actions 中的签名发布流程。

发布前运行 `yarn test`、`yarn typecheck`、`yarn lint` 和 `cargo test --manifest-path src-tauri/Cargo.toml --locked`。若本机配置了 HTTP 代理，运行 Rust 回环服务测试前将 `localhost,127.0.0.1,::1` 加入 `NO_PROXY`。需要真实 Canvas 或 jAccount 凭据的测试默认跳过。

`release/<版本号>/SHA256SUMS.txt` 只列出该版本目录中的文件。本次 fork 的 Windows x64 Release 使用本地构建配置，自动更新已关闭；它不提供 `latest.json` 或其他平台安装包。未来若启用 fork 的自动更新，需要先建立独立签名密钥、下载地址与跨平台构建，并核对安装包、更新器签名及 `latest.json`。

本地核对结果：前端 37 个测试文件、161 项通过；TypeScript 类型检查通过；ESLint 0 错误、59 条既有警告；Rust 离线测试 87 项通过、14 项按需跳过。`cargo fmt --all -- --check` 仍会报告本次改动以外的既有文件格式差异；本次修改的 `subtitle_archive.rs` 已单独格式化。Windows x64 的可执行文件、MSI 和 NSIS 安装包均已生成，三项 SHA-256 与清单一致。尚未做安装后人工体验和其他平台构建。

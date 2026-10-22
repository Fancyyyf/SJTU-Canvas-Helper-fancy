# 2026-10-21 upstream 合并记录

- 合并前本地基线：`ce7b209`
- 合并前本地修改快照：`87f6055`（`backup/pre-upstream-local-20261021`，含当时未跟踪的字幕资料）
- upstream：`f804dd5`（`git@github.com:Okabe-Rintarou-0/SJTU-Canvas-Helper.git` 的 `main`）
- 历史合并提交：`2271273`
- 本地测试版：`3.0.14`

SSH 22 端口在本机连接被关闭，因此本次从同一 GitHub 仓库临时使用 HTTPS 拉取；`upstream` remote 仍配置为用户指定的 SSH 地址。

## 冲突与处理

| 文件 | 处理及保留功能 |
| --- | --- |
| `src-tauri/Cargo.toml`、`Cargo.lock`、`tauri.conf.json`、`package.json` | 基于 upstream 的依赖和打包配置，补回本地托盘与开机自启依赖；测试版统一为 `3.0.14`。 |
| `src-tauri/src/app/basic.rs` | 采用 upstream 的并发安全视频代理和 PDF 转换；补回本地系统行为设置读写与签到任务状态初始化。 |
| `src-tauri/src/app/video.rs`、`src-tauri/src/client/video.rs` | 采用 upstream 新版视频中心、直播和播放接口；保留本地全课分页拉取及原始字幕响应字节保存。旧直播接口由新版直播播放器替代。 |
| `src-tauri/src/main.rs` | 合并 upstream 视频资料、PPT 和任务相关命令与本地签到、系统设置、字幕库命令；适配新版代理方法参数。 |
| `src/components/layout.tsx`、`router.tsx` | 保留本地首页、侧边栏自定义和字幕工作台入口，接入 upstream 的任务中心及跨页面常驻视频工作区。 |
| `src/page/video.tsx` | 采用 upstream 新版视频中心，旧本地直播面板由新版直播功能替代。 |
| `src/page/files.tsx`、`settings.tsx` | 保留本地文件排序、系统行为设置，同时接入 upstream 的文件转换、AI 模型配置及新增设置。 |
| `src/lib/hooks.tsx`、`utils.tsx` | 保留本地二维码登录成功回调所需 cookie 传递，采用 upstream 的更新检查流程并保留错误记录。 |
| `src-tauri/src/client/basic.rs`、`src/components/video_aggregator.tsx` | 调整测试标记和诊断导入，无用户可见功能取舍。 |
| `script/install.bat`、`script/install_mac.sh` | 保留本地整理后的 `scripts/` 版本，删除旧路径；将 upstream 新增的 Rust 检查脚本也统一移动到 `scripts/`，同步修改调用路径。 |
| `src-tauri/src/canvas_agent/mod.rs` | 字幕 Agent 改用 upstream 统一的 LLM 会话快照，继续共享应用内模型、密钥、服务地址和温度设置。 |

第二轮恢复本地快照时，字幕工作台路由、侧边栏入口和 Tauri 命令注册均与 upstream 新结构合并；版本号冲突按 `3.0.14` 解决。

## 本地功能核对

- 签到守望：后端命令、状态初始化、页面与路由保留。
- 最小化到托盘及开机自启：系统设置读写、插件和托盘初始化保留。
- 首页及侧边栏自定义：路由、状态与设置弹窗保留。
- 文件排序：排序选项和排序调用保留。
- 课程字幕：原始 JSON、提取 TXT、Agent 整理字幕及知识笔记目录保留；按课程拉取已上课次，Agent 按课次与字幕分块循环调用。
- 视频中心：采用 upstream 新版直播、录像、PPT OCR、字幕导出和 AI 摘要功能。

用于比对合并前后的命令：`git diff backup/pre-upstream-local-20261021..main -- <路径>`。本地快照分支独立保留，不影响 `main` 工作树。

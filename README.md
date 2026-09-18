<div align="center">
  <img src="images/logo.png" width="300px"/>
  <h1>SJTU Canvas Helper</h1>
  <p><b>还在为下载学生上传的大量压缩包而苦恼吗？</b></p>
</div>

SJTU Canvas 小帮手基于 [Tauri](https://tauri.app/) 开发，助您更便捷地使用交大 Canvas。
参与讨论：[水源社区](https://shuiyuan.sjtu.edu.cn/t/topic/245275)，[官网](https://okabe-rintarou-0.github.io/SJTU-Canvas-Helper/)。


<div align="center">
  <img align="center" src="https://img.shields.io/badge/rust-1.75-blue" alt="">
  <img align="center" src="https://img.shields.io/github/stars/Okabe-Rintarou-0/SJTU-Canvas-Helper" /> 
  <img align="center" src="https://img.shields.io/github/v/release/Okabe-Rintarou-0/SJTU-Canvas-Helper?include_prereleases" /> 
  <img align="center" src="https://img.shields.io/github/downloads/Okabe-Rintarou-0/SJTU-Canvas-Helper/total" />
</div>

## 安装指南

| 操作系统类型 | 推荐下载（点击直接下载最新版） | 说明 |
| :--- | :--- | :--- |
| 🪟 **Windows 64 位** | [SJTU.Canvas.Helper_3.0.11_x64_en-US.msi](https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/releases/download/app-v3.0.11/SJTU.Canvas.Helper_3.0.11_x64_en-US.msi) | 首选，支持自动更新 |
| 🪟 **Windows 32 位** | [SJTU.Canvas.Helper_3.0.11_x86_en-US.msi](https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/releases/download/app-v3.0.11/SJTU.Canvas.Helper_3.0.11_x86_en-US.msi) | 仅限老旧 32 位电脑 |
| 🍎 **macOS Apple Silicon** | [SJTU.Canvas.Helper_3.0.11_aarch64.dmg](https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/releases/download/app-v3.0.11/SJTU.Canvas.Helper_3.0.11_aarch64.dmg) | M 系列芯片 |
| 🍎 **macOS Intel** | [SJTU.Canvas.Helper_x64.app.tar.gz](https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/releases/download/app-v3.0.11/SJTU.Canvas.Helper_x64.app.tar.gz) | Intel 芯片 |
| 🐧 **Linux Debian/Ubuntu** | [SJTU.Canvas.Helper_3.0.11_amd64.deb](https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/releases/download/app-v3.0.11/SJTU.Canvas.Helper_3.0.11_amd64.deb) | `dpkg` 安装 |
| 🐧 **Linux RedHat/Fedora** | [SJTU.Canvas.Helper-3.0.11-1.x86_64.rpm](https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/releases/download/app-v3.0.11/SJTU.Canvas.Helper-3.0.11-1.x86_64.rpm) | `rpm` 安装 |
| 🐧 **Linux 通用** | [SJTU.Canvas.Helper_3.0.11_amd64.AppImage](https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/releases/download/app-v3.0.11/SJTU.Canvas.Helper_3.0.11_amd64.AppImage) | 赋予权限后直接运行 |

1. 前往 [Release](https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/releases) 页面下载并安装一次即可，后续主版本更新将自动拉取，无需重复下载

2. **Windows 系统**：
   - 推荐下载 `.msi` 安装包，支持自动更新功能
   - 也可选择免安装便携版：`SJTU.Canvas.Helper_v_3.0.11_x64_portable.zip`

3. **MacOS 系统**：
   - 下载对应版本安装包 
   - 或打开终端（terminal）运行 `bash script/install_mac.sh` 自动下载安装（自动识别 Intel / Apple Silicon 芯片）
   - 若遇到打不开的问题，可参考 [在 Mac 上安全地打开 App](https://support.apple.com/zh-cn/102445)
   - 若显示已损坏，尝试执行以下命令：
     ```shell
     cd /Applications 
     sudo xattr -r -d com.apple.quarantine /Applications/SJTU\ Canvas\ Helper.app
     ```

4. **Arch Linux 系统**：
   通过 [yay](https://github.com/Jguer/yay) 从 AUR 安装：
   ```bash
   yay -S sjtu-canvas-helper
   ```

### 首次配置

安装完成后，请前往设置页面填写您的 `Canvas Token` 以及文件下载保存目录。

![](./images/settings.png)

## 致谢

感谢以下用户为本仓库做出的贡献：

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/xeonliu"><img src="https://avatars.githubusercontent.com/u/62530004?v=4?s=100" width="100px;" alt="xeonliu"/><br /><sub><b>xeonliu</b></sub></a><br /><a href="https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/commits?author=xeonliu" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/creeper12356"><img src="https://avatars.githubusercontent.com/u/138413915?v=4?s=100" width="100px;" alt="creeper12356"/><br /><sub><b>creeper12356</b></sub></a><br /><a href="https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/commits?author=creeper12356" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/pangbo13"><img src="https://avatars.githubusercontent.com/u/51732678?v=4?s=100" width="100px;" alt="PangBo"/><br /><sub><b>PangBo</b></sub></a><br /><a href="https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/commits?author=pangbo13" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/wytili"><img src="https://avatars.githubusercontent.com/u/61528682?v=4?s=100" width="100px;" alt="Yiting Wang"/><br /><sub><b>Yiting Wang</b></sub></a><br /><a href="https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/commits?author=wytili" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://blog.a-stable.com"><img src="https://avatars.githubusercontent.com/u/66514911?v=4?s=100" width="100px;" alt="Yuxuan Sun"/><br /><sub><b>Yuxuan Sun</b></sub></a><br /><a href="https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/commits?author=definfo" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yingyx"><img src="https://avatars.githubusercontent.com/u/191231288?v=4?s=100" width="100px;" alt="Yuxuan Ying"/><br /><sub><b>Yuxuan Ying</b></sub></a><br /><a href="https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/commits?author=yingyx" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://young-lord.github.io"><img src="https://avatars.githubusercontent.com/u/51789698?v=4?s=100" width="100px;" alt="LY"/><br /><sub><b>LY</b></sub></a><br /><a href="https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/commits?author=young-lord" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## Main Features
+ [x] 文件下载 / 预览(免下载) / PDF & PPTX 混合合并(免下载)
+ [x] 一键上传[交大云盘（新）](https://pan.sjtu.edu.cn/)
+ [x] DDL 日历 
+ [x] 人员名单导出
+ [x] 查看/提交作业
+ [x] 批改作业/修改作业 DDL
+ [x] 支持密院和本部 canvas 系统
+ [x] 视频下载/播放/字幕下载/截图抓取合成PDF
+ [x] 签到守望：自动识别屏幕中的课堂签到二维码，支持扫码登录态与账号密码/OCR 回退登录
+ [x] 多 API Key 管理：支持添加多个 LLM 服务商 Key，自动识别提供商并拉取可用模型列表
+ [x] MCP Server：将 Canvas 数据能力通过标准 MCP 协议开放给 AI 客户端
+ [x] 自动更新

### 首页与全局学期筛选

侧栏顶部的“首页”集中展示当前 Canvas 用户、课程数量、任课/助教课程统计和常用功能入口。首页的“全局学期范围”支持选择最近有效学期、任意指定学期或“全部学期”。选择会保存在本机 WebView 的 `localStorage` 中，并同步应用到文件、作业、讨论、日历、成员、成绩、提交、教学大纲、视频和二维码等课程型页面。

首页的功能目录始终保留所有页面入口。在首页“功能目录”右侧点击“自定义侧边栏”，或直接点击侧边栏导航列表下方的“编辑侧边栏”，可以逐项选择需要固定到侧边栏的快捷入口，也可以全部显示或全部隐藏；首页自身始终保留，不会因自定义而消失。侧边栏选择同样保存在本机 `localStorage` 中，重新启动应用后会自动恢复。功能卡片上的“侧边栏快捷入口”标签表示该功能当前已固定。

首次加载时，应用优先选择当前日期所在的学期；若 Canvas 没有返回明确的起止日期，则回退到最近的学期。保存的学期在切换账号后不存在时，也会自动回退到该账号最近的有效学期。切换学期会清除不再属于当前范围的单课程选择，避免页面继续请求上一学期课程。

作业列表额外提供“全部课程（当前学期范围）”选项。选择后会并行聚合当前全局学期内的所有课程作业，并在每条作业上显示课程标签；某一门课程请求失败时，其余课程仍会显示并给出降级提示。“只显示未完成”会按每门课程的学生/教师身份分别处理，提交、评论和修改日期等操作始终使用作业自身的 `course_id`，不会误用之前选中的课程。

日程页使用全局学期范围内的全部课程，不会再因为课程缺少自定义颜色而跳过。页面会将 Canvas 日历事件与每门课程作业接口中的 `due_at` 合并并按课程和作业编号去重；日历接口失败时，会自动回退到作业接口的截止日期，单门课程加载失败也不会阻断其他课程，并会在页面显示降级提示。

### 文件下载/预览

文件列表默认按 Canvas 返回的最后修改时间从新到旧排列，也可以切换为修改时间正序、名称正序/倒序或文件大小正序/倒序。文件夹始终排列在文件之前；没有修改时间的外部文件会排在有时间信息的文件之后。列表中的“最后修改”列依次回退使用 `modified_at`、`updated_at` 和 `created_at`。

采用类似 macOS Quick Look 的预览体验：
- 按下空格打开预览
- 再次按下空格关闭预览

https://github.com/Okabe-Rintarou-0/SJTU-Canvas-Helper/assets/58595459/7f05cabc-7bf9-4f58-91ea-f3efed151733

**支持预览主流压缩文件（7z, zip, rar...）**

![](./images/file.png)

#### 支持的文件预览格式

| 文件类型 | 格式                                                 | 支持状态 |
| -------- | ---------------------------------------------------- | -------- |
| 文档     | PDF                                                  | ✅        |
| 文档     | DOCX                                                 | ✅        |
| 文档     | Markdown                                             | ✅        |
| 表格     | XLSX                                                 | ✅        |
| 代码     | 多种编程语言代码（见说明）                           | ✅        |
| 图片     | PNG, JPG, JPEG, BMP, GIF, TIFF, SVG, ICO, WEBP, AVIF | ✅        |
| 笔记本   | IPYNB (Jupyter Notebook)                             | ✅        |
| 压缩包   | ZIP, RAR, 7Z 等主流格式                              | ✅        |

**代码文件支持说明：** 支持多种编程语言代码预览，包括但不限于：C/C++, Java, Python, JavaScript, TypeScript, Go, Rust, PHP, Ruby, Swift, Kotlin 等。详细支持列表请参考 [highlight.js 支持的语言](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md)。

### 文件一键上传交大云盘

![](./images/jbox.png)

### 课程录屏播放/下载

![](./images/video.png)

### 查看课程作业

![](./images/assignment.png)

### 签到守望

“签到守望”用于在本人正常参与课堂时，辅助发现 Canvas 直播、共享屏幕或课件中短暂出现的课堂签到二维码。它会在本机定时捕获所有显示器，识别二维码，并且只对以下格式的上海交通大学课堂签到链接执行操作：

```text
https://mlearning.sjtu.edu.cn/lms/mobile2/forscan/...
```

#### 功能一览

- 自动监听：支持 0.5、1、2、5 秒扫描间隔，切换到其他功能页面后仍可继续运行
- 单次扫描：立即扫描当前所有显示器并处理发现的有效签到二维码
- 手动提交：粘贴二维码中的完整链接，经过协议、域名、路径和参数校验后提交
- 实时状态：显示扫描轮次、有效二维码数、签到成功/失败数、重复跳过数和最近状态
- 智能去重：成功链接 10 分钟内不重复提交；失败链接 30 秒后允许重试
- 多显示器支持：逐一捕获当前系统可用的全部屏幕
- 双登录路径：优先复用额外扫码登录态，也可配置学号密码并在本机自动识别登录验证码
- 登录重试：验证码识别或登录失败时最多重新获取并尝试 3 次，提交前等待 0.5–3 秒可配置间隔
- 生命周期保护：切换账号或退出应用时自动停止监听任务

#### 使用步骤

1. 启动应用并从侧边栏进入“签到守望”。Canvas Token 与下载目录不是此功能的额外前置条件。
2. 任选一种登录方式：在设置页的“额外扫码登录”区域使用交我办/jAccount 扫码；或在“签到守望”页启用密码登录回退并保存学号、密码。两者同时存在时优先使用扫码登录态。
3. 从侧边栏进入“签到守望”，选择扫描频率并点击“启动守望”。推荐使用每 1 秒扫描一次。
4. 正常打开 Canvas 直播、课件或教师共享屏幕。发现有效二维码后，页面会显示识别和提交结果。
5. 不再需要监听时点击“停止”。离开签到守望页面不会停止后台任务。

如果不希望持续监听，可以使用“扫描一次”；如果已经获得二维码链接，可以直接粘贴到“手动提交”区域。

#### 登录与签到流程

```text
Tauri 页面 → 启动 python/attendance/nn.py → 截屏与 QR 识别
                                            ↓
                                  调用 surveil.auto_sign
                   ├→ 已有 JAAuthCookie → jAccount SSO ─┐
                   └→ 账号密码 → 验证码 → ddddocr ─────┤
                                                      └→ mLearning token → 签到接口
```

签到实现直接沿用 Python 模块的原始文件层级，并只为桌面集成增加了配置、命令行入口和 JSON Lines 事件：

```text
python/attendance/
├── nn.py              # 截屏、QR 识别、循环监听、提示音
├── surveil.py         # 登录、验证码 OCR、token 获取、签到提交
├── requirements.txt   # Python 依赖
└── README.md           # 独立运行与集成协议
```

Rust/Tauri 只负责查找解释器、启动或停止 Python 子进程、传入本机配置，并把事件同步到页面。签到 URL、密码和 Cookie 通过子进程环境变量传入，不会写进 Python 源码或命令行参数。`nn.py` 仍直接调用 `surveil.py` 的 `auto_sign`，因此这套目录也可以脱离桌面应用独立运行。

密码登录为可选功能。启用后，学号和密码会保存在当前账号对应的本机应用配置文件中，只用于向上海交通大学 jAccount 登录接口提交；请勿在共享设备中启用。关闭密码登录回退并保存会清除已存学号和密码。验证码图片由 `ddddocr` 在本机识别，不上传第三方服务；屏幕图像同样只在本机内存中进行二维码识别，不保存、不上传，也不会发送给 LLM。调试日志会脱敏 Cookie、Authorization 等敏感请求头，设置页显示原始配置时也会隐藏密码和令牌。

#### Python 环境

应用会附带上述 Python 源文件，但不会内置 Python 解释器和第三方包。先安装 Python 3，再在项目根目录执行：

```shell
python -m pip install -r python/attendance/requirements.txt
```

进入“签到守望”页面后，可填写 `python`、`python3` 或解释器完整路径，点击“检测 Python 环境”，检测成功后保存配置。若仅使用模块，可参考 [python/attendance/README.md](python/attendance/README.md) 中的独立运行命令。

#### 系统权限与限制

- Windows：通常可直接捕获桌面；受保护窗口可能无法被截取。安装依赖的 Python 必须能被桌面应用所在用户找到，也可以在页面中填写 `python.exe` 的完整路径。
- macOS：首次使用时需在系统设置中授予“屏幕与系统录音”权限，授权后可能需要重启应用；还需安装 zbar，例如 `brew install zbar`。
- Linux：需要可用的图形桌面会话和系统 zbar 库（Debian/Ubuntu 可安装 `libzbar0`）；无头环境无法使用。
- 二维码必须完整、清晰并实际显示在屏幕中。二维码过小、压缩严重或被遮挡时可能无法识别。
- 签到已经关闭、登录态过期、账号无权限、网络异常或学校接口变化时，提交可能失败。
- 本功能只应在本人真实参与且课程规则允许的场景使用，不能替代本人到课。

Python 模块以用户提供的 `canvas_video_check_in_fancy` 本地版本为基础，并保留其 `nn.py`、`surveil.py` 与 `requirements.txt` 结构；功能来源可参见 [Castilane/surveillance](https://github.com/Castilane/surveillance/)。桌面侧仅增加运行管理、配置传递、结果展示与使用指南。

### 学生提交作业查看/批改/修改 DDL

输入合法的分数，然后按下回车；如果想撤回分数，则清空输入框，再次按下回车。

![](./images/submission.png)

## 开发指南

![](images/arch.png)

本项目是一个 Tauri 2 桌面应用：React/TypeScript 负责界面，Rust 负责 Canvas API、文件、视频、MCP 和系统能力，签到守望继续使用独立 Python 模块。也可以借助 [DeepWiki](https://deepwiki.com/Okabe-Rintarou-0/SJTU-Canvas-Helper) 辅助理解上游项目。

开发者快速导航：

- [项目结构](#2-项目结构)
- [开发环境准备](#3-开发环境准备)
- [克隆与首次编译](#4-克隆与首次编译)
- [开发调试与测试](#6-开发与调试)
- [生产构建](#8-生产构建的工作方式)
- [Windows / macOS / Linux 打包](#9-windows-打包)
- [版本号与发布前检查](#12-版本号与发布前检查)
- [Updater 签名与 GitHub Actions](#13-自动更新签名)
- [常见构建问题](#15-常见构建问题)

### 1. 技术栈与版本来源

| 层级 | 技术 | 主要配置 |
| --- | --- | --- |
| 桌面容器 | Tauri 2 | `src-tauri/tauri.conf.json` |
| 后端 | Rust 2021、Tokio、Reqwest | `src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` |
| 前端 | React 18、TypeScript、Vite 5、MUI 7 | `package.json`、`vite.config.ts` |
| 前端测试 | Vitest、Testing Library、jsdom | `vitest.config.ts` |
| 签到模块 | Python、Pillow、pyzbar、ddddocr | `python/attendance/requirements.txt` |
| 自动发布 | GitHub Actions、`tauri-apps/tauri-action` | `.github/workflows/release.yml` |

依赖版本应以锁文件为准。仓库包含 `yarn.lock`，因此开发和 CI 都优先使用 Yarn，不要同时提交其他包管理器生成的锁文件。

### 2. 项目结构

```text
SJTU-Canvas-Helper-fancy/
├── src/                              # React/TypeScript 前端
│   ├── page/                         # 路由页面，每个主要功能一个页面
│   ├── components/                   # 可复用组件、预览器和弹窗
│   ├── lib/                          # 类型、配置、状态、事件和通用 Hook
│   ├── css/                          # 全局与模块样式
│   └── test/                         # Vitest 公共测试配置
├── src-tauri/                        # Rust/Tauri 桌面后端
│   ├── src/main.rs                   # Tauri 启动、插件注册、Command 暴露
│   ├── src/app/                      # 应用编排、缓存、视频、签到等业务层
│   ├── src/client/                   # Canvas、视频、JBox、LLM HTTP 客户端
│   ├── src/model/                    # Rust DTO、配置和事件模型
│   ├── src/mcp/                      # 本机 MCP Server
│   ├── src/utils/                    # 文件、时间和 JSON 工具
│   ├── capabilities/                 # Tauri 权限声明
│   ├── icons/                        # 各平台应用图标
│   ├── Cargo.toml                    # Rust 依赖
│   └── tauri.conf.json               # 窗口、打包、资源和更新器配置
├── python/attendance/                # 保持原结构的 Python 签到模块
│   ├── nn.py                         # 截屏、QR 识别、监听和去重
│   ├── surveil.py                    # jAccount、验证码 OCR 和签到提交
│   ├── requirements.txt              # Python 依赖
│   └── README.md                     # Python 独立运行说明
├── public/                           # Vite 静态资源
├── website/                          # 项目介绍静态站点
├── script/                           # 安装脚本和版本同步脚本
├── .github/workflows/                # 检查、测试、网站和发布流水线
├── package.json                      # 前端脚本与依赖
└── README.md
```

主要调用链如下：

```text
React 页面
   │ invoke("command", payload)
   ▼
src-tauri/src/main.rs 中的 #[tauri::command]
   ▼
全局 APP → app 业务层 → client 网络层 → Canvas / SJTU 服务
   │
   └── emit("...", payload) → 前端事件 Hook → 页面状态更新

签到守望页面 → Rust attendance 适配层 → Python nn.py
                                           └→ surveil.auto_sign()
Python JSON Lines stdout → Rust 解析 → attendance://event → 页面
```

增加普通页面时，通常需要同步修改 `src/page/`、`src/components/router.tsx` 和 `src/components/layout.tsx`。增加后端能力时，需要在 `src-tauri/src/app/` 或 `client/` 实现，在 `main.rs` 注册 Command，并在 `src/lib/model.ts` 维护与 Rust 序列化结果一致的类型。

本文只讨论当前已经配置的 Windows、macOS 和 Linux 桌面目标。仓库中的 Android/iOS 图标是 Tauri 初始化资产，不代表移动端已经完成适配或具备发布流水线。

### 3. 开发环境准备

通用工具：

- Git。
- Node.js 20 或 22。发布工作流使用 Node 20，前端检查工作流使用 Node 22。
- Yarn。若系统没有 `yarn`，可先执行 `corepack enable`；也可安装 Yarn Classic。
- Rust stable 与 Cargo。Windows 必须使用 MSVC toolchain。
- Python 3，仅“签到守望”开发和运行需要。
- FFmpeg，仅视频合成功能需要，并且 `ffmpeg` 必须位于 `PATH`。

Tauri 的最新系统依赖列表以[官方 Prerequisites](https://v2.tauri.app/start/prerequisites/)为准。

#### Windows

1. 安装 Visual Studio 2022 Build Tools，勾选“使用 C++ 的桌面开发”和 Windows SDK。
2. 安装或确认系统具有 Microsoft Edge WebView2 Runtime。
3. 安装 Rust 后切换到 MSVC：

   ```powershell
   rustup default stable-msvc
   rustup update
   ```

4. 安装标准 Windows Python。`py -3` 或 `python` 应能在 PowerShell 中运行。

#### macOS

```bash
xcode-select --install
brew install node python zbar
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Apple Silicon 默认目标是 `aarch64-apple-darwin`，Intel Mac 默认目标是 `x86_64-apple-darwin`。签到守望首次运行时还要授予屏幕录制权限。

#### Debian/Ubuntu

```bash
sudo apt update
sudo apt install -y \
  build-essential curl wget file libssl-dev \
  libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libxdo-dev patchelf \
  python3 python3-venv libzbar0
```

Fedora、Arch、openSUSE 等发行版的软件包名称不同，请按 Tauri 官方依赖表安装 WebKitGTK 4.1、GTK、OpenSSL、appindicator、librsvg、构建工具和 zbar。

### 4. 克隆与首次编译

```shell
git clone https://github.com/Fancyyyf/SJTU-Canvas-Helper-fancy.git
cd SJTU-Canvas-Helper-fancy

# 严格使用 yarn.lock 安装前端依赖
yarn install --frozen-lockfile

# 提前下载并验证 Rust 锁定依赖
cargo fetch --manifest-path src-tauri/Cargo.toml --locked
```

如果需要签到守望，建议为项目创建隔离的 Python 环境。

Windows PowerShell：

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r python\attendance\requirements.txt
```

macOS/Linux：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r python/attendance/requirements.txt
```

首次启动完整桌面应用：

```shell
yarn tauri dev
```

该命令会根据 `tauri.conf.json` 自动先执行 `yarn dev`，Vite 固定监听 `http://localhost:1420`，随后编译并启动 Rust/Tauri。第一次 Rust 编译通常需要数分钟，之后会使用 `src-tauri/target/` 中的增量缓存。

只调试前端布局时可以运行：

```shell
yarn dev
```

浏览器模式无法调用 Tauri Command、文件系统、更新器和 Python 子进程，因此只能用于纯 UI 调试。

仓库根目录的 `makefile` 保留了一些旧快捷入口，其中 `install`、`dev` 等目标会切换目录后再执行 Yarn；若本机 Yarn 无法向上查找根目录 `package.json`，这些目标会失败。开发、测试和打包以本 README 中的根目录直连命令为准；`make version <版本>` 不受该问题影响。

### 5. 首次运行配置

1. 创建或选择应用账号。
2. 在“系统设置”中填写 Canvas Token、账号类型和下载目录。
3. 使用签到守望时，在对应页面填写虚拟环境解释器：
   - Windows：`项目目录\.venv\Scripts\python.exe`
   - macOS/Linux：`项目目录/.venv/bin/python`
4. 点击“检测 Python 环境”并保存。
5. 视频合成需要单独安装 FFmpeg，再使用页面中的检测按钮验证。

配置按应用账号保存。普通安装默认位于系统配置目录的 `SJTU-Canvas-Helper` 子目录，日志文件名为 `app.log`：

| 系统 | 常见位置 |
| --- | --- |
| Windows | `%APPDATA%\SJTU-Canvas-Helper\` |
| macOS | `~/Library/Application Support/SJTU-Canvas-Helper/` |
| Linux | `~/.config/SJTU-Canvas-Helper/` |

便携模式会在可执行文件旁查找 `.config/PORTABLE`，存在时把配置和日志保存在同一个 `.config/` 目录。配置可能包含 Canvas Token、Cookie 或密码，不要提交到 Git、公开 Issue 或构建产物中。

### 6. 开发与调试

常用命令均在项目根目录执行：

```shell
# 完整桌面开发模式
yarn tauri dev

# 仅前端
yarn dev

# 前端测试监听
yarn test:watch

# Rust 快速检查
cargo check --manifest-path src-tauri/Cargo.toml

# 查看 Tauri、Rust、Node.js、系统和关键项目配置
yarn tauri info
```

开发构建启用了 Tauri DevTools：

- Windows/Linux：`Ctrl + Shift + I`
- macOS：`Command + Option + I`
- Rust 日志：终端和配置目录中的 `app.log`
- 前端日志：WebView DevTools Console
- HTTP 调试：设置页开启调试模式后，在应用调试页面查看；敏感请求头会脱敏

如果 Vite 报端口占用，请结束占用 `1420` 的进程。`vite.config.ts` 启用了 `strictPort`，不会自动切换端口。

### 7. 代码检查与测试

提交前建议依次运行：

```shell
yarn lint
yarn typecheck
yarn test
yarn build

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features
cargo test --manifest-path src-tauri/Cargo.toml
```

Python 模块检查：

```shell
python -m py_compile python/attendance/nn.py python/attendance/surveil.py
python python/attendance/nn.py --help
python python/attendance/surveil.py --help
```

`python python/attendance/nn.py --scan-once --json` 会真实读取当前屏幕。持续监听或调用 `surveil.py` 则可能发起真实登录/签到请求，开发时应使用明确授权的测试账号和有效测试场景。

默认的 `cargo test` 只运行可离线、可重复的单元测试和 Mock 测试。需要真实 Canvas Token 或 jAccount 服务的测试均带有明确的 `#[ignore = "原因"]`，因此没有账号配置和网络时也应当通过：

```shell
cargo test --manifest-path src-tauri/Cargo.toml
```

需要运行 Canvas 在线测试时，设置 Token 后只执行对应的 ignored 测试，避免同时触发其他可能修改真实数据的集成测试：

```powershell
# PowerShell
$env:CANVAS_TOKEN = "你的测试 Token"
cargo test --manifest-path src-tauri/Cargo.toml client::basic::test -- --ignored --test-threads=1
```

```bash
# macOS/Linux
CANVAS_TOKEN="你的测试 Token" cargo test --manifest-path src-tauri/Cargo.toml client::basic::test -- --ignored --test-threads=1
```

二维码 UUID 测试需要访问真实 jAccount 登录服务，可显式运行：

```shell
cargo test --manifest-path src-tauri/Cargo.toml client::video::tests::test_get_uuid -- --ignored
```

视频下载测试已改为本地 Mock HTTP 服务，不访问公网；输出使用系统临时目录和 RAII 清理器，即使请求或断言失败也不会在仓库中留下 MP4。不要直接运行不带过滤条件的 `cargo test -- --ignored`，因为仓库中还存在其他需要真实账号、可能读取或修改远端数据的手动集成测试。

`yarn typecheck` 必须通过。测试代码通过公开的 `DocRendererProps["mainState"]` 获取文档查看器状态类型，Notebook 渲染器使用依赖公开导出的 `Ipynb` 类型；升级依赖时不要重新引用 `dist/` 内部路径或未导出的 `IpynbType`。

#### 全局日志与错误处理约定

项目使用统一的结构化诊断事件，而不是在业务代码中直接调用 `console.log` 或拼接任意字符串。前端入口为 `src/lib/logger.ts`，Rust 入口为 `src-tauri/src/diagnostics.rs`；Tauri Command 返回的 `AppError` 会在序列化给前端前自动记录错误码、可恢复性和脱敏后的技术详情。

一条前端诊断事件包含以下稳定字段：

| 字段 | 含义 |
| --- | --- |
| `eventId` | 单次事件唯一标识，用户反馈时可提供此值 |
| `traceId` | 跨多个阶段的操作链路标识，例如一次视频播放 |
| `code` | 稳定、可检索的错误码，格式为 `DOMAIN.ACTION_RESULT` |
| `scope` / `action` | 发生错误的页面、模块和动作 |
| `outcome` | `started`、`success`、`failed`、`fallback` 或 `cancelled` |
| `recoverable` | 当前错误是否允许用户重试或继续使用其他功能 |
| `fallback` | 是否启用了降级策略、策略名称及其结果 |
| `userMessage` | 展示给用户的简短提示，不应包含堆栈或凭据 |
| `context` / `error` | 开发诊断上下文和技术错误；写入前会统一脱敏 |

新增功能时应遵循三层分工：

1. 用户提示说明“发生了什么、现在能做什么”，不要直接展示堆栈、请求正文或内部路径。
2. 诊断事件说明失败阶段、稳定错误码、是否可恢复以及实际采用的 fallback。
3. 原始技术信息只放进 `error` 或 `context`，交给统一脱敏器处理；不要记录密码、Token、Cookie、Authorization、OAuth nonce/签名、完整响应正文或带签名的 URL。

前端推荐写法：

```ts
logHandledError({
  code: "FILES.PREVIEW_FAILED",
  scope: "file-preview",
  action: "load_document",
  error,
  userMessage: "文件预览失败，请下载后查看。",
  recoverable: true,
  fallback: {
    used: true,
    strategy: "offer_download",
    result: "success",
  },
  context: { fileType },
});
```

如果同时展示全局通知，可使用 `messageApi.open({ type: "error", content, diagnostic: { ... } })`，把用户提示和诊断信息放在同一次事件中。旧的 `consoleLog` 仅作为迁移兼容层保留，新代码不得继续使用。未捕获的 `window.error`、Promise rejection 和 React 渲染错误会由全局处理器及 Error Boundary 自动记录。

Rust 侧使用带字段的 `tracing` 事件，例如：

```rust
tracing::warn!(
    code = "VIDEO.PROXY_RESTARTED",
    %trace_id,
    recoverable = true,
    fallback = "restart_local_proxy",
    "Video proxy task exited unexpectedly"
);
```

日志级别约定如下：

- `DEBUG`：阶段、计时、数量等仅供开发调试的信息。
- `INFO`：关键生命周期成功事件，避免记录高频循环和每个数据分片。
- `WARN`：功能发生可恢复异常，或 fallback 已接管。
- `ERROR`：动作失败且 fallback 失败/不存在，或存在不可恢复的程序错误。

开发构建保存 `DEBUG` 及以上级别，并在 WebView Console 输出结构化对象；Release 构建只保存 `WARN` 和 `ERROR`，前端不会附带详细 `context` 和堆栈。无论构建类型，密钥字段、敏感请求头、URL 查询凭据和 JSON 中的敏感键都会被替换为 `<redacted>`。HTTP 调试页只有在设置中显式开启调试模式后才收集请求，最多保留最近 1000 条，每个请求/响应正文预览最多 1 MiB。

`app.log` 达到 8 MiB 后会在下一次启动时轮换为 `app.previous.log`，仅保留一份旧日志；应用内日志查看器最多读取当前日志最后 4 MiB。如果文件日志初始化失败，应用会降级到控制台日志并继续启动。排查问题时优先按 `eventId`、`traceId` 或 `code` 搜索，不要要求用户公开整个配置目录。

提交涉及错误处理的代码前，至少运行：

```powershell
yarn lint
yarn test
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml diagnostics::tests
```

#### 视频播放诊断日志

每次点击课程视频都会生成一个随机 `traceId`。前端、Tauri 命令、本地媒体代理和源站请求均使用该 ID 记录同一条播放链路，因此排查时不需要反复重启应用。正常链路依次包含：

```text
play.requested
→ play.proxy_url_built
→ proxy.prepare.begin / proxy.prepare.result
→ probe.begin
→ Video proxy CORS preflight（仅 WebView 要求预检时出现）
→ Video proxy inbound request
→ Video proxy upstream response
→ probe.success
→ player.load_start / player.metadata_loaded / player.can_play / player.playing
```

异常阶段会记录 `probe.fetch_error`、`probe.http_error`、`webview.csp_violation`、`player.stalled` 或 `player.error`。日志包含协议、主机、端口、路径段数量、扩展名、查询参数名称、Range、HTTP 状态、Content-Type、Content-Length、Content-Range、媒体 `readyState/networkState` 和各阶段耗时，但不会记录签名查询值、Cookie、Token 或 Authorization。代理无法命中路由时也会返回带 CORS 头的 404，并记录 `Video proxy route not found`，避免 WebView 将真实状态折叠成无信息的 `TypeError`。

Windows 默认日志路径为：

```text
%APPDATA%\SJTU-Canvas-Helper\app.log
```

PowerShell 可按一次播放的 `traceId` 过滤完整链路：

```powershell
Select-String -Path "$env:APPDATA\SJTU-Canvas-Helper\app.log" -Pattern "你的-traceId"
```

若日志文件暂时无法创建或写入，应用会降级为仅输出控制台日志并继续启动，不会因为日志初始化失败而崩溃。

### 8. 生产构建的工作方式

Tauri 官方建议通过 CLI 的 `build` 命令生成本机安装包，详见[分发文档](https://v2.tauri.app/distribute/)。由于本项目启用了需要私钥的 Updater 产物，本地不签名冒烟构建使用：

#### Windows x64 Release 快速操作

下面的流程只在当前 Windows 电脑生成本地 Release，不创建 GitHub Release、不切换 `release` 分支，也不向上游仓库上传文件。为了避免安装后的本地版本连接本项目预设的上游更新地址，构建命令还会通过临时配置关闭 Updater；该配置只对当前命令生效，不会修改 `src-tauri/tauri.conf.json`。

##### 已经可以运行开发模式时

如果当前项目已经能运行 `yarn tauri dev` 或 `yarn dev`，说明 `node_modules/` 中已经存在这次开发所需的前端依赖。只要以下内容没有变化，就不需要在每次 Release 构建前重新执行 `yarn install`：

- `package.json` 没有新增、删除或升级依赖；
- `yarn.lock` 没有变化；
- `node_modules/` 没有被删除或损坏；
- 没有切换到依赖定义不同的分支。

开发模式能运行并不表示依赖已经被编译进源码。`yarn dev` 启动 Vite 时，仍然是从本机 `node_modules/` 读取 React、MUI、Tauri API 等组件；这些依赖通常是在之前某次 `yarn install` 时安装的。Release 构建会继续复用同一份 `node_modules/`，不会自动重复下载。

开发预览和 Release 构建的区别是：`yarn dev` 主要启动开发服务器并按需转换模块，而 `yarn tauri build` 会执行 TypeScript/生产前端构建、Rust release 编译、资源嵌入和安装包生成。因此开发模式可运行是一个很好的依赖完整性信号，但仍应执行发布检查，以发现只在类型检查、优化打包或 Rust release 编译阶段出现的问题。

当前机器已经能够正常开发时，可以直接在项目根目录运行：

```powershell
cd H:\Daily_project_vault\SJTU-Canvas-Helper-fancy

yarn.cmd lint
yarn.cmd test
yarn.cmd typecheck
cargo check --manifest-path src-tauri\Cargo.toml
cargo test --manifest-path src-tauri\Cargo.toml

$env:NODE_OPTIONS = "--max_old_space_size=4096"

yarn.cmd tauri build `
  --config src-tauri/tauri.local.conf.json `
  --target x86_64-pc-windows-msvc `
  --bundles msi,nsis
```

##### 新电脑、首次克隆或依赖已经变化时

只有首次准备环境或依赖发生变化时，才需要先安装依赖：

```powershell
corepack enable
yarn.cmd install --frozen-lockfile

rustup default stable-msvc
rustup target add x86_64-pc-windows-msvc
cargo fetch --manifest-path src-tauri/Cargo.toml --locked
```

这些命令的含义如下：

| 命令 | 含义 | 是否每次构建都需要 |
| --- | --- | --- |
| `corepack enable` | 启用 Node.js 自带的包管理器代理，使系统可以调用 Yarn | 通常每台电脑一次 |
| `yarn.cmd install --frozen-lockfile` | 严格按照 `yarn.lock` 安装前端依赖，不允许自动改写锁文件 | 首次克隆、锁文件变化或 `node_modules` 损坏时 |
| `rustup default stable-msvc` | 将 Windows Rust 默认工具链设为稳定版 MSVC | 通常每台电脑一次 |
| `rustup target add x86_64-pc-windows-msvc` | 安装 Windows x64 Rust 编译目标 | 通常每台电脑一次 |
| `cargo fetch --locked` | 按 `Cargo.lock` 预先下载 Rust 依赖 | 首次构建或 Rust 依赖变化时，可省略并让构建自动下载 |

`--frozen-lockfile` 的目的主要是让新电脑和 CI 获得可复现的依赖版本，不代表每次本地构建都必须重装依赖。

##### 发布检查的含义

```powershell
yarn.cmd lint
yarn.cmd test
yarn.cmd typecheck

cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

| 命令 | 检查内容 |
| --- | --- |
| `yarn.cmd lint` | 检查前端代码规范和常见错误；警告不会阻止构建，错误会阻止 |
| `yarn.cmd test` | 运行前端 Vitest 测试 |
| `yarn.cmd typecheck` | 执行 TypeScript 类型检查，不生成文件 |
| `cargo check` | 快速检查 Rust 能否编译，不生成最终程序 |
| `cargo test` | 编译并运行 Rust 离线测试；需要真实 Token 或外网的测试会标记为 ignored |

##### 生成本地安装包

PowerShell 中执行：

```powershell
$env:NODE_OPTIONS = "--max_old_space_size=4096"

yarn.cmd tauri build `
  --config src-tauri/tauri.local.conf.json `
  --target x86_64-pc-windows-msvc `
  --bundles msi,nsis
```

各部分含义：

| 命令或参数 | 含义 |
| --- | --- |
| `$env:NODE_OPTIONS = "--max_old_space_size=4096"` | 给前端生产打包最多约 4 GiB Node.js 堆内存，仅影响当前 PowerShell 会话 |
| `yarn.cmd tauri build` | 运行 Tauri release 构建；自动执行配置中的 `yarn build`，然后编译 Rust 并生成安装包 |
| `` ` `` | PowerShell 续行符，表示下一行仍属于同一条命令；也可以把命令写在一行中 |
| `--config src-tauri/tauri.local.conf.json` | 合并仓库内的本地构建配置，关闭 Updater、清空更新地址并禁止生成 Updater 更新产物 |
| `--target x86_64-pc-windows-msvc` | 生成 64 位 Windows MSVC 程序 |
| `--bundles msi,nsis` | 同时生成 MSI 和 NSIS `setup.exe`；也可以只写其中一个 |

当前仓库实际锁定的 `tauri-cli 2.7.1` 没有 `--no-sign` 参数，因此不要添加该参数。项目本地配置没有设置 Windows 代码签名证书，生成的安装包自然是未签名安装包，Windows 可能显示 SmartScreen 警告。

构建不会执行 `git push`、创建标签或上传 GitHub。首次缺少 Yarn、Cargo 或 Tauri 的依赖缓存时，构建仍可能连接 npm/crates.io 下载依赖；“不连接上游”在这里指不连接项目的上游 GitHub 发布渠道。通过 `tauri.local.conf.json` 构建出的应用也不会使用上游 Updater 地址。

安装包输出到：

```text
src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\
src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\
```

只需要 release 可执行文件、不需要安装包时：

```powershell
yarn.cmd tauri build --config src-tauri/tauri.local.conf.json --no-bundle --target x86_64-pc-windows-msvc
```

`--no-bundle` 表示只生成 release 可执行文件，不生成 MSI 或 NSIS 安装包。可执行文件通常位于：

```text
src-tauri\target\x86_64-pc-windows-msvc\release\SJTU Canvas Helper.exe
```

不要通过覆盖 `beforeBuildCommand` 为 `npx vite build` 来绕过 TypeScript 检查。正式 Release 必须先让 `yarn typecheck` 和 `yarn build` 通过；依赖升级产生类型回归时，应修复公开类型引用或锁定依赖版本。

正式生成 Updater 更新包时，不使用 `tauri.local.conf.json`，并先配置第 13 节的密钥：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "C:\安全目录\sjtu-canvas-helper.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "密钥密码"
$env:NODE_OPTIONS = "--max_old_space_size=4096"

yarn tauri build `
  --target x86_64-pc-windows-msvc `
  --bundles msi,nsis
```

Updater 签名不等同于 Windows Authenticode 签名。面向公众分发时仍应配置 Windows 代码签名，否则安装包可能触发 SmartScreen。

如果要通过仓库的 GitHub Actions 一次构建全部平台，应先运行版本同步脚本、检查签名 Secrets 和更新地址，再将已经审核的提交推送到 `release` 分支。推送会立即创建公开 Release，详细步骤见第 14 节。

#### 通用构建流程

```shell
yarn tauri build --config src-tauri/tauri.local.conf.json
```

正式发布时先配置第 13 节的 Updater 私钥和各操作系统签名，然后使用默认配置运行 `yarn tauri build`，不要加载本地配置覆盖文件。

构建过程依次完成：

1. 执行 `yarn build`，TypeScript 检查并把前端写入 `dist/`。
2. Cargo 以 release profile 编译 Rust 主程序。
3. Tauri 嵌入前端资源和权限配置。
4. 将 `python/attendance/` 的四个文件复制到应用资源目录。
5. 生成当前系统支持的安装包和自动更新产物。

不生成安装包、只验证 release 可执行文件：

```shell
yarn tauri build --config src-tauri/tauri.local.conf.json --no-bundle
```

构建与打包分开执行：

```shell
yarn tauri build --config src-tauri/tauri.local.conf.json --no-bundle
yarn tauri bundle --config src-tauri/tauri.local.conf.json
```

默认输出在 `src-tauri/target/release/`。显式使用 `--target <triple>` 时，输出位于 `src-tauri/target/<triple>/release/`；平台安装包位于其 `bundle/` 子目录。

重要：当前安装包只携带 Python 源文件和 `requirements.txt`，不携带 Python 解释器、ddddocr 模型运行环境或 zbar。普通功能不受影响，但最终用户要使用签到守望，仍需安装 Python 和依赖。若要提供完全独立的安装包，需要另行引入受控 Python sidecar，并为每个系统和架构分别构建、签名和打包。

### 9. Windows 打包

Windows 建议在 Windows 主机或 `windows-latest` Runner 上原生构建。Tauri 支持 WiX `.msi` 和 NSIS `-setup.exe`，详见[官方 Windows Installer 文档](https://v2.tauri.app/distribute/windows-installer/)。

以下示例使用本地配置生成未签名安装包；正式发布时不要加载本地配置文件，并应提供签名配置。64 位：

```powershell
rustup target add x86_64-pc-windows-msvc
yarn tauri build --config src-tauri/tauri.local.conf.json --target x86_64-pc-windows-msvc --bundles msi,nsis
```

32 位：

```powershell
rustup target add i686-pc-windows-msvc
yarn tauri build --config src-tauri/tauri.local.conf.json --target i686-pc-windows-msvc --bundles msi,nsis
```

典型输出：

```text
src-tauri/target/<target>/release/bundle/msi/*.msi
src-tauri/target/<target>/release/bundle/nsis/*-setup.exe
```

未签名安装包可以本地运行，但从浏览器下载时通常会触发 SmartScreen。面向公众发布时应配置 Windows 代码签名，参见[Tauri Windows 签名指南](https://v2.tauri.app/distribute/sign/windows/)。

仓库还包含 Windows 便携版 composite action。当前其中的 `disable-updater.mjs` 和 `portable.mjs` 仍访问旧版 Tauri 配置路径 `config.tauri`/`config.package`，在 Tauri 2 配置上使用前应先改为顶层 `plugins`、`bundle`、`version` 和 `productName`；未修复前不要把便携 ZIP 作为发布成功的必要条件。

### 10. macOS 打包

macOS 安装包应在 macOS 主机生成。分别构建 Apple Silicon 和 Intel：

```bash
# Apple Silicon
rustup target add aarch64-apple-darwin
yarn tauri build --config src-tauri/tauri.local.conf.json --target aarch64-apple-darwin --bundles app,dmg

# Intel
rustup target add x86_64-apple-darwin
yarn tauri build --config src-tauri/tauri.local.conf.json --target x86_64-apple-darwin --bundles app,dmg
```

典型输出：

```text
src-tauri/target/<target>/release/bundle/macos/*.app
src-tauri/target/<target>/release/bundle/dmg/*.dmg
```

公开分发到 App Store 之外时，需要 Developer ID Application 签名和 Apple 公证。仅构建出 `.app`/`.dmg` 并不等于已通过 Gatekeeper；请按[Tauri macOS 签名与公证文档](https://v2.tauri.app/distribute/sign/macos/)配置证书。

macOS GUI 应用通常不会继承 shell 启动文件中的完整 `PATH`。因此发布后如果页面找不到 Python，优先让用户填写解释器绝对路径，而不是只填写 `python3`。

### 11. Linux 打包

Linux 通常在目标发行版或兼容的容器/Runner 上构建：

```bash
yarn tauri build --config src-tauri/tauri.local.conf.json --bundles deb,rpm,appimage
```

典型输出：

```text
src-tauri/target/release/bundle/deb/*.deb
src-tauri/target/release/bundle/rpm/*.rpm
src-tauri/target/release/bundle/appimage/*.AppImage
```

`.deb`、`.rpm` 和 AppImage 的运行环境并不完全相同，应至少在对应发行版的干净虚拟机中验证启动、WebKitGTK、文件选择、视频代理和更新流程。AppImage 可选用 GPG 签名，但用户仍需主动验证签名；参见[Tauri Linux 签名说明](https://v2.tauri.app/distribute/sign/linux/)。

`.github/workflows/release.yml` 当前对 Ubuntu 的部分 WebKitGTK 包固定了具体版本。GitHub Runner 镜像升级后这些版本可能消失；若 APT 无法解析，应改为 Runner 当前仓库提供的兼容版本，并重新做 AppImage、DEB 和 RPM 验证。

### 12. 版本号与发布前检查

版本号同时存在于：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `README.md` 下载链接
- `website/` 页面
- `script/install.bat`
- `script/install_mac.sh`

使用同步脚本更新：

```shell
python script/bump_version.py 3.1.0

# 安装了 GNU Make 时也可以使用
make version 3.1.0
```

随后运行 `cargo check --manifest-path src-tauri/Cargo.toml` 更新并核对 `Cargo.lock`，检查 `git diff`，确认所有位置版本一致。

发布前至少完成：

- 所有目标系统完成原生构建。
- 前端 lint、类型检查、测试和生产构建通过。
- Rust fmt、Clippy、离线测试通过；有 Token 时再运行在线测试。
- Python 文件已进入安装包资源目录，且至少验证依赖检测和 QR/OCR 初始化。
- 使用干净系统测试安装、卸载、升级和配置保留。
- 核对安装包架构、版本号、文件名、签名和 SHA-256。
- 确认安装包、更新包和 `latest.json` 中的 URL、平台键与签名匹配。
- 不将 Token、Cookie、密码、私钥、证书或 `.env` 上传为构建产物。

### 13. 自动更新签名

本项目启用了 Tauri Updater，并设置 `createUpdaterArtifacts: "v1Compatible"`。更新包必须使用 updater 私钥签名；这与 Windows Authenticode 或 Apple Developer ID 的操作系统代码签名是两套独立机制。

首次为自己的 fork 建立更新通道时：

```shell
yarn tauri signer generate -w /安全位置/sjtu-canvas-helper.key
```

将生成的公钥填入 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`，私钥绝不能提交到仓库。本地构建可通过以下环境变量提供私钥：

```powershell
# PowerShell
$env:TAURI_SIGNING_PRIVATE_KEY = "私钥文件路径或内容"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "私钥密码"
yarn tauri build
```

```bash
# macOS/Linux
export TAURI_SIGNING_PRIVATE_KEY="私钥文件路径或内容"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="私钥密码"
yarn tauri build
```

官方说明见[Tauri Updater 签名文档](https://v2.tauri.app/plugin/updater/)。丢失私钥后，已安装客户端将无法验证使用原公钥的新更新，因此必须离线备份。

为 fork 建立独立发布渠道时，必须同时替换当前配置中的 `plugins.updater.pubkey` 和 `plugins.updater.endpoints`。公钥、签名私钥、下载域名和 `latest.json` 必须属于同一发布渠道；不要让 fork 的客户端继续从上游仓库下载安装包。

### 14. GitHub Actions 自动分发

`.github/workflows/release.yml` 在代码推送到 `release` 分支时自动运行。矩阵当前覆盖：

- macOS Apple Silicon：`aarch64-apple-darwin`
- macOS Intel：`x86_64-apple-darwin`
- Linux x86_64
- Windows x64：`x86_64-pc-windows-msvc`
- Windows x86：`i686-pc-windows-msvc`

工作流通过 `tauri-action` 创建 `app-v<version>` GitHub Release、上传安装包并生成 `latest.json`。它使用以下 Secrets：

| Secret | 用途 |
| --- | --- |
| `TAURI_PRIVATE_KEY` | Tauri Updater 私钥 |
| `TAURI_KEY_PASSWORD` | Updater 私钥密码 |
| `GITHUB_TOKEN` | 创建 Release 和上传产物，GitHub 自动提供 |

当前工作流没有完整配置 Windows 发行商代码签名和 macOS Developer ID 公证。面向普通用户发布前，应在矩阵任务中补齐各平台证书和公证步骤；Updater 签名不能消除 SmartScreen 或 Gatekeeper 警告。

推荐发布流程：

1. 在功能分支完成开发并合并到 `main`。
2. 运行版本同步脚本并提交版本变更。
3. 在本地或临时 CI 完成全部检查。
4. 将已审核的提交合并到 `release`。
5. 推送 `release` 会立即创建公开 Release，操作前务必再次确认版本和 Secrets。
6. 等待所有平台矩阵完成，逐项下载并进行安装冒烟测试。
7. 确认固定更新地址所需的 `latest` Release/tag 存在，并成功收到新的 `latest.json`。

Tauri 官方的 GitHub Release 流水线示例见[GitHub Actions 分发指南](https://v2.tauri.app/distribute/pipelines/github/)。

### 15. 常见构建问题

| 现象 | 优先检查 |
| --- | --- |
| Windows 找不到 `link.exe`、`rc.exe` | Visual Studio C++ workload、Windows SDK、MSVC Rust toolchain |
| 应用窗口空白或 WebView 创建失败 | WebView2；Linux 的 WebKitGTK 4.1；DevTools Console |
| `localhost:1420` 已被占用 | 结束旧 Vite/Tauri 进程；本项目不会自动换端口 |
| Rust 首次编译很慢 | 保留 `src-tauri/target/`；CI 启用 Rust cache；检查磁盘和杀毒扫描 |
| `yarn build` 在 TypeScript 阶段失败 | 先单独运行 `yarn typecheck`，处理类型或依赖版本，不要跳过发布检查 |
| Rust 测试提示 Token 为空 | 设置测试专用 `CANVAS_TOKEN`，或只运行 mock/离线测试 |
| Python 依赖检测失败 | 确认页面使用的解释器与执行 pip 的解释器完全相同 |
| `pyzbar` 提示找不到 zbar | macOS 安装 `zbar`；Linux 安装发行版的 zbar 运行库 |
| macOS 打包后找不到 Python | 在签到页面配置绝对解释器路径；GUI 不保证继承 shell `PATH` |
| 更新器拒绝安装包 | 检查公钥、私钥、`.sig`、`latest.json` 平台键和下载 URL |
| CI Ubuntu 安装依赖失败 | 检查 Runner 版本与固定的 WebKitGTK 包版本是否仍匹配 |

关于贡献流程、提交规范和 Pull Request 要求，另见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Okabe-Rintarou-0/SJTU-Canvas-Helper&type=Date)](https://star-history.com/#Okabe-Rintarou-0/SJTU-Canvas-Helper&Date)

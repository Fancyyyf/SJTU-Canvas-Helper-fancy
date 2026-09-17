# Python 签到守望模块

本目录保持 `canvas_video_check_in_fancy` 的原始文件层级：

- `nn.py`：截图、二维码识别、循环监听和提示音。
- `surveil.py`：jAccount 登录、验证码 OCR、mLearning token 提取和签到提交。
- `requirements.txt`：Python 依赖。

桌面应用通过环境变量传递学号、密码、扫码登录 Cookie、签到链接和延迟配置，凭据及签到 token 不会写入 Python 源码，也不会出现在进程命令行参数中。Rust/Tauri 不重新实现截图、OCR 或签到逻辑，只负责管理这个 Python 子进程并解析它的状态事件。

## 安装环境

```bash
python -m pip install -r python/attendance/requirements.txt
```

Linux 还需安装系统 `zbar` 库；macOS 可使用 `brew install zbar`。Windows 的 Python 与相关依赖需要和桌面应用运行在同一用户环境中。

桌面页面中的“检测 Python 环境”会检查以下导入：`requests`、`bs4`、`ddddocr`、`PIL`、`pyzbar` 和 `numpy`。`opencv-python` 保留在依赖清单中，以保持原模块的运行环境兼容性。

## 配置变量

| 环境变量 | 用途 | 是否必需 |
| --- | --- | --- |
| `SJTU_ATTENDANCE_JA_AUTH_COOKIE` | 复用应用中的 jAccount 扫码登录态 | 与账号密码二选一 |
| `SJTU_ATTENDANCE_USERNAME` | jAccount 学号 | 密码登录时必需 |
| `SJTU_ATTENDANCE_PASSWORD` | jAccount 密码 | 密码登录时必需 |
| `SJTU_ATTENDANCE_RISK_DELAY_MS` | OCR 后等待再提交登录的毫秒数，限制为 500–5000 | 可选，默认 1000 |
| `SJTU_ATTENDANCE_URL` | 手动调用 `surveil.py` 时的完整签到链接 | 手动提交时必需 |
| `SJTU_ATTENDANCE_INTERVAL_MS` | `nn.py` 的默认扫描间隔，限制为 500–10000 | 可选，默认 1000 |

扫码 Cookie 存在时优先尝试扫码登录态；无法取得 mLearning token 后才回退到账号密码。密码登录会重新获取验证码并最多尝试 3 次，验证码由 `ddddocr` 在本机处理。

## 保留的独立运行方式

持续监听：

```bash
python python/attendance/nn.py --watch
```

扫描一次并输出 JSON：

```bash
python python/attendance/nn.py --scan-once --json
```

提交指定签到链接（PowerShell）：

```powershell
$env:SJTU_ATTENDANCE_USERNAME = "学号"
$env:SJTU_ATTENDANCE_PASSWORD = "密码"
$env:SJTU_ATTENDANCE_URL = "完整签到链接"
python python/attendance/surveil.py
```

也可以显式使用 `--url "完整签到链接"`，但这种独立运行方式会让链接出现在系统进程参数中，因此桌面集成默认使用环境变量。

## JSON Lines 协议

应用集成使用 `--json`：每行一个 UTF-8 JSON 对象。`nn.py` 可能发出 `started`、`scan`、`detected`、`duplicate`、`info`、`success`、`failed`、`error`、`stopped` 和 `scan_result`；`surveil.py` 返回 `result`。普通诊断信息不会包含密码、Cookie 或完整 token。

成功链接 10 分钟内会跳过重复提交，失败链接 30 秒后可再次尝试。截图仅在 Python 进程内存中解码，不保存到磁盘。完整登录或签到仍需要有效账号、有效课堂二维码和学校网络接口，无法在无账号环境中做端到端验证。

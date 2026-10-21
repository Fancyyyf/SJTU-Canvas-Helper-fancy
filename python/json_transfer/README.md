# 字幕工作台原始工具

这里保留从 `json_transfer` 迁入的 Python 抓取、转换与本地网页代码。应用侧的新“字幕工作台”标签已经使用 Tauri 的视频登录会话和字幕接口，日常使用无需启动 Python 服务。

原始的 32 份 JSON 和 32 份 TXT 位于 `public/subtitle_archive/json_data/` 与 `public/subtitle_archive/results/`，原始 JSON 字段完整保留。应用中的字幕工作台会把资料复制到“系统设置 → 文件下载保存目录”下的 `字幕工作台/<课程>/`，分为 `01_原始JSON`、`02_提取TXT`、`03_Agent整理`。此前版本写入应用数据目录的字幕也会在打开工作台时迁入新目录，旧文件仍保留作备份。

需要独立运行原始工具时，在仓库根目录执行：

```powershell
python -m pip install -r python/json_transfer/requirements.txt
python python/json_transfer/app.py
```

然后打开 <http://127.0.0.1:8765/>。独立工具通过 Playwright 调用 Edge，第一次使用时需在弹出的浏览器中登录 Canvas。命令行抓取也可以运行 `python python/json_transfer/fetch_course.py <play-center 播放地址> --name <前缀>`；仅转换本地 JSON 时运行 `python python/json_transfer/transfer.py`。

Python 工具和应用使用同一份 `public/subtitle_archive/` 资料目录。若用 Python 工具增加 JSON，需同步更新 `public/subtitle_archive/manifest.json`，才能在应用标签中看到新增资料。

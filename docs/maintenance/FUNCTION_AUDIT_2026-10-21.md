# 功能核对与测试记录（2026-10-21）

## 本次修复

- 启动时先从 Tauri 读取保存的配置，再挂载 React。之前首帧使用默认绿色，随后某个页面调用 `getConfig` 才切换到保存的紫色；本机保存的主色为 `#1500b8`。
- 日程管理新增“全部 / 已完成 / 未完成”作业筛选，月历、所选日期和七日内事项使用同一筛选。课程作业接口的个人提交状态优先于 Canvas 日历接口的简略事项，避免去重时丢失状态。无需提交的作业归为已完成。
- 录像主副屏同步改为双向同步进度、播放暂停和速度；拖动任一进度条会更新另一屏，播放偏差超过 0.4 秒时以主屏时钟校正。关闭同步后仍可保留两屏各自状态。
- 侧边栏长按图标可拖动排序，拖到顶部出现的移除区可隐藏该入口。顺序沿用现有本地存储，首页仍固定；隐藏入口仍可从首页重新勾选。
- 修复全新配置目录只创建账户索引、不创建默认账户配置的问题；首次安装后切回默认账户现在可正常工作。

## 合并功能回归

前端全量测试：35 个文件、156 项通过。覆盖原有视频工作区、下载与任务、字幕归档、登录与路由等路径，以及本次新增的启动主题、侧边栏拖放、双屏同步、日程筛选测试。Rust 常规测试：84 项通过、14 项按需忽略。生产前端构建、TypeScript 类型检查、`cargo check --locked` 均通过。ESLint 为 0 错误、59 条既有警告；Vite 对上游依赖和大文件给出警告，构建成功。

## 14 项按需测试逐项结果

以下测试以本机保存的 Canvas token 和 jAccount cookie 运行，未在日志或文档输出凭据。账户测试使用 `SJTU_CANVAS_TEST_CONFIG_DIR` 指向隔离目录，没有改动现用账户文件。

| 测试 | 结果 | 核对内容或限制 |
| --- | --- | --- |
| `client::basic::test::test_get_me` | 通过 | 当前用户信息 |
| `client::basic::test::test_list_courses` | 通过 | 课程列表；移除“每门课必能读取教师名单”的错误断言，学生 token 可能没有该权限 |
| `client::basic::test::test_list_assignments` | 通过 | 各课程作业和日期 |
| `client::basic::test::test_list_users` | 通过 | 有权限课程的成员读取 |
| `client::basic::test::test_list_submissions` | 通过 | 有权限课程的提交读取 |
| `client::basic::test::test_list_colors` | 通过 | 课程颜色 |
| `app::test::test_get_calendar_events` | 通过 | 当前日期范围；测试改用应用实际使用的 UTC `Z` 格式，避免 URL 中 `+` 被解析为空格 |
| `app::test::test_filter_course_qrcode` | 通过 | 从当前可访问课程选择，而非写死旧课程号 |
| `app::test::test_video_apis` | 通过 | 旧视频服务登录和播放元数据；不再下载整段录像，下载路径由本地模拟测试覆盖 |
| `app::test::test_video_apis_with_canvas` | 通过 | Canvas 录像列表和播放元数据；选择确有录像的课程 |
| `app::test::test_jbox_apis` | 通过 | JBox 登录和个人空间信息；未在云盘创建目录或上传旧课程文件 |
| `app::test::test_account` | 通过 | 隔离目录中的创建、切换、删除账户；同时暴露并修复首次初始化问题 |
| `client::video::tests::test_get_uuid` | 通过 | 真实认证服务 UUID |
| `app::ppt_audit::audit_ppt_pages_from_snapshot` | 未运行 | 需要用户提供 `SJTU_PPT_AUDIT_INPUT` 与 `SJTU_PPT_AUDIT_OUTPUT`，仓库没有可用的真实服务快照；这是离线审计测试，不是实时服务调用 |

## 尚未现场验证的交互

本次没有安装新版本进行人工双屏播放和触屏拖拽体验测试，也没有向 JBox 实际上传文件。自动测试覆盖相应状态和事件路径；现场体验仍需在应用中验证。不生成新的 release。

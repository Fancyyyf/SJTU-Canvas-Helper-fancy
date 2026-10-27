# Canvas Agent 工具清单

Agent 仅操作当前 App 账号。个人日程保存在本机配置目录，首次使用时从原有浏览器 `localStorage` 迁移。Canvas 作业状态来自 App 已同步的本地缓存，返回结果标明缓存时间；没有缓存时不能声称作业清单完整。

每次用户发送消息时，前端把发送时的本机时间与 UTC 偏移传给 Agent。作业截止、DDL、待办或日程语境下，未限定方向的“最近 7 天”按从发送时刻起的未来 7 天处理；用户明确指定过去或其他范围时按其要求处理。

## 日程管理

| Tool | 能力 | 边界 |
| --- | --- | --- |
| `list_local_calendar_items` | 按时间范围读取个人日程与 Canvas 作业截止时间、提交状态 | 最长 366 天；每类最多返回 200 项，超出时标记 `truncated`；不触发网络同步 |
| `create_personal_event` | 创建本地个人日程 | 仅响应用户明确创建请求；要求带时区的开始和结束时间 |
| `update_personal_event` | 修改本地个人日程 | 先查询精确 ID；提供完整修改后内容；不能修改 Canvas 作业 |
| `delete_personal_event` | 删除本地个人日程 | 仅响应用户明确删除请求；先查询精确 ID；不能删除 Canvas 作业 |

## Canvas 只读查询

| 范围 | Tools |
| --- | --- |
| 课程与当前用户 | `list_courses`, `get_me`, `get_colors` |
| 作业与当前用户提交 | `list_course_assignments`, `get_my_single_submission` |
| 文件与模块 | `list_course_files`, `list_course_folders`, `list_folder_files`, `list_folder_folders`, `list_my_folders`, `get_folder_by_id`, `list_course_images`, `list_external_module_items` |
| 讨论 | `list_discussion_topics`, `get_full_discussion` |
| Canvas 原始日历查询 | `list_calendar_events`；一般日程问题应优先使用本地日历工具 |

默认工具集中不包含课程成员名单、其他学生的提交与成绩，也不包含 Canvas 提交/评分/删除、账号切换、任意文件读写或外部服务写入。Canvas 作业缓存由 App 启动时同步或日历页的“更新 Canvas”按钮刷新；Agent 的本地日程工具不执行这些网络操作。

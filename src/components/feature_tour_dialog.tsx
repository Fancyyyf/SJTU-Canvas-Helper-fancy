import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

const pages = [
  {
    title: "开始使用",
    modules: [
      { name: "系统设置", path: "/settings", action: "填写 Canvas Token 并测试连接；视频和课表按提示完成校园网页登录。" },
      { name: "首页与学期", path: "/home", action: "在首页选择学期范围，再进入课程、作业等页面。" },
      { name: "账号管理", path: "/settings", action: "在系统设置中切换账号，切换后确认当前用户信息。" },
    ],
  },
  {
    title: "作业与日程",
    modules: [
      { name: "作业列表", path: "/assignments", action: "选择课程，查看作业详情、截止时间和提交状态。" },
      { name: "TODO 与提醒", path: "/todo", action: "添加个人待办或同步 Canvas 作业；点击“开启系统提醒”接收通知。" },
      { name: "日程管理与课表", path: "/calendar", action: "完成 jAccount 登录后导入课表；切换周／月视图，点击日期管理个人事件。" },
    ],
  },
  {
    title: "课程资料",
    modules: [
      { name: "文件管理", path: "/files", action: "选课后浏览文件夹，预览或下载课程文件。" },
      { name: "视频管理", path: "/video", action: "选课并打开视频，可播放、下载或查看字幕。" },
      { name: "字幕工作台", path: "/subtitle-archive", action: "打开已有字幕，检索内容或整理归档。" },
      { name: "讨论管理", path: "/discussions", action: "选择课程，打开主题查看完整讨论。" },
      { name: "教学大纲", path: "/syllabus", action: "选择课程，查看大纲和课程说明。" },
    ],
  },
  {
    title: "课堂与教学",
    modules: [
      { name: "签到守望", path: "/attendance", action: "确认课堂与登录状态后，设置签到监测并查看结果。" },
      { name: "二维码管理", path: "/qrcode", action: "选择课程，扫描课程图片中的二维码。" },
      { name: "成绩管理", path: "/grades", action: "教师或助教选课，查看成绩或导出成绩表。" },
      { name: "提交批改", path: "/submissions", action: "选课并选择作业，下载提交或进行批改。" },
      { name: "成员导出", path: "/users", action: "选择课程成员，再导出所需名单。" },
    ],
  },
  {
    title: "智能工具与更多",
    modules: [
      { name: "Canvas Agent", path: "/agent", action: "选择内置或 Pi Agent 后提问；Pi 沿用当前 API Key，需本机安装 pi。" },
      { name: "网页搜索", path: "/web-search", action: "输入 Brave Search API Key 和关键词后搜索。" },
      { name: "年度总结", path: "/annual", action: "选择年度并生成学习报告。" },
      { name: "进阶教程", path: "/guide", action: "需要 CLI、MCP 或连接诊断时，打开完整教程。" },
    ],
  },
] as const;

export function FeatureTourDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const close = () => {
    onClose();
    setPageIndex(0);
  };
  const page = pages[pageIndex];

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="feature-tour-title">
      <DialogTitle id="feature-tour-title">
        <Stack direction="row" spacing={1} alignItems="center">
          <MenuBookRoundedIcon color="primary" />
          <Typography component="span" variant="h6">功能使用指南</Typography>
        </Stack>
      </DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>{page.title}</Typography>
      <LinearProgress variant="determinate" value={((pageIndex + 1) / pages.length) * 100} aria-label="阅读进度" />
      <DialogContent dividers>
        <Stack spacing={1.25} sx={{ minHeight: 300 }}>
          {page.modules.map((module) => (
            <Card key={module.name} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{module.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{module.action}</Typography>
                </Box>
                <Button component={RouterLink} to={module.path} onClick={close} size="small" sx={{ flexShrink: 0 }}>
                  打开
                </Button>
              </Stack>
            </Card>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">第 {pageIndex + 1} / {pages.length} 页</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackRoundedIcon />} disabled={pageIndex === 0}
            onClick={() => setPageIndex((value) => value - 1)}>上一页</Button>
          {pageIndex === pages.length - 1
            ? <Button variant="contained" onClick={close}>完成</Button>
            : <Button variant="contained" endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => setPageIndex((value) => value + 1)}>下一页</Button>}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SmartDisplayRoundedIcon from "@mui/icons-material/SmartDisplayRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import BasicLayout from "../components/layout";
import { WorkspaceHero } from "../components/workspace_hero";
import {
  useAllCourses,
  useConfigDispatch,
  useConfigSelector,
  useMe,
  useTermFilter,
} from "../lib/hooks";
import { logDiagnostic } from "../lib/logger";
import { LOG_LEVEL_INFO } from "../lib/model";
import { surfaceCardSx } from "../lib/styles";
import { navigationSlice } from "../lib/store";
import { filterCoursesByTerm, formatTermName } from "../lib/term";

const featureEntries = [
  {
    title: "Canvas Agent",
    description: "使用 AI 查询课程信息、整理任务并辅助理解课程内容。",
    path: "/agent",
    icon: <PsychologyRoundedIcon />,
  },
  {
    title: "签到守望",
    description: "检测课堂签到二维码并管理扫码或账号登录状态。",
    path: "/attendance",
    icon: <HowToRegRoundedIcon />,
  },
  {
    title: "作业列表",
    description: "按课程或当前学期全部课程查看作业与提交状态。",
    path: "/assignments",
    icon: <AssignmentRoundedIcon />,
  },
  {
    title: "文件管理",
    description: "浏览、预览、下载课程文件并使用 AI 辅助阅读。",
    path: "/files",
    icon: <FolderRoundedIcon />,
  },
  {
    title: "日程管理",
    description: "集中查看当前学期范围内的课程事件和截止日期。",
    path: "/calendar",
    icon: <CalendarMonthRoundedIcon />,
  },
  {
    title: "视频管理",
    description: "播放课程视频、查看字幕、下载视频和课件。",
    path: "/video",
    icon: <SmartDisplayRoundedIcon />,
  },
  {
    title: "讨论管理",
    description: "查看课程讨论主题与完整讨论内容。",
    path: "/discussions",
    icon: <ForumRoundedIcon />,
  },
  {
    title: "成员导出",
    description: "浏览课程成员并将选中成员或完整名单导出。",
    path: "/users",
    icon: <GroupsRoundedIcon />,
  },
  {
    title: "成绩管理",
    description: "查看成绩统计、录入评分并导出课程成绩表。",
    path: "/grades",
    icon: <FactCheckRoundedIcon />,
  },
  {
    title: "提交批改",
    description: "批量下载学生提交、预览附件、评论和评分。",
    path: "/submissions",
    icon: <CloudDownloadRoundedIcon />,
  },
  {
    title: "教学大纲",
    description: "快速切换课程并查看对应的教学大纲。",
    path: "/syllabus",
    icon: <AutoStoriesRoundedIcon />,
  },
  {
    title: "二维码管理",
    description: "扫描课程图片中的二维码并集中查看识别结果。",
    path: "/qrcode",
    icon: <QrCode2RoundedIcon />,
  },
  {
    title: "年度总结",
    description: "按年度汇总课程活动并生成个人学习报告。",
    path: "/annual",
    icon: <TimelineRoundedIcon />,
  },
  {
    title: "系统设置",
    description: "管理 Canvas Token、登录态、下载目录和外观设置。",
    path: "/settings",
    icon: <SettingsRoundedIcon />,
  },
];

export default function HomePage() {
  const theme = useTheme();
  const dispatch = useConfigDispatch();
  const visibleSidebarItemKeys = useConfigSelector(
    (state) => state.navigation.visibleItemKeys
  );
  const [customizeSidebarOpen, setCustomizeSidebarOpen] = useState(false);
  const allCourses = useAllCourses();
  const me = useMe();
  const { selectedTermId, setSelectedTermId, terms } = useTermFilter(
    allCourses.data
  );
  const scopedCourses = useMemo(
    () => filterCoursesByTerm(allCourses.data, selectedTermId),
    [allCourses.data, selectedTermId]
  );
  const teacherCourseCount = scopedCourses.filter((course) =>
    course.enrollments.some(
      (enrollment) =>
        enrollment.role === "TeacherEnrollment" ||
        enrollment.role === "TaEnrollment"
    )
  ).length;
  const selectedTerm = terms.find((term) => term.id === selectedTermId);
  const identityPending = me.isLoading || (!me.data && !me.error);
  const identityDetail = identityPending
    ? "正在读取 Canvas 个人信息…"
    : me.data?.login_id ||
      me.data?.email ||
      (me.data
        ? `Canvas 用户 ID：${me.data.id}`
        : "Canvas 个人信息读取失败，请检查 API Token");

  const updateVisibleSidebarItems = (nextKeys: string[]) => {
    dispatch(navigationSlice.actions.setVisibleItemKeys(nextKeys));
    logDiagnostic({
      level: LOG_LEVEL_INFO,
      code: "NAVIGATION.SIDEBAR_ITEMS_CHANGED",
      scope: "home",
      action: "customize_sidebar",
      outcome: "success",
      recoverable: true,
      context: { visibleItemKeys: nextKeys, visibleItemCount: nextKeys.length },
    });
  };

  return (
    <BasicLayout>
      <Stack spacing={3}>
        <WorkspaceHero
          chipLabel="首页"
          chipIcon={<HomeRoundedIcon />}
          title={`欢迎${
            me.data?.name ? `，${me.data.name}` : "使用 Canvas Helper"
          }`}
          description="从这里选择本次浏览的学期范围。课程、作业、文件、视频、成绩等页面会同步使用同一筛选。"
          stats={[
            { label: "当前范围课程", value: scopedCourses.length },
            { label: "可选学期", value: terms.length },
            { label: "任课 / 助教课程", value: teacherCourseCount },
          ]}
          aside={
            <Card
              sx={{
                ...surfaceCardSx,
                width: { xs: "100%", lg: 430 },
                bgcolor: alpha(theme.palette.background.paper, 0.78),
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar
                      sx={{ bgcolor: "primary.main", width: 48, height: 48 }}
                    >
                      {me.data?.name?.slice(0, 1) ?? (
                        <AccountCircleRoundedIcon />
                      )}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 800 }}
                        noWrap
                      >
                        {me.data?.name ?? "Canvas 用户"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {identityDetail}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      size="small"
                      color={
                        me.data ? "success" : me.error ? "warning" : "default"
                      }
                      variant={me.data ? "filled" : "outlined"}
                      label={
                        me.data
                          ? "Canvas API 已连接"
                          : me.error
                          ? "Canvas API 未连接"
                          : "正在检查 Canvas API"
                      }
                    />
                    {me.data?.email ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={me.data.email}
                      />
                    ) : null}
                  </Stack>
                  {me.error ? (
                    <Typography variant="caption" color="text.secondary">
                      二维码登录态用于视频等扩展服务；首页个人信息和课程数据需要单独配置有效的
                      Canvas API Token。
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          }
        />

        <Card sx={surfaceCardSx}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2.25}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  全局学期范围
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  选择后立即作用于所有课程型页面，并在下次启动时恢复。选择“全部学期”会显示历史课程。
                </Typography>
              </Box>
              <TextField
                select
                fullWidth
                label="浏览学期"
                value={selectedTermId ?? ""}
                disabled={allCourses.isLoading || terms.length === 0}
                onChange={(event) => {
                  const value = event.target.value;
                  const nextSelection = value === "all" ? "all" : Number(value);
                  setSelectedTermId(nextSelection);
                  logDiagnostic({
                    level: LOG_LEVEL_INFO,
                    code: "COURSE.TERM_FILTER_CHANGED",
                    scope: "home",
                    action: "select_term_scope",
                    outcome: "success",
                    recoverable: true,
                    context: { selectedTermId: nextSelection },
                  });
                }}
                InputProps={{
                  startAdornment: (
                    <SchoolRoundedIcon color="action" sx={{ mr: 1 }} />
                  ),
                }}
                helperText={
                  selectedTermId === "all"
                    ? `当前包含全部 ${allCourses.data.length} 门课程`
                    : selectedTerm
                    ? `${formatTermName(selectedTerm.name)} · ${
                        selectedTerm.courseCount
                      } 门课程`
                    : "正在识别最近学期"
                }
              >
                <MenuItem value="all">全部学期（包含历史课程）</MenuItem>
                {terms.map((term) => (
                  <MenuItem key={term.id} value={term.id}>
                    {formatTermName(term.name)}（{term.courseCount} 门）
                  </MenuItem>
                ))}
              </TextField>
              {allCourses.error ? (
                <Alert severity="error">
                  课程加载失败，请检查 Canvas Token 或网络连接。
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75 }}>
                功能目录
              </Typography>
              <Typography variant="body2" color="text.secondary">
                当前范围：
                {selectedTermId === "all"
                  ? "全部学期"
                  : formatTermName(selectedTerm?.name ?? "最近学期")}
                。这里始终保留全部功能入口。
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<DashboardCustomizeRoundedIcon />}
              onClick={() => setCustomizeSidebarOpen(true)}
              sx={{ flexShrink: 0 }}
            >
              自定义侧边栏
            </Button>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, 1fr)",
                xl: "repeat(3, 1fr)",
              },
              gap: 2,
            }}
          >
            {featureEntries.map((feature) => (
              <Card key={feature.path} sx={surfaceCardSx}>
                <CardActionArea
                  component={Link}
                  to={feature.path}
                  sx={{ height: "100%" }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack
                      direction="row"
                      spacing={1.75}
                      alignItems="flex-start"
                    >
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: "12px",
                          display: "grid",
                          placeItems: "center",
                          color: "primary.main",
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          flexShrink: 0,
                        }}
                      >
                        {feature.icon}
                      </Box>
                      <Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 800 }}
                          >
                            {feature.title}
                          </Typography>
                          {visibleSidebarItemKeys.includes(
                            feature.path.slice(1)
                          ) ? (
                            <Chip
                              size="small"
                              variant="outlined"
                              label="侧边栏快捷入口"
                            />
                          ) : null}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {feature.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>
      </Stack>

      <Dialog
        open={customizeSidebarOpen}
        onClose={() => setCustomizeSidebarOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>自定义侧边栏快捷入口</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            首页会固定显示。你可以只把常用功能放到侧边栏；未选择的功能仍可从首页目录进入。
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 0.5,
            }}
          >
            {featureEntries.map((feature) => {
              const featureKey = feature.path.slice(1);
              return (
                <FormControlLabel
                  key={feature.path}
                  control={
                    <Checkbox
                      checked={visibleSidebarItemKeys.includes(featureKey)}
                      onChange={(event) => {
                        const nextKeys = event.target.checked
                          ? [...visibleSidebarItemKeys, featureKey]
                          : visibleSidebarItemKeys.filter(
                              (key) => key !== featureKey
                            );
                        updateVisibleSidebarItems(nextKeys);
                      }}
                    />
                  }
                  label={feature.title}
                  sx={{
                    m: 0,
                    px: 0.5,
                    borderRadius: 1,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                />
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() =>
              updateVisibleSidebarItems(
                featureEntries.map((feature) => feature.path.slice(1))
              )
            }
          >
            全部显示
          </Button>
          <Button onClick={() => updateVisibleSidebarItems([])}>
            全部隐藏
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            onClick={() => setCustomizeSidebarOpen(false)}
          >
            完成
          </Button>
        </DialogActions>
      </Dialog>
    </BasicLayout>
  );
}

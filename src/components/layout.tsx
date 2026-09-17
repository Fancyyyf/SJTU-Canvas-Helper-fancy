import { getVersion } from "@tauri-apps/api/app";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SmartDisplayRoundedIcon from "@mui/icons-material/SmartDisplayRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import DeveloperBoardRoundedIcon from "@mui/icons-material/DeveloperBoardRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useAppMessage } from "../lib/message";
import { logDiagnostic, logHandledError } from "../lib/logger";
import { LOG_LEVEL_INFO } from "../lib/model";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useConfigDispatch, useConfigSelector, useKeyPress } from "../lib/hooks";
import { navigationSlice } from "../lib/store";
import { checkForUpdates } from "../lib/utils";
import { ChangeLogModal } from "./change_log_modal";

const drawerWidth = 272;
const collapsedDrawerWidth = 92;

const navigationItems = [
  { key: "home", label: "首页", icon: <HomeRoundedIcon />, path: "/home" },
  { key: "agent", label: "Canvas Agent", icon: <PsychologyRoundedIcon />, path: "/agent" },
  { key: "attendance", label: "签到守望", icon: <HowToRegRoundedIcon />, path: "/attendance" },
  { key: "files", label: "文件管理", icon: <ArticleRoundedIcon />, path: "/files" },
  { key: "assignments", label: "作业列表", icon: <AssignmentRoundedIcon />, path: "/assignments" },
  { key: "discussions", label: "讨论管理", icon: <ForumRoundedIcon />, path: "/discussions" },
  { key: "calendar", label: "日程管理", icon: <CalendarMonthRoundedIcon />, path: "/calendar" },
  { key: "users", label: "成员导出", icon: <GroupsRoundedIcon />, path: "/users" },
  { key: "grades", label: "成绩管理", icon: <FactCheckRoundedIcon />, path: "/grades" },
  { key: "submissions", label: "提交批改", icon: <CloudDownloadRoundedIcon />, path: "/submissions" },
  { key: "syllabus", label: "教学大纲", icon: <AutoStoriesRoundedIcon />, path: "/syllabus" },
  { key: "video", label: "视频管理", icon: <SmartDisplayRoundedIcon />, path: "/video" },
  { key: "qrcode", label: "二维码管理", icon: <QrCode2RoundedIcon />, path: "/qrcode" },
  { key: "annual", label: "年度总结", icon: <TimelineRoundedIcon />, path: "/annual" },
  { key: "settings", label: "系统设置", icon: <SettingsRoundedIcon />, path: "/settings" },
];

const pageTitleMap: Record<string, string> = {
  home: "首页",
  agent: "Canvas Agent",
  attendance: "签到守望",
  files: "文件管理",
  assignments: "作业列表",
  discussions: "讨论管理",
  calendar: "日程管理",
  users: "成员导出",
  grades: "成绩管理",
  submissions: "提交批改",
  syllabus: "教学大纲",
  video: "视频管理",
  qrcode: "二维码管理",
  annual: "年度总结",
  settings: "系统设置",
  debug: "Debug 控制台",
};

export default function BasicLayout({ children }: React.PropsWithChildren) {
  const theme = useTheme();
  const dispatch = useConfigDispatch();
  const config = useConfigSelector((state) => state.config.data);
  const visibleSidebarItemKeys = useConfigSelector(
    (state) => state.navigation.visibleItemKeys
  );
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const isCompactWindow = useMediaQuery(theme.breakpoints.down("sm"));
  const location = useLocation();
  const currentKey = location.pathname.split("/").filter(Boolean).pop() || "home";
  const currentTitle = pageTitleMap[currentKey] || "Canvas";
  const [version, setVersion] = useState("");
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [customizeSidebarOpen, setCustomizeSidebarOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [scale, setScale] = useState(1);
  const [messageApi, contextHolder] = useAppMessage();

  useEffect(() => {
    getVersion().then((value) => setVersion(value));
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setMobileOpen(false);
    }
  }, [isDesktop, location.pathname]);

  const handleOpenFeedback = async () => {
    try {
      await openExternal("mailto:923048992@sjtu.edu.cn");
    } catch (error) {
      logHandledError({
        code: "SHELL.OPEN_FEEDBACK_FAILED",
        scope: "layout",
        action: "open_feedback_mail",
        error,
        userMessage: "未能打开反馈邮箱，请确认系统已配置邮件客户端。",
        recoverable: true,
        fallback: { used: true, strategy: "show_manual_guidance", result: "success" },
      });
      messageApi.error("未能打开反馈邮箱，请确认系统已配置邮件客户端。");
    }
  };

  const zoomIn = () => setScale((prevScale) => prevScale + 0.1);
  const zoomOut = () => setScale((prevScale) => Math.max(0.1, prevScale - 0.1));

  useKeyPress("=", zoomIn);
  useKeyPress("-", zoomOut);

  const effectiveDrawerWidth = useMemo(() => {
    if (!isDesktop) {
      return isCompactWindow ? 244 : drawerWidth;
    }
    return collapsed ? collapsedDrawerWidth : drawerWidth;
  }, [collapsed, isCompactWindow, isDesktop]);


  const displayedNavigationItems = useMemo(() => {
    const visibleItems = navigationItems.filter(
      (item) => item.key === "home" || visibleSidebarItemKeys.includes(item.key)
    );
    if (!config?.debug_mode) {
      return visibleItems;
    }
    const debugItem = {
      key: "debug",
      label: "Debug 控制台",
      icon: <DeveloperBoardRoundedIcon />,
      path: "/debug",
    };
    const settingsIndex = visibleItems.findIndex((item) => item.key === "settings");
    if (settingsIndex < 0) return [...visibleItems, debugItem];
    return [
      ...visibleItems.slice(0, settingsIndex),
      debugItem,
      ...visibleItems.slice(settingsIndex),
    ];
  }, [config?.debug_mode, visibleSidebarItemKeys]);

  const updateVisibleSidebarItems = (nextKeys: string[]) => {
    dispatch(navigationSlice.actions.setVisibleItemKeys(nextKeys));
    logDiagnostic({
      level: LOG_LEVEL_INFO,
      code: "NAVIGATION.SIDEBAR_ITEMS_CHANGED",
      scope: "layout",
      action: "customize_sidebar",
      outcome: "success",
      recoverable: true,
      context: { visibleItemKeys: nextKeys, visibleItemCount: nextKeys.length },
    });
  };

  const customizeSidebarButton = (
    <ListItemButton
      onClick={() => setCustomizeSidebarOpen(true)}
      sx={{
        minHeight: 42,
        px: collapsed && isDesktop ? 1.25 : 1.5,
        borderRadius: "12px",
        justifyContent: collapsed && isDesktop ? "center" : "flex-start",
        color: "text.secondary",
        border: "1px dashed",
        borderColor: "divider",
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: collapsed && isDesktop ? 0 : 38,
          color: "inherit",
          justifyContent: "center",
        }}
      >
        <DashboardCustomizeRoundedIcon />
      </ListItemIcon>
      {collapsed && isDesktop ? null : (
        <ListItemText
          primary="编辑侧边栏"
          secondary={`${visibleSidebarItemKeys.length} 个快捷入口`}
          primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
          secondaryTypographyProps={{ fontSize: 11 }}
        />
      )}
    </ListItemButton>
  );

  const drawerContent = (
    <Stack
      sx={{
        height: "100%",
        width: "100%",
        p: 2,
        gap: 2,
        overflowX: "hidden",
        overflowY: "auto",
        color: "text.primary",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{
              minWidth: 0,
              opacity: collapsed && isDesktop ? 0 : 1,
              transition: "opacity 0.2s ease",
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: "10px",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                color: "primary.main",
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                "& svg": { fontSize: 20 },
              }}
            >
              <GridViewRoundedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Canvas Helper
              </Typography>
            </Box>
          </Stack>

          {isDesktop ? (
            <IconButton onClick={() => setCollapsed((prev) => !prev)} size="small">
              {collapsed ? <ChevronRightRoundedIcon /> : <ChevronLeftRoundedIcon />}
            </IconButton>
          ) : (
            <IconButton onClick={() => setMobileOpen(false)} size="small">
              <ChevronLeftRoundedIcon />
            </IconButton>
          )}
        </Stack>

        <List sx={{ p: 0, display: "grid", gap: 0.5 }}>
          {displayedNavigationItems.map((item, index) => {
            const selected = currentKey === item.key;
            const button = (
              <ListItemButton
                key={item.key}
                component={Link}
                to={item.path}
                selected={selected}
                className="nav-enter"
                style={{ "--rise-delay": `${index * 30}ms` } as React.CSSProperties}
                sx={{
                  minHeight: 42,
                  px: collapsed && isDesktop ? 1.25 : 1.5,
                  py: 0.5,
                  borderRadius: "12px",
                  justifyContent: collapsed && isDesktop ? "center" : "flex-start",
                  color: selected ? "primary.main" : "inherit",
                  transition:
                    "background-color 0.18s ease, color 0.18s ease, transform 0.18s ease",
                  "&:hover": {
                    transform: "translateX(2px)",
                  },
                  "&.Mui-selected": {
                    bgcolor: "action.selected",
                    color: "primary.main",
                    fontWeight: 700,
                    "&:hover": {
                      bgcolor: "action.selected",
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed && isDesktop ? 0 : 38,
                    color: "inherit",
                    justifyContent: "center",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {collapsed && isDesktop ? null : (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: 14.5,
                      fontWeight: selected ? 700 : 500,
                      letterSpacing: "0.02em",
                      lineHeight: 1.45,
                      noWrap: true,
                    }}
                  />
                )}
              </ListItemButton>
            );

            return collapsed && isDesktop ? (
              <Tooltip key={item.key} title={item.label} placement="right">
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </List>

        {collapsed && isDesktop ? (
          <Tooltip title="编辑侧边栏" placement="right">
            {customizeSidebarButton}
          </Tooltip>
        ) : (
          customizeSidebarButton
        )}

        <Box sx={{ flex: 1 }} />

        <Divider sx={{ mt: 0.5 }} />

        <Stack
          spacing={1}
          sx={{
            pb: `calc(12px + env(safe-area-inset-bottom, 0px))`,
            pt: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            v{version || "…"} · Canvas Helper
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            flexWrap="wrap"
            useFlexGap
            justifyContent="space-between"
          >
            <Button onClick={() => checkForUpdates(messageApi)} size="small" sx={{ minWidth: 0, px: 1 }}>
              检查更新
            </Button>
            <Button onClick={() => setShowChangeLog(true)} size="small" sx={{ minWidth: 0, px: 1 }}>
              更新日志
            </Button>
            <Button onClick={() => void handleOpenFeedback()} size="small" sx={{ minWidth: 0, px: 1 }}>
              反馈
            </Button>
          </Stack>
        </Stack>
      </Stack>
    );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {contextHolder}

      <Drawer
        variant={isDesktop ? "permanent" : "temporary"}
        open={isDesktop ? true : mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: effectiveDrawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: effectiveDrawerWidth,
            border: "none",
            boxSizing: "border-box",
            backgroundColor: "background.paper",
            overflow: "hidden",
            borderRadius: 0,
            transition: theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          p: { xs: 1.5, md: 2.5 },
        }}
      >
        {!isDesktop ? (
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <IconButton onClick={() => setMobileOpen(true)}>
              <MenuRoundedIcon />
            </IconButton>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {currentTitle}
            </Typography>
            <Box sx={{ width: 40 }} />
          </Stack>
        ) : null}

        <Box
          key={location.pathname}
          className="page-enter"
          sx={{
            p: { xs: 1.5, md: 2.5 },
            minHeight: "calc(100vh - 32px)",
            borderRadius: "16px",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            zoom: scale,
            transformOrigin: "top left",
          }}
        >
          {children}
        </Box>
      </Box>

      <ChangeLogModal
        open={showChangeLog}
        onCancel={() => setShowChangeLog(false)}
        onOk={() => setShowChangeLog(false)}
      />

      <Dialog
        open={customizeSidebarOpen}
        onClose={() => setCustomizeSidebarOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>自定义侧边栏快捷入口</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            首页始终保留。未固定到侧边栏的功能仍可从首页功能目录进入。
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
              gap: 0.5,
            }}
          >
            {navigationItems.slice(1).map((item) => (
              <FormControlLabel
                key={item.key}
                control={
                  <Checkbox
                    checked={visibleSidebarItemKeys.includes(item.key)}
                    onChange={(event) => {
                      const nextKeys = event.target.checked
                        ? [...visibleSidebarItemKeys, item.key]
                        : visibleSidebarItemKeys.filter((key) => key !== item.key);
                      updateVisibleSidebarItems(nextKeys);
                    }}
                  />
                }
                label={item.label}
                sx={{ m: 0, px: 0.5, borderRadius: 1, "&:hover": { bgcolor: "action.hover" } }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => updateVisibleSidebarItems(navigationItems.slice(1).map((item) => item.key))}>
            全部显示
          </Button>
          <Button onClick={() => updateVisibleSidebarItems([])}>全部隐藏</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setCustomizeSidebarOpen(false)}>
            完成
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

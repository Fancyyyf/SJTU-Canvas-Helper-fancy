import { invoke } from "@tauri-apps/api/core";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link as MuiLink,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import dayjs, { Dayjs } from "dayjs";
import { useEffect, useMemo, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

import BasicLayout from "../components/layout";
import { WorkspaceHero } from "../components/workspace_hero";
import { useCourses } from "../lib/hooks";
import { logHandledError } from "../lib/logger";
import { useAppMessage } from "../lib/message";
import { CalendarEvent, Colors } from "../lib/model";
import { filterCalendarEvents, isAssignmentEvent, isCompletedAssignment, type AssignmentFilter } from "../lib/calendar_filter";
import { cachedAssignmentToEvent, getCanvasCalendarRevision, getCanvasCalendarSyncState, readCanvasCalendarSnapshot, subscribeCanvasCalendar, syncCanvasCalendar } from "../lib/canvas_calendar_cache";
import { createPersonalEvent, mergeImportedEvents, parseIcsEvents, loadPersonalEvents, persistPersonalEvents as saveNativePersonalEvents, validatePersonalEvent, type PersonalEvent, type PersonalEventDraft } from "../lib/personal_calendar";

type CalendarEntry = CalendarEvent | PersonalEvent;

function isPersonalEvent(event: CalendarEntry): event is PersonalEvent {
  return "startAt" in event;
}

function getEntryMoment(event: CalendarEntry) {
  return isPersonalEvent(event) ? dayjs(event.startAt) : getEventMoment(event);
}

function getEntryLabel(event: CalendarEntry) {
  return isPersonalEvent(event) ? "个人日程" : event.context_name;
}

function dateTimeInput(date: Dayjs) {
  return date.format("YYYY-MM-DDTHH:mm");
}

function personalEventRange(event: PersonalEvent) {
  const start = dayjs(event.startAt);
  const end = dayjs(event.endAt);
  if (event.allDay) {
    const lastDay = end.subtract(1, "day");
    return start.isSame(lastDay, "day")
      ? `${start.format("YYYY/MM/DD")} 全天`
      : `${start.format("YYYY/MM/DD")} – ${lastDay.format("YYYY/MM/DD")} 全天`;
  }
  return `${start.format("YYYY/MM/DD HH:mm")} – ${end.format("YYYY/MM/DD HH:mm")}`;
}

const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const monthOptions = [
  "1 月",
  "2 月",
  "3 月",
  "4 月",
  "5 月",
  "6 月",
  "7 月",
  "8 月",
  "9 月",
  "10 月",
  "11 月",
  "12 月",
];

import { surfaceCardSx as cardSx } from "../lib/styles";

function getCourseId(event: CalendarEvent) {
  const parts = event.context_code.split("_");
  return parts[parts.length - 1];
}

function getEventMoment(event: CalendarEvent) {
  return dayjs(event.end_at || event.start_at || event.assignment?.due_at || null);
}

function getDateKey(date: Dayjs) {
  return date.format("YYYY-MM-DD");
}

function getMonthGridDates(currentMonth: Dayjs) {
  const firstDay = currentMonth.startOf("month");
  const offset = (firstDay.day() + 6) % 7;
  const gridStart = firstDay.subtract(offset, "day");
  return Array.from({ length: 42 }, (_, index) => gridStart.add(index, "day"));
}

export default function CalendarPage() {
  const [messageApi, contextHolder] = useAppMessage();
  const courses = useCourses();
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [colors, setColors] = useState<Colors | undefined>();
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [account, setAccount] = useState<string | null>(null);
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [importPreview, setImportPreview] = useState<{ name: string; events: PersonalEventDraft[]; warnings: string[] } | null>(null);
  const cacheRevision = useSyncExternalStore(subscribeCanvasCalendar, getCanvasCalendarRevision);
  const syncState = getCanvasCalendarSyncState();
  const snapshot = useMemo(() => {
    void cacheRevision; // A cache write triggers this re-read.
    return account ? readCanvasCalendarSnapshot(account) : null;
  }, [account, cacheRevision]);
  const loading = syncState.syncing && syncState.account === account;

  useEffect(() => {
    let active = true;
    void invoke<{ current_account: string }>("read_account_info")
      .then(async (info) => {
        if (!active) return;
        const nextAccount = info.current_account || "local";
        const storedEvents = await loadPersonalEvents(nextAccount);
        if (!active) return;
        setAccount(nextAccount);
        setPersonalEvents(storedEvents);
      })
      .catch((error) => {
        if (active) {
          setAccount(null);
          setPersonalEvents([]);
          messageApi.error(`读取个人日程失败：${error}`);
        }
      });
    return () => { active = false; };
  }, [messageApi]);

  useEffect(() => {
    const handleKeyDownEvent = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.repeat || editorOpen || importPreview || target.closest("input, textarea, [contenteditable=true]")) return;
      const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!delta) return;
      setCurrentMonth((previous) => {
        const next = previous.add(delta, "month");
        setSelectedDate(next);
        return next;
      });
    };
    document.body.addEventListener("keydown", handleKeyDownEvent, true);
    return () => {
      document.body.removeEventListener("keydown", handleKeyDownEvent, true);
    };
  }, [editorOpen, importPreview]);

  useEffect(() => {
    if (!account) return;
    void invoke<Colors>("get_colors")
      .then(setColors)
      .catch((error) => logHandledError({
        code: "CALENDAR.COLORS_FAILED", scope: "calendar", action: "get_colors",
        error, userMessage: "课程颜色加载失败，已使用默认颜色。", recoverable: true,
        fallback: { used: true, strategy: "default_course_color", result: "success" },
      }));
  }, [account]);

  const handleMonthChange = (date: Dayjs) => {
    setCurrentMonth(date);
    setSelectedDate(date);
  };

  const monthGridDates = useMemo(() => getMonthGridDates(currentMonth), [currentMonth]);

  const scopedCanvasEvents = useMemo(() => {
    const all = (snapshot?.assignments ?? []).map(cachedAssignmentToEvent);
    if (courses.isLoading || courses.error || courses.data.length === 0) return all;
    const codes = new Set(courses.data.map((course) => `course_${course.id}`));
    return all.filter((event) => codes.has(event.context_code));
  }, [snapshot, courses.isLoading, courses.error, courses.data]);

  const events = useMemo(() => {
    const first = monthGridDates[0].startOf("day").valueOf();
    const last = monthGridDates[monthGridDates.length - 1].endOf("day").valueOf();
    return scopedCanvasEvents.filter((event) => {
      const time = getEventMoment(event).valueOf();
      return time >= first && time <= last;
    });
  }, [scopedCanvasEvents, monthGridDates]);

  const hintEvents = useMemo(() => {
    const now = dayjs().valueOf();
    const week = dayjs().add(7, "day").valueOf();
    return scopedCanvasEvents.filter((event) => {
      const time = getEventMoment(event).valueOf();
      return time >= now && time <= week;
    });
  }, [scopedCanvasEvents]);

  const visibleEvents = useMemo(
    () => filterCalendarEvents(events, assignmentFilter),
    [events, assignmentFilter]
  );
  const visibleHintEvents = useMemo(
    () => filterCalendarEvents(hintEvents, assignmentFilter),
    [hintEvents, assignmentFilter]
  );

  const displayedEvents = useMemo<CalendarEntry[]>(() => {
    const first = monthGridDates[0].startOf("day").valueOf();
    const last = monthGridDates[monthGridDates.length - 1].endOf("day").valueOf();
    return [...visibleEvents, ...personalEvents.filter((event) =>
      dayjs(event.endAt).valueOf() > first && dayjs(event.startAt).valueOf() <= last
    )];
  }, [monthGridDates, visibleEvents, personalEvents]);

  const displayedHints = useMemo<CalendarEntry[]>(() => {
    const now = dayjs().valueOf();
    const week = dayjs().add(7, "day").valueOf();
    return [...visibleHintEvents, ...personalEvents.filter((event) =>
      dayjs(event.endAt).valueOf() > now && dayjs(event.startAt).valueOf() <= week
    )].sort((a, b) => getEntryMoment(a).valueOf() - getEntryMoment(b).valueOf());
  }, [visibleHintEvents, personalEvents]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEntry[]>();
    for (const event of displayedEvents) {
      const eventFirst = getEntryMoment(event).startOf("day");
      const eventLast = isPersonalEvent(event)
        ? dayjs(event.endAt).subtract(1, "millisecond").startOf("day") : eventFirst;
      const first = eventFirst.isBefore(monthGridDates[0]) ? monthGridDates[0] : eventFirst;
      const last = eventLast.isAfter(monthGridDates[monthGridDates.length - 1])
        ? monthGridDates[monthGridDates.length - 1] : eventLast;
      for (let date = first; !date.isAfter(last); date = date.add(1, "day")) {
        const key = getDateKey(date);
        const current = grouped.get(key) ?? [];
        current.push(event);
        grouped.set(key, current);
      }
    }
    for (const [key, list] of grouped) {
      grouped.set(
        key,
        list.sort((a, b) => getEntryMoment(a).valueOf() - getEntryMoment(b).valueOf())
      );
    }
    return grouped;
  }, [displayedEvents, monthGridDates]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(getDateKey(selectedDate)) ?? [];
  }, [eventsByDate, selectedDate]);

  const importStats = useMemo(() => {
    if (!importPreview) return { added: 0, skipped: 0 };
    const keys = new Set(personalEvents.map((event) => event.sourceKey).filter(Boolean));
    let added = 0;
    let skipped = 0;
    for (const event of importPreview.events) {
      if (event.sourceKey && keys.has(event.sourceKey)) skipped++;
      else {
        added++;
        if (event.sourceKey) keys.add(event.sourceKey);
      }
    }
    return { added, skipped };
  }, [importPreview, personalEvents]);

  const statItems = useMemo(() => {
    const monthStart = currentMonth.startOf("month").valueOf();
    const monthEnd = currentMonth.endOf("month").valueOf();
    const thisMonthCount = displayedEvents.filter((event) => isPersonalEvent(event)
      ? dayjs(event.endAt).valueOf() > monthStart && dayjs(event.startAt).valueOf() <= monthEnd
      : getEntryMoment(event).isSame(currentMonth, "month")).length;
    const todayCount = eventsByDate.get(getDateKey(dayjs()))?.length ?? 0;
    const urgentCount = displayedHints.length;
    const selectedCount = selectedDayEvents.length;
    return [
      { label: "本月事项", value: `${thisMonthCount}`, icon: <CalendarMonthRoundedIcon /> },
      { label: "今日事项", value: `${todayCount}`, icon: <WarningAmberRoundedIcon /> },
      { label: "七日内事项", value: `${urgentCount}`, icon: <EventAvailableRoundedIcon /> },
      { label: "所选日期", value: `${selectedCount}`, icon: <TodayRoundedIcon /> },
    ];
  }, [displayedEvents, currentMonth, eventsByDate, displayedHints.length, selectedDayEvents.length]);

  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 11 }, (_, index) => currentYear - 5 + index);
  }, []);

  const handleYearSelect = (year: number) => {
    handleMonthChange(currentMonth.year(year));
  };

  const handleMonthSelect = (month: number) => {
    handleMonthChange(currentMonth.month(month));
  };

  const refreshCanvas = async () => {
    const result = await syncCanvasCalendar();
    if (result.error) messageApi.warning(`Canvas 更新失败：${result.error}`);
    else if (result.failedCourses.length) messageApi.warning(`已更新，其余 ${result.failedCourses.length} 门课程保留本地记录`);
    else messageApi.success("Canvas 作业状态已更新到本地");
    if (result.updated) await courses.mutate();
  };

  const persistPersonalEvents = async (next: PersonalEvent[]) => {
    if (!account) return false;
    try {
      await saveNativePersonalEvents(account, personalEvents, next);
      setPersonalEvents(next);
      return true;
    } catch (error) {
      messageApi.error(`保存个人日程失败：${error}`);
      void loadPersonalEvents(account).then(setPersonalEvents).catch(() => {});
      return false;
    }
  };

  const openEditor = (event?: PersonalEvent) => {
    const start = event ? dayjs(event.startAt) : selectedDate.hour(9).minute(0);
    const end = event ? dayjs(event.endAt) : start.add(1, "hour");
    setEditingId(event?.id ?? null);
    setDraftTitle(event?.title ?? "");
    setDraftAllDay(event?.allDay ?? false);
    setDraftStart(event?.allDay ? start.format("YYYY-MM-DD") : dateTimeInput(start));
    setDraftEnd(event?.allDay ? end.subtract(1, "day").format("YYYY-MM-DD") : dateTimeInput(end));
    setDraftDescription(event?.description ?? "");
    setEditorOpen(true);
  };

  const saveEditor = async () => {
    const start = dayjs(draftAllDay ? `${draftStart}T00:00` : draftStart);
    const end = dayjs(draftAllDay ? `${draftEnd}T00:00` : draftEnd);
    const draft: PersonalEventDraft = {
      title: draftTitle.trim(),
      startAt: start.isValid() ? start.toISOString() : "",
      endAt: end.isValid() ? (draftAllDay ? end.add(1, "day") : end).toISOString() : "",
      allDay: draftAllDay,
      description: draftDescription.trim(),
    };
    const problem = validatePersonalEvent(draft);
    if (problem) return messageApi.warning(problem);
    const next = editingId
      ? personalEvents.map((event) => event.id === editingId ? { ...event, ...draft } : event)
      : [...personalEvents, createPersonalEvent(draft)];
    if (await persistPersonalEvents(next)) {
      setEditorOpen(false);
      messageApi.success(editingId ? "日程已更新" : "日程已创建");
    }
  };

  const deletePersonalEvent = async (id: string) => {
    if (await persistPersonalEvents(personalEvents.filter((event) => event.id !== id))) {
      messageApi.success("日程已删除");
    }
  };

  const selectImportFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) return messageApi.warning("ICS 文件不能超过 2 MB");
    try {
      const result = parseIcsEvents(await file.text());
      setImportPreview({ name: file.name, ...result });
    } catch (error) {
      messageApi.error(`导入预览失败：${error}`);
    }
  };

  const applyImport = async () => {
    if (!importPreview) return;
    const result = mergeImportedEvents(personalEvents, importPreview.events);
    if (await persistPersonalEvents(result.events)) {
      setImportPreview(null);
      messageApi.success(`导入 ${result.added.length} 项，跳过 ${result.skipped} 项重复日程`);
    }
  };

  return (
    <BasicLayout>
      {contextHolder}
      <Box sx={{ minHeight: "100%", color: "text.primary" }}>
        <Stack spacing={3}>
          <WorkspaceHero
            chipLabel="日程管理"
            chipIcon={<CalendarMonthRoundedIcon />}
            title="日历与 DDL 工作台"
            description="先显示本地日程；打开应用或点击更新时，会同步 Canvas 作业状态。"
            aside={
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} useFlexGap flexWrap="wrap">
                <Button variant="contained" startIcon={<AddRoundedIcon />} disabled={!account}
                  onClick={() => openEditor()} sx={{ whiteSpace: "nowrap" }}>新建日程</Button>
                <Button variant="outlined" component="label" startIcon={<UploadFileRoundedIcon />}
                  disabled={!account} sx={{ whiteSpace: "nowrap" }}>
                  导入 ICS
                  <input hidden type="file" accept=".ics,.ical,text/calendar" onChange={(event) => {
                    void selectImportFile(event.target.files?.[0]);
                    event.target.value = "";
                  }} />
                </Button>
                <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshRoundedIcon />}
                  disabled={!account || loading} onClick={() => void refreshCanvas()} sx={{ whiteSpace: "nowrap" }}>
                  {loading ? "正在更新" : "更新 Canvas"}
                </Button>
                <TextField
                  select
                  size="small"
                  label="年份"
                  value={currentMonth.year()}
                  onChange={(event) => void handleYearSelect(Number(event.target.value))}
                  sx={{ minWidth: 120 }}
                >
                  {yearOptions.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year} 年
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="月份"
                  value={currentMonth.month()}
                  onChange={(event) => void handleMonthSelect(Number(event.target.value))}
                  sx={{ minWidth: 110 }}
                >
                  {monthOptions.map((label, index) => (
                    <MenuItem key={label} value={index}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  startIcon={<KeyboardDoubleArrowLeftRoundedIcon />}
                  onClick={() => void handleMonthChange(dayjs())}
                >
                  回到本月
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => void handleMonthChange(currentMonth.subtract(1, "month"))}
                >
                  上个月
                </Button>
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  onClick={() => void handleMonthChange(currentMonth.add(1, "month"))}
                >
                  下个月
                </Button>
              </Stack>
            }
            stats={statItems}
          />

          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                xl: "minmax(0, 2.2fr) minmax(300px, 0.55fr)",
              },
            }}
          >
            <Card sx={cardSx}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="h5">
                        {currentMonth.format("YYYY 年 M 月")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        使用左右方向键也可以切换月份。
                      </Typography>
                    </Box>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <TextField select size="small" label="作业状态" value={assignmentFilter}
                        onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}
                        inputProps={{ "aria-label": "按作业完成状态筛选日程" }} sx={{ minWidth: 128 }}>
                        <MenuItem value="all">全部</MenuItem>
                        <MenuItem value="completed">已完成</MenuItem>
                        <MenuItem value="incomplete">未完成</MenuItem>
                      </TextField>
                      <Chip icon={<AutoAwesomeRoundedIcon />} label={`显示 ${displayedEvents.length} 项`}
                        color="primary" variant="outlined" />
                    </Stack>
                  </Stack>

                  <Alert severity="info" sx={{ borderRadius: "18px" }}>
                    点击某一天查看当天事项；Canvas 作业可跳转课程，个人日程可编辑或删除。作业状态筛选不会隐藏个人日程。
                  </Alert>

                  <Typography variant="caption" color="text.secondary">
                    {snapshot ? `本地 Canvas 数据更新于 ${dayjs(snapshot.updatedAt).format("YYYY/MM/DD HH:mm")}` : "尚无本地 Canvas 作业记录"}
                    {loading ? " · 正在从 Canvas 更新作业状态" : ""}
                  </Typography>

                  {syncState.account === account && syncState.error ? (
                    <Alert severity="warning" sx={{ borderRadius: "18px" }}>
                      Canvas 更新失败：{syncState.error}。{snapshot ? "已继续显示本地记录。" : "尚无本地记录。"}
                    </Alert>
                  ) : null}

                  {syncState.account === account && syncState.failedCourses.length > 0 ? (
                    <Alert severity="warning" sx={{ borderRadius: "18px" }}>
                      {syncState.failedCourses.length} 门课程更新失败；这些课程继续使用上次保存的作业状态。
                    </Alert>
                  ) : null}

                    <Box sx={{ display: "grid", gap: 1.25 }}>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        }}
                      >
                        {weekdayLabels.map((label) => (
                          <Box
                            key={label}
                            sx={{
                              px: 1.25,
                              py: 1,
                                  borderRadius: "8px",
                                  bgcolor: "action.hover",
                              textAlign: "center",
                            }}
                          >
                            <Typography variant="subtitle2" color="text.secondary">
                              {label}
                            </Typography>
                          </Box>
                        ))}
                      </Box>

                      <Box
                        sx={{
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        }}
                      >
                        {monthGridDates.map((date) => {
                          const key = getDateKey(date);
                          const dayEvents = eventsByDate.get(key) ?? [];
                          const isCurrentMonth = date.isSame(currentMonth, "month");
                          const isToday = date.isSame(dayjs(), "day");
                          const isSelected = date.isSame(selectedDate, "day");

                          return (
                            <Card
                              key={key}
                              onClick={() => setSelectedDate(date)}
                              sx={{
                                minHeight: { xs: 132, md: 156 },
                                cursor: "pointer",
                                borderRadius: "8px",
                                border: "1px solid",
                                borderColor: isSelected
                                  ? "primary.main"
                                  : "divider",
                                bgcolor: isSelected
                                  ? "action.selected"
                                  : isCurrentMonth
                                    ? "background.paper"
                                    : "action.disabledBackground",
                                transition: "border-color 0.2s ease, transform 0.2s ease",
                                "&:hover": {
                                  transform: "translateY(-2px)",
                                  borderColor: "primary.main",
                                },
                              }}
                            >
                              <CardContent
                                sx={{
                                  p: 1.25,
                                  height: "100%",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 1,
                                }}
                              >
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  alignItems="center"
                                  spacing={1}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    sx={{
                                      fontWeight: isToday || isSelected ? 700 : 600,
                                      color: isCurrentMonth ? "text.primary" : "text.disabled",
                                    }}
                                  >
                                    {date.date()}
                                  </Typography>
                                  {isToday && <Chip size="small" label="今天" color="primary" />}
                                </Stack>

                                <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                                  {dayEvents.slice(0, 3).map((event) => (
                                    <Tooltip
                                      key={event.id}
                                      title={`${getEntryLabel(event)} · ${getEntryMoment(event).format(
                                        isPersonalEvent(event) && event.allDay ? "MM/DD 全天" : "MM/DD HH:mm"
                                      )}`}
                                      placement="top"
                                    >
                                      <Box
                                        component={isPersonalEvent(event) ? "button" : RouterLink}
                                        {...(isPersonalEvent(event) ? { type: "button" as const } : { to: `/assignments?id=${getCourseId(event)}` })}
                                        onClick={(eventClick: MouseEvent) => {
                                          eventClick.stopPropagation();
                                          if (isPersonalEvent(event)) openEditor(event);
                                        }}
                                        sx={{
                                          display: "block",
                                          width: "100%",
                                          textAlign: "left",
                                          border: 0,
                                          cursor: "pointer",
                                          textDecoration: "none",
                                          font: "inherit",
                                          px: 1,
                                          py: 0.7,
                                          borderRadius: "12px",
                                          bgcolor: alpha(
                                            isPersonalEvent(event) ? "#7c3aed" : colors?.custom_colors[event.context_code] || "#2563eb",
                                            0.12
                                          ),
                                          color: "text.primary",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          borderLeft: `4px solid ${
                                            isPersonalEvent(event) ? "#7c3aed" : colors?.custom_colors[event.context_code] || "#2563eb"
                                          }`,
                                          "&:hover": {
                                            bgcolor: alpha(
                                              isPersonalEvent(event) ? "#7c3aed" : colors?.custom_colors[event.context_code] || "#2563eb",
                                              0.18
                                            ),
                                          },
                                        }}
                                      >
                                        {!isPersonalEvent(event) && isAssignmentEvent(event) && isCompletedAssignment(event) ? "✓ " : ""}{event.title}
                                      </Box>
                                    </Tooltip>
                                  ))}
                                  {dayEvents.length > 3 && (
                                    <Typography variant="caption" color="text.secondary">
                                      还有 {dayEvents.length - 3} 项…
                                    </Typography>
                                  )}
                                </Stack>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </Box>
                    </Box>
                </Stack>
              </CardContent>
            </Card>

            <Stack spacing={3}>
              <Card sx={cardSx}>
                <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">七日内事项</Typography>
                      <Typography variant="body2" color="text.secondary">
                        按上方作业状态筛选最近一周的截止事项。
                      </Typography>
                    </Box>

                    {displayedHints.length === 0 ? (
                      <Alert severity="success" sx={{ borderRadius: "18px" }}>
                        暂无临近事项。
                      </Alert>
                    ) : (
                      <Stack spacing={1.25}>
                        {displayedHints.map((event) => {
                          const now = dayjs();
                          const diff = getEntryMoment(event).diff(now, "hour");
                          const days = Math.floor(diff / 24);
                          const hours = diff % 24;

                          return (
                            <Box
                              key={event.id}
                              sx={{
                                p: 1.5,
                                borderRadius: "8px",
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              <Stack spacing={0.7}>
                                {isPersonalEvent(event) ? (
                                  <Button onClick={() => openEditor(event)} sx={{ alignSelf: "flex-start", p: 0, textTransform: "none" }}>{event.title}</Button>
                                ) : (
                                  <MuiLink component={RouterLink} to={`/assignments?id=${getCourseId(event)}`}
                                    underline="hover" sx={{ fontWeight: 700, color: "text.primary" }}>{event.title}</MuiLink>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                  {getEntryLabel(event)}
                                </Typography>
                                {!isPersonalEvent(event) && isAssignmentEvent(event) && <Chip size="small" variant="outlined"
                                  color={isCompletedAssignment(event) ? "success" : "warning"}
                                  label={isCompletedAssignment(event) ? "已完成" : "未完成"} sx={{ width: "fit-content" }} />}
                                <Chip
                                  size="small"
                                  color={days <= 1 ? "warning" : "default"}
                                  label={isPersonalEvent(event)
                                    ? personalEventRange(event)
                                    : isCompletedAssignment(event)
                                      ? `截止于 ${getEntryMoment(event).format("MM/DD HH:mm")}`
                                      : `还有 ${days} 天 ${hours} 小时`}
                                  sx={{ width: "fit-content" }}
                                />
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={cardSx}>
                <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">
                        {selectedDate.format("M 月 D 日")} 事项
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        选中日期后，这里会显示当天所有作业与个人日程。
                      </Typography>
                    </Box>
                    <Divider />

                    {selectedDayEvents.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        这一天没有日程。
                      </Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {selectedDayEvents.map((event) => (
                          <Box
                            key={event.id}
                            sx={{
                              p: 1.5,
                              borderRadius: "18px",
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Stack spacing={0.7}>
                              {isPersonalEvent(event) ? (
                                <Typography fontWeight={700}>{event.title}</Typography>
                              ) : (
                                <MuiLink component={RouterLink} to={`/assignments?id=${getCourseId(event)}`}
                                  underline="hover" sx={{ fontWeight: 700, color: "text.primary" }}>{event.title}</MuiLink>
                              )}
                              <Typography variant="body2" color="text.secondary">
                                {getEntryLabel(event)}
                              </Typography>
                              {!isPersonalEvent(event) && isAssignmentEvent(event) && <Chip size="small" variant="outlined"
                                color={isCompletedAssignment(event) ? "success" : "warning"}
                                label={isCompletedAssignment(event) ? "已完成" : "未完成"} sx={{ width: "fit-content" }} />}
                              <Typography variant="caption" color="text.secondary">
                                {isPersonalEvent(event) ? `时间：${personalEventRange(event)}` : `截止时间：${getEntryMoment(event).format("YYYY/MM/DD HH:mm")}`}
                              </Typography>
                              {isPersonalEvent(event) && event.description && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{event.description}</Typography>}
                              {isPersonalEvent(event) && <Stack direction="row" spacing={1}>
                                <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditor(event)}>编辑</Button>
                                <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />}
                                  onClick={() => deletePersonalEvent(event.id)}>删除</Button>
                              </Stack>}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Stack>

      </Box>
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "编辑日程" : "新建日程"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="日程名称" required value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} autoFocus />
            <TextField select label="时间类型" value={draftAllDay ? "all-day" : "timed"}
              onChange={(event) => {
                const allDay = event.target.value === "all-day";
                setDraftAllDay(allDay);
                setDraftStart(allDay ? draftStart.slice(0, 10) : `${draftStart.slice(0, 10)}T09:00`);
                setDraftEnd(allDay ? draftEnd.slice(0, 10) : `${draftEnd.slice(0, 10)}T10:00`);
              }}>
              <MenuItem value="timed">指定时间</MenuItem>
              <MenuItem value="all-day">全天</MenuItem>
            </TextField>
            <TextField label="开始" type={draftAllDay ? "date" : "datetime-local"} value={draftStart}
              onChange={(event) => setDraftStart(event.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label={draftAllDay ? "结束日期（含）" : "结束"} type={draftAllDay ? "date" : "datetime-local"} value={draftEnd}
              onChange={(event) => setDraftEnd(event.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="备注（可选）" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} multiline minRows={3} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>取消</Button>
          <Button variant="contained" onClick={saveEditor}>保存</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(importPreview)} onClose={() => setImportPreview(null)} fullWidth maxWidth="sm">
        <DialogTitle>导入日程预览</DialogTitle>
        <DialogContent>
          {importPreview && <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">{importPreview.name}：识别 {importPreview.events.length} 项，新增 {importStats.added} 项，重复 {importStats.skipped} 项。</Typography>
            {importPreview.warnings.length > 0 && <Alert severity="warning">{importPreview.warnings.slice(0, 5).join("；")}{importPreview.warnings.length > 5 ? `；另有 ${importPreview.warnings.length - 5} 条提示` : ""}</Alert>}
            <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
              {importPreview.events.slice(0, 30).map((event, index) => (
                <Typography key={`${event.sourceKey ?? index}-${index}`} variant="body2" sx={{ py: 0.5 }}>
                  {dayjs(event.startAt).format("YYYY/MM/DD HH:mm")} · {event.title}
                </Typography>
              ))}
              {importPreview.events.length > 30 && <Typography variant="caption">另有 {importPreview.events.length - 30} 项</Typography>}
            </Box>
          </Stack>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportPreview(null)}>取消</Button>
          <Button variant="contained" disabled={!importPreview || importStats.added === 0}
            onClick={applyImport}>一键导入</Button>
        </DialogActions>
      </Dialog>
    </BasicLayout>
  );
}

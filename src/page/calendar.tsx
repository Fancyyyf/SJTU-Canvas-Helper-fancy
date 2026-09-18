import { invoke } from "@tauri-apps/api/core";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
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
  Link as MuiLink,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import dayjs, { Dayjs } from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import BasicLayout from "../components/layout";
import { WorkspaceHero } from "../components/workspace_hero";
import { useCourses } from "../lib/hooks";
import { logHandledError } from "../lib/logger";
import { useAppMessage } from "../lib/message";
import { Assignment, CalendarEvent, Colors, Course } from "../lib/model";

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
  return dayjs(event.end_at || event.start_at || event.assignment.due_at);
}

function assignmentToCalendarEvent(assignment: Assignment, course: Course): CalendarEvent {
  const dueAt = assignment.due_at;
  return {
    title: assignment.name,
    workflow_state: assignment.published ? "published" : "unpublished",
    id: `assignment_${course.id}_${assignment.id}`,
    type_field: "assignment",
    assignment,
    html_url: assignment.html_url,
    end_at: dueAt,
    start_at: dueAt,
    context_code: `course_${course.id}`,
    context_name: course.name,
    url: assignment.html_url,
    important_dates: true,
  };
}

function eventIdentity(event: CalendarEvent) {
  return event.assignment.id > 0
    ? `${event.context_code}:assignment_${event.assignment.id}`
    : `${event.context_code}:event_${event.id}`;
}

function dedupeEvents(rawEvents: CalendarEvent[]) {
  const seen = new Set<string>();
  return rawEvents.filter((event) => {
    if (!getEventMoment(event).isValid()) return false;
    const identity = eventIdentity(event);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function eventsWithinRange(events: CalendarEvent[], startDate: string, endDate: string) {
  const start = dayjs(startDate).valueOf();
  const end = dayjs(endDate).valueOf();
  return events.filter((event) => {
    const timestamp = getEventMoment(event).valueOf();
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
  });
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
  const [contextCodes, setContextCodes] = useState<string[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [hintEvents, setHintEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [calendarFallbackActive, setCalendarFallbackActive] = useState(false);
  const [assignmentLoadWarning, setAssignmentLoadWarning] = useState("");
  const currentMonthRef = useRef<Dayjs>(dayjs());
  const contextCodesRef = useRef<string[]>([]);
  const assignmentDueEventsRef = useRef<CalendarEvent[]>([]);
  const courseScopeKey = courses.data.map((course) => course.id).join(",");

  useEffect(() => {
    document.body.addEventListener("keydown", handleKeyDownEvent, true);
    return () => {
      document.body.removeEventListener("keydown", handleKeyDownEvent, true);
    };
  }, []);

  useEffect(() => {
    void init(courses.data);
    // The key changes only when the globally filtered course scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseScopeKey]);

  useEffect(() => {
    currentMonthRef.current = currentMonth;
  }, [currentMonth]);

  useEffect(() => {
    contextCodesRef.current = contextCodes;
  }, [contextCodes]);

  const handleKeyDownEvent = (event: KeyboardEvent) => {
    if (loading) {
      return;
    }
    if (event.key === "ArrowRight" && !event.repeat) {
      void handleMonthChange(currentMonthRef.current.add(1, "month"));
    }
    if (event.key === "ArrowLeft" && !event.repeat) {
      void handleMonthChange(currentMonthRef.current.subtract(1, "month"));
    }
  };

  const getColors = () => invoke("get_colors");

  const handleGetCalendarEvents = async (
    nextContextCodes: string[],
    startDate: string,
    endDate: string
  ) => {
    return (await invoke("list_calendar_events", {
      contextCodes: nextContextCodes,
      startDate,
      endDate,
    })) as CalendarEvent[];
  };

  const loadAssignmentDueEvents = async (scopedCourses: Course[]) => {
    const results = await Promise.allSettled(
      scopedCourses.map(async (course) => ({
        course,
        assignments: (await invoke("list_course_assignments", {
          courseId: course.id,
        })) as Assignment[],
      }))
    );
    const dueEvents: CalendarEvent[] = [];
    const failedCourses: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failedCourses.push(scopedCourses[index].name);
        return;
      }
      result.value.assignments.forEach((assignment) => {
        if (assignment.due_at && dayjs(assignment.due_at).isValid()) {
          dueEvents.push(assignmentToCalendarEvent(assignment, result.value.course));
        }
      });
    });

    if (failedCourses.length > 0) {
      setAssignmentLoadWarning(
        `${failedCourses.length} 门课程的作业接口加载失败；已继续显示其余课程及 Canvas 日历返回的事项。`
      );
      logHandledError({
        code: "CALENDAR.ASSIGNMENT_FALLBACK_PARTIAL",
        scope: "calendar",
        action: "load_course_assignments",
        error: new Error(`Failed courses: ${failedCourses.join(", ")}`),
        userMessage: "部分课程的作业截止日期加载失败。",
        recoverable: true,
        fallback: {
          used: true,
          strategy: "keep_successful_courses_and_calendar_events",
          result: "success",
        },
      });
    } else {
      setAssignmentLoadWarning("");
    }
    return dueEvents;
  };

  const loadCalendarRange = async (
    nextContextCodes: string[],
    startDate: string,
    endDate: string,
    assignmentDueEvents: CalendarEvent[]
  ) => {
    const assignmentEventsInRange = eventsWithinRange(
      assignmentDueEvents,
      startDate,
      endDate
    );
    if (nextContextCodes.length === 0) return assignmentEventsInRange;

    try {
      const calendarEvents = await handleGetCalendarEvents(
        nextContextCodes,
        startDate,
        endDate
      );
      return dedupeEvents([...calendarEvents, ...assignmentEventsInRange]);
    } catch (error) {
      setCalendarFallbackActive(true);
      logHandledError({
        code: "CALENDAR.EVENT_API_FAILED",
        scope: "calendar",
        action: "list_calendar_events",
        error,
        userMessage: "Canvas 日历接口不可用，已改用课程作业截止日期。",
        recoverable: true,
        fallback: {
          used: true,
          strategy: "course_assignment_due_dates",
          result: "success",
        },
        context: { startDate, endDate, courseCount: nextContextCodes.length },
      });
      return dedupeEvents(assignmentEventsInRange);
    }
  };

  const handleInitCalendarEvents = async (
    nextContextCodes: string[],
    date: Dayjs,
    assignmentDueEvents = assignmentDueEventsRef.current
  ) => {
    setLoading(true);
    try {
      const gridDates = getMonthGridDates(date);
      const startDate = gridDates[0].startOf("day").toISOString();
      const endDate = gridDates[gridDates.length - 1].endOf("day").toISOString();
      const rawEvents = await loadCalendarRange(
        nextContextCodes,
        startDate,
        endDate,
        assignmentDueEvents
      );
      setEvents(dedupeEvents(rawEvents));
    } catch (error) {
      messageApi.error(`日历加载失败：${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getHints = async (
    nextContextCodes: string[],
    assignmentDueEvents = assignmentDueEventsRef.current
  ) => {
    try {
      const now = dayjs().toISOString();
      const afterAWeek = dayjs().add(7, "day").toISOString();
      const rawEvents = await loadCalendarRange(
        nextContextCodes,
        now,
        afterAWeek,
        assignmentDueEvents
      );
      const deduped = dedupeEvents(rawEvents).sort(
        (a, b) => getEventMoment(a).valueOf() - getEventMoment(b).valueOf()
      );
      setHintEvents(deduped);
    } catch (error) {
      messageApi.error(`七日提醒加载失败：${error}`);
    }
  };

  const init = async (scopedCourses: Course[]) => {
    const nextContextCodes = scopedCourses.map((course) => `course_${course.id}`);
    setCalendarFallbackActive(false);
    if (scopedCourses.length === 0) {
      assignmentDueEventsRef.current = [];
      setContextCodes([]);
      setEvents([]);
      setHintEvents([]);
      return;
    }

    const [colorResult, assignmentDueEvents] = await Promise.all([
      getColors()
        .then((value) => value as Colors)
        .catch((error) => {
          logHandledError({
            code: "CALENDAR.COLORS_FAILED",
            scope: "calendar",
            action: "get_colors",
            error,
            userMessage: "课程颜色加载失败，已使用默认颜色。",
            recoverable: true,
            fallback: { used: true, strategy: "default_course_color", result: "success" },
          });
          return { custom_colors: {} } as Colors;
        }),
      loadAssignmentDueEvents(scopedCourses),
    ]);

    assignmentDueEventsRef.current = assignmentDueEvents;
    setColors(colorResult);
    setContextCodes(nextContextCodes);
    await Promise.all([
      handleInitCalendarEvents(nextContextCodes, currentMonth, assignmentDueEvents),
      getHints(nextContextCodes, assignmentDueEvents),
    ]);
  };

  const handleMonthChange = async (date: Dayjs) => {
    setCurrentMonth(date);
    setSelectedDate(date);
    setCalendarFallbackActive(false);
    await handleInitCalendarEvents(contextCodesRef.current, date);
  };

  const monthGridDates = useMemo(() => getMonthGridDates(currentMonth), [currentMonth]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = getDateKey(getEventMoment(event));
      const current = grouped.get(key) ?? [];
      current.push(event);
      grouped.set(key, current);
    }
    for (const [key, list] of grouped) {
      grouped.set(
        key,
        list.sort((a, b) => getEventMoment(a).valueOf() - getEventMoment(b).valueOf())
      );
    }
    return grouped;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(getDateKey(selectedDate)) ?? [];
  }, [eventsByDate, selectedDate]);

  const statItems = useMemo(() => {
    const thisMonthCount = events.length;
    const todayCount = eventsByDate.get(getDateKey(dayjs()))?.length ?? 0;
    const urgentCount = hintEvents.length;
    const selectedCount = selectedDayEvents.length;
    return [
      { label: "本月事项", value: `${thisMonthCount}`, icon: <CalendarMonthRoundedIcon /> },
      { label: "今日截止", value: `${todayCount}`, icon: <WarningAmberRoundedIcon /> },
      { label: "七日提醒", value: `${urgentCount}`, icon: <EventAvailableRoundedIcon /> },
      { label: "所选日期", value: `${selectedCount}`, icon: <TodayRoundedIcon /> },
    ];
  }, [events.length, eventsByDate, hintEvents.length, selectedDayEvents.length]);

  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 11 }, (_, index) => currentYear - 5 + index);
  }, []);

  const handleYearSelect = async (year: number) => {
    await handleMonthChange(currentMonth.year(year));
  };

  const handleMonthSelect = async (month: number) => {
    await handleMonthChange(currentMonth.month(month));
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
            description="更适合扫读、排程和追踪作业截止日期的月历视图。"
            aside={
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
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
                    <Chip
                      icon={<AutoAwesomeRoundedIcon />}
                      label={`共 ${events.length} 个去重后的日历事项`}
                      color="primary"
                      variant="outlined"
                    />
                  </Stack>

                  <Alert severity="info" sx={{ borderRadius: "18px" }}>
                    点击某一天可以查看当天的截止事项，点击事项名称会跳转到对应课程的作业页。
                  </Alert>

                  {calendarFallbackActive ? (
                    <Alert severity="warning" sx={{ borderRadius: "18px" }}>
                      Canvas 日历接口暂时不可用，当前已自动改用各课程作业接口中的截止时间。
                    </Alert>
                  ) : null}

                  {assignmentLoadWarning ? (
                    <Alert severity="warning" sx={{ borderRadius: "18px" }}>
                      {assignmentLoadWarning}
                    </Alert>
                  ) : null}

                  {loading ? (
                    <Box
                      sx={{
                        minHeight: 420,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : (
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
                                      title={`${event.context_name} · ${getEventMoment(event).format(
                                        "MM/DD HH:mm"
                                      )}`}
                                      placement="top"
                                    >
                                      <MuiLink
                                        component={RouterLink}
                                        to={`/assignments?id=${getCourseId(event)}`}
                                        underline="none"
                                        onClick={(eventClick) => eventClick.stopPropagation()}
                                        sx={{
                                          display: "block",
                                          px: 1,
                                          py: 0.7,
                                          borderRadius: "12px",
                                          bgcolor: alpha(
                                            colors?.custom_colors[event.context_code] || "#2563eb",
                                            0.12
                                          ),
                                          color: "text.primary",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          borderLeft: `4px solid ${
                                            colors?.custom_colors[event.context_code] || "#2563eb"
                                          }`,
                                          "&:hover": {
                                            bgcolor: alpha(
                                              colors?.custom_colors[event.context_code] || "#2563eb",
                                              0.18
                                            ),
                                          },
                                        }}
                                      >
                                        {event.title}
                                      </MuiLink>
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
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Stack spacing={3}>
              <Card sx={cardSx}>
                <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">七日内 DDL</Typography>
                      <Typography variant="body2" color="text.secondary">
                        优先关注最近一周需要处理的事项。
                      </Typography>
                    </Box>

                    {hintEvents.length === 0 ? (
                      <Alert severity="success" sx={{ borderRadius: "18px" }}>
                        暂无临近 DDL，尽情享受当下。
                      </Alert>
                    ) : (
                      <Stack spacing={1.25}>
                        {hintEvents.map((event) => {
                          const now = dayjs();
                          const diff = getEventMoment(event).diff(now, "hour");
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
                                <MuiLink
                                  component={RouterLink}
                                  to={`/assignments?id=${getCourseId(event)}`}
                                  underline="hover"
                                  sx={{ fontWeight: 700, color: "text.primary" }}
                                >
                                  {event.title}
                                </MuiLink>
                                <Typography variant="body2" color="text.secondary">
                                  {event.context_name}
                                </Typography>
                                <Chip
                                  size="small"
                                  color={days <= 1 ? "warning" : "default"}
                                  label={`还有 ${days} 天 ${hours} 小时`}
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
                        选中日期后，这里会显示当天所有作业与截止事项。
                      </Typography>
                    </Box>
                    <Divider />

                    {selectedDayEvents.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        这一天没有记录到截止事项。
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
                              <MuiLink
                                component={RouterLink}
                                to={`/assignments?id=${getCourseId(event)}`}
                                underline="hover"
                                sx={{ fontWeight: 700, color: "text.primary" }}
                              >
                                {event.title}
                              </MuiLink>
                              <Typography variant="body2" color="text.secondary">
                                {event.context_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                截止时间：{getEventMoment(event).format("YYYY/MM/DD HH:mm")}
                              </Typography>
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
    </BasicLayout>
  );
}

import { invoke } from "@tauri-apps/api/core";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  Link as MuiLink,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import CourseSelect, { ALL_COURSES_ID } from "../components/course_select";
import { GradeOverviewChart } from "../components/grade_overview";
import BasicLayout from "../components/layout";
import { WorkspaceHero } from "../components/workspace_hero";
import { ListSkeleton } from "../components/skeleton";
import ModifyDDLModal from "../components/modify_ddl_modal";
import { SubmitModal } from "../components/submit_modal";
import { useBaseURL, useCourses, useMe, usePreview, useSelectedCourse } from "../lib/hooks";
import { useAppMessage } from "../lib/message";
import {
  Assignment,
  Attachment,
  GradeStatus,
  LOG_LEVEL_ERROR,
  ScoreStatistic,
  Submission,
} from "../lib/model";
import {
  assignmentIsEnded,
  assignmentNotNeedSubmit,
  attachmentToFile,
  consoleLog,
  formatDate,
  getBaseDate,
} from "../lib/utils";

import { surfaceCardSx } from "../lib/styles";

export default function AssignmentsPage() {
  const [messageApi, contextHolder] = useAppMessage();
  const [operating, setOperating] = useState(false);
  const [onlyShowUnfinished, setOnlyShowUnfinished] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const { setSelectedCourseId } = useSelectedCourse();
  const [courseScopeId, setCourseScopeId] = useState(ALL_COURSES_ID);
  const { previewer, onHoverEntry, onLeaveEntry, setPreviewEntry } =
    usePreview();
  const [linksMap, setLinksMap] = useState<Record<number, Attachment[]>>({});
  const [expandedAssignmentIds, setExpandedAssignmentIds] = useState<number[]>(
    []
  );
  const [showModifyDDLModal, setShowModifyDDLModal] = useState(false);
  const [assignmentToModify, setAssignmentToModify] = useState<
    Assignment | undefined
  >();
  const [showModal, setShowModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<
    Assignment | undefined
  >();
  const [gradeMap, setGradeMap] = useState<Map<number, GradeStatus>>(new Map());
  const assignmentLoadIdRef = useRef(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const courses = useCourses();
  const me = useMe();
  const baseURL = useBaseURL();

  useEffect(() => {
    const courseId = Number.parseInt(searchParams.get("id") ?? "");
    if (courseId > 0) {
      setSearchParams({});
      setCourseScopeId(courseId);
      setSelectedCourseId(courseId);
    }
  }, [searchParams, setSearchParams, setSelectedCourseId]);

  useEffect(() => {
    const nextGradeMap = new Map<number, GradeStatus>();
    assignments.forEach((assignment) => {
      const actualGrade = Number.parseInt(assignment.submission?.grade ?? "0");
      let maxGrade = assignment.points_possible ?? 0;
      const graded =
        assignment.submission?.workflow_state === "graded" &&
        !Number.isNaN(actualGrade);
      if (!graded) {
        return;
      }
      if (maxGrade < actualGrade) {
        maxGrade = actualGrade;
      }
      nextGradeMap.set(assignment.id, {
        assignmetName: assignment.name,
        actualGrade,
        maxGrade,
      } as GradeStatus);
    });
    setGradeMap(nextGradeMap);
  }, [assignments]);

  const isTAOrTeacher = (courseId: number) => {
    const course = courses.data.find((item) => item.id === courseId);
    return (
      course !== undefined &&
      course.enrollments.find(
        (enrollment) =>
          enrollment.role === "TaEnrollment" ||
          enrollment.role === "TeacherEnrollment"
      ) !== undefined
    );
  };

  const assignmentSummary = useMemo(() => {
    const total = assignments.length;
    const ended = assignments.filter((assignment) =>
      assignmentIsEnded(assignment)
    ).length;
    const submitted = assignments.filter(
      (assignment) => assignment.submission?.submitted_at
    ).length;
    const unfinished = assignments.filter(
      (assignment) =>
        !assignmentNotNeedSubmit(assignment) &&
        assignment.submission?.workflow_state === "unsubmitted"
    ).length;

    return { total, ended, submitted, unfinished };
  }, [assignments]);

  const handleGetAssignments = async (
    courseId: number,
    onlyShowUnfinishedValue: boolean
  ) => {
    const requestId = ++assignmentLoadIdRef.current;
    const courseIds =
      courseId === ALL_COURSES_ID
        ? courses.data.map((course) => course.id)
        : courses.data.some((course) => course.id === courseId)
          ? [courseId]
          : [];
    if (courseIds.length === 0) {
      setAssignments([]);
      setLinksMap({});
      setOperating(false);
      return;
    }
    setOperating(true);
    try {
      const nextLinksMap: Record<number, Attachment[]> = {};
      const results = await Promise.allSettled(
        courseIds.map(async (currentCourseId) => {
          let courseAssignments = (await invoke("list_course_assignments", {
            courseId: currentCourseId,
          })) as Assignment[];
          courseAssignments = courseAssignments.map((assignment) => ({
            ...assignment,
            course_id: assignment.course_id || currentCourseId,
            key: assignment.id,
          }));
          if (!isTAOrTeacher(currentCourseId) && onlyShowUnfinishedValue) {
            courseAssignments = courseAssignments.filter(
              (assignment) => assignment.submission?.workflow_state === "unsubmitted"
            );
          }
          return courseAssignments;
        })
      );
      const nextAssignments = results
        .filter(
          (result): result is PromiseFulfilledResult<Assignment[]> =>
            result.status === "fulfilled"
        )
        .flatMap((result) => result.value)
        .sort((a, b) => {
          const aDue = dayjs(a.due_at).valueOf();
          const bDue = dayjs(b.due_at).valueOf();
          return (Number.isFinite(aDue) ? aDue : Number.MAX_SAFE_INTEGER) -
            (Number.isFinite(bDue) ? bDue : Number.MAX_SAFE_INTEGER);
        });
      const failedCount = results.filter((result) => result.status === "rejected").length;
      if (requestId !== assignmentLoadIdRef.current) return;
      if (failedCount > 0) {
        messageApi.open({
          type: "warning",
          content: `${failedCount} 门课程的作业加载失败，已展示其余课程。`,
          diagnostic: {
            code: "ASSIGNMENTS.PARTIAL_LOAD",
            scope: "assignments",
            action: "load_course_scope",
            outcome: "fallback",
            recoverable: true,
            fallback: {
              used: true,
              strategy: "show_successful_courses",
              result: "success",
            },
            context: { failedCount, requestedCourseCount: courseIds.length },
          },
        });
      }
      nextAssignments.forEach((assignment) =>
        dealWithDescription(assignment, nextLinksMap)
      );
      setLinksMap(nextLinksMap);
      setAssignments(nextAssignments);
      setExpandedAssignmentIds([]);
    } catch (error) {
      if (requestId !== assignmentLoadIdRef.current) return;
      messageApi.error(error as string);
    }
    if (requestId === assignmentLoadIdRef.current) setOperating(false);
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    const file = attachmentToFile(attachment);
    try {
      await invoke("download_file", { file });
      messageApi.success("下载成功", 0.5);
    } catch (error) {
      messageApi.error(`下载失败：${error}`);
    }
  };

  const handleCourseSelect = (courseId: number) => {
    if (courseId === ALL_COURSES_ID) {
      setCourseScopeId(ALL_COURSES_ID);
      return;
    }
    const selectedCourse = courses.data.find((course) => course.id === courseId);
    if (!selectedCourse) {
      return;
    }
    setCourseScopeId(courseId);
    setSelectedCourseId(courseId);
  };

  const courseScopeKey = courses.data.map((course) => course.id).join(",");
  useEffect(() => {
    if (
      courseScopeId !== ALL_COURSES_ID &&
      !courses.data.some((course) => course.id === courseScopeId)
    ) {
      setCourseScopeId(ALL_COURSES_ID);
      return;
    }
    void handleGetAssignments(courseScopeId, onlyShowUnfinished);
    // Reload when the global term changes the available course IDs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseScopeId, courseScopeKey, onlyShowUnfinished]);

  const handleSetOnlyShowUnfinished = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = event.target.checked;
    setOnlyShowUnfinished(nextValue);
  };

  const dealWithDescription = (
    assignment: Assignment,
    nextLinksMap: Record<number, Attachment[]>
  ) => {
    if (!assignment.description) {
      return;
    }
    const parser = new DOMParser();
    const document = parser.parseFromString(assignment.description, "text/html");
    const anchorTags = document.querySelectorAll("a");
    const downloadableRegex =
      /https:\/\/oc\.sjtu\.edu\.cn\/courses\/(\d+)\/files\/(\d+)/g;
    const id = assignment.id;
    if (!nextLinksMap[id]) {
      nextLinksMap[id] = [];
    }
    const links = nextLinksMap[id];
    anchorTags.forEach((anchorTag) => {
      anchorTag.setAttribute("target", "_blank");
      const result = anchorTag.href.match(downloadableRegex);
      if (result && result.length > 0) {
        const urlObj = new URL(anchorTag.href);
        const params = new URLSearchParams(urlObj.search);
        const url = result[0] + "/download?" + params;
        links.push({
          url,
          display_name: anchorTag.text,
          key: url,
        } as Attachment);
      }
    });
    assignment.description = document.body.innerHTML;
  };

  const handleGetMySingleSubmission = async (
    courseId: number,
    assignmentId: number
  ) => {
    try {
      const submission = (await invoke("get_my_single_submission", {
        courseId,
        assignmentId,
      })) as Submission;
      const nextAssignments = assignments.map((assignment) =>
        assignment.id === assignmentId && assignment.course_id === courseId
          ? { ...assignment, submission }
          : assignment
      );
      setAssignments(nextAssignments);
    } catch (error) {
      consoleLog(LOG_LEVEL_ERROR, error);
      messageApi.error(`加载出错：${error}`);
    }
  };

  const handleDeleteComment = async (
    commentId: number,
    assignmentId: number,
    courseId: number
  ) => {
    try {
      await invoke("delete_my_submission_comment", {
        courseId,
        assignmentId,
        commentId,
      });
      messageApi.success("删除成功", 0.5);
      await handleGetMySingleSubmission(courseId, assignmentId);
    } catch (error) {
      consoleLog(LOG_LEVEL_ERROR, error);
      messageApi.error(error as string);
    }
  };

  const toggleExpanded = async (assignment: Assignment) => {
    const expanded = expandedAssignmentIds.includes(assignment.id);
    if (expanded) {
      setExpandedAssignmentIds((prev) => prev.filter((id) => id !== assignment.id));
      return;
    }
    setExpandedAssignmentIds((prev) => [...prev, assignment.id]);
    if (!isTAOrTeacher(assignment.course_id)) {
      await handleGetMySingleSubmission(assignment.course_id, assignment.id);
    }
  };

  const getAssignmentStatusChips = (
    assignment: Assignment,
    submission?: Submission
  ) => {
    const chips = [];
    chips.push(
      <Chip
        key="time"
        label={assignmentIsEnded(assignment) ? "已截止" : "进行中"}
        color={assignmentIsEnded(assignment) ? "warning" : "primary"}
        variant={assignmentIsEnded(assignment) ? "outlined" : "filled"}
        size="small"
      />
    );
    if (assignmentNotNeedSubmit(assignment)) {
      chips.push(
        <Chip key="skip" label="无需提交" variant="outlined" size="small" />
      );
    } else if (submission?.submitted_at) {
      chips.push(
        <Chip
          key="submission"
          label={submission.late ? "迟交" : "已提交"}
          color={submission.late ? "error" : "success"}
          variant="outlined"
          size="small"
        />
      );
    } else {
      chips.push(
        <Chip
          key="submission"
          label="未提交"
          color="error"
          variant="outlined"
          size="small"
        />
      );
    }
    return chips;
  };

  const renderAttachmentsTable = (
    rows: Attachment[] | undefined,
    showSubmittedAt = false
  ) => {
    if (!rows || rows.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          暂无可展示的文件。
        </Typography>
      );
    }

    return (
      <Box
        sx={{
          borderRadius: "8px",
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>文件</TableCell>
              {showSubmittedAt ? <TableCell>提交时间</TableCell> : null}
              {showSubmittedAt ? <TableCell>状态</TableCell> : null}
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((attachment) => (
              <TableRow key={attachment.id ?? attachment.key}>
                <TableCell>
                  <MuiLink
                    component="button"
                    underline="hover"
                    onMouseEnter={() => onHoverEntry(attachmentToFile(attachment))}
                    onMouseLeave={onLeaveEntry}
                    onClick={() => setPreviewEntry(attachmentToFile(attachment))}
                  >
                    {attachment.display_name}
                  </MuiLink>
                </TableCell>
                {showSubmittedAt ? (
                  <TableCell>{formatDate(attachment.submitted_at)}</TableCell>
                ) : null}
                {showSubmittedAt ? (
                  <TableCell>
                    <Chip
                      size="small"
                      label={attachment.late ? "迟交" : "按时提交"}
                      color={attachment.late ? "error" : "success"}
                      variant="outlined"
                    />
                  </TableCell>
                ) : null}
                <TableCell align="right">
                  <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="flex-end"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    {attachment.url ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownloadRoundedIcon />}
                        onClick={() => void handleDownloadAttachment(attachment)}
                      >
                        下载
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<PreviewRoundedIcon />}
                      onClick={() => setPreviewEntry(attachmentToFile(attachment))}
                    >
                      预览
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  };

  const selectedCourse = courses.data.find(
    (course) => course.id === courseScopeId
  );

  return (
    <BasicLayout>
      {contextHolder}
      {previewer}
      {assignmentToModify ? (
        <ModifyDDLModal
          open={showModifyDDLModal}
          assignment={assignmentToModify}
          handleCancel={() => setShowModifyDDLModal(false)}
          onRefresh={() =>
            void handleGetAssignments(courseScopeId, onlyShowUnfinished)
          }
          onSuccess={() => {
            setShowModifyDDLModal(false);
            void handleGetAssignments(courseScopeId, onlyShowUnfinished);
          }}
          courseId={assignmentToModify.course_id}
        />
      ) : null}
      {selectedAssignment ? (
        <SubmitModal
          open={showModal}
          allowed_extensions={selectedAssignment.allowed_extensions}
          courseId={selectedAssignment.course_id}
          assignmentId={selectedAssignment.id}
          onCancel={() => setShowModal(false)}
          onSubmit={() => {
            setShowModal(false);
            setSelectedAssignment(undefined);
            messageApi.success("提交成功", 0.5);
            void handleGetMySingleSubmission(
              selectedAssignment.course_id,
              selectedAssignment.id
            );
          }}
        />
      ) : null}

      <Stack spacing={3}>
        <WorkspaceHero
          chipLabel="作业管理"
          chipIcon={<AssignmentRoundedIcon />}
          title="作业工作台"
          description="集中查看课程作业、提交状态、得分概览和历史评论。"
          aside={
            <Box
              sx={{
                width: { xs: "100%", lg: 640 },
                alignSelf: { xs: "stretch", lg: "flex-start" },
              }}
            >
              <CourseSelect
                onChange={(courseId) => void handleCourseSelect(courseId)}
                disabled={operating}
                courses={courses.data}
                includeAllOption
                value={courseScopeId}
              />
            </Box>
          }
          stats={[
            { label: "作业总数", value: assignmentSummary.total },
            { label: "待完成", value: assignmentSummary.unfinished },
            { label: "已提交", value: assignmentSummary.submitted },
            { label: "已截止", value: assignmentSummary.ended },
          ]}
          footer={
            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems={{ xs: "stretch", md: "center" }}
              justifyContent="space-between"
              spacing={2}
            >
              {courseScopeId === ALL_COURSES_ID || !isTAOrTeacher(courseScopeId) ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={onlyShowUnfinished}
                      onChange={(event) =>
                        void handleSetOnlyShowUnfinished(event)
                      }
                    />
                  }
                  label="只显示未完成作业"
                  sx={{ m: 0 }}
                />
              ) : (
                <Chip label="教师 / 助教模式" color="primary" variant="outlined" />
              )}
              {courseScopeId === ALL_COURSES_ID ? (
                <Chip
                  icon={<CalendarMonthRoundedIcon />}
                  label={`当前学期全部课程（${courses.data.length} 门）`}
                  color="primary"
                  variant="outlined"
                />
              ) : selectedCourse ? (
                <Chip
                  icon={<CalendarMonthRoundedIcon />}
                  label={selectedCourse.name}
                  color="primary"
                  variant="outlined"
                />
              ) : null}
            </Stack>
          }
        />

        <Card sx={surfaceCardSx}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  成绩概览
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  已评分作业会在这里汇总成图，帮助快速判断失分分布。
                </Typography>
              </Box>
              <GradeOverviewChart gradeMap={gradeMap} />
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2.25}>
          {operating && assignments.length === 0 ? (
            <ListSkeleton items={3} />
          ) : null}
          {!operating && assignments.length === 0 ? (
            <Card sx={surfaceCardSx}>
              <CardContent sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  当前范围内没有可显示的作业
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  可以关闭“只显示未完成”，或返回首页切换学期范围。
                </Typography>
              </CardContent>
            </Card>
          ) : null}
          {assignments.map((assignment) => {
            const assignmentCourse = courses.data.find(
              (course) => course.id === assignment.course_id
            );
            const expanded = expandedAssignmentIds.includes(assignment.id);
            const submission = assignment.submission ?? undefined;
            const attachments =
              submission?.attachments?.map((attachment) => ({
                ...attachment,
                submitted_at: submission.submitted_at,
                key: attachment.id,
              })) ?? [];
            const submissionComments = submission?.submission_comments ?? [];
            const scoreText = assignment.points_possible
              ? `${assignment.submission?.grade ?? 0}/${assignment.points_possible}`
              : assignment.submission?.grade ?? "-";
            const stats = assignment.score_statistics as ScoreStatistic | null;
            const now = dayjs();
            const lockAt = dayjs(assignment.lock_at);
            const dueAt = dayjs(assignment.due_at);
            const allowSubmit =
              !isTAOrTeacher(assignment.course_id) &&
              !!assignment.submission &&
              !assignment.submission_types.includes("none") &&
              !assignment.submission_types.includes("not_graded") &&
              !now.isAfter(lockAt) &&
              !now.isAfter(dueAt);

            return (
              <Card key={`${assignment.course_id}-${assignment.id}`} sx={surfaceCardSx}>
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Stack spacing={2.5}>
                    <Stack
                      direction={{ xs: "column", lg: "row" }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {assignment.name}
                          </Typography>
                          {courseScopeId === ALL_COURSES_ID && assignmentCourse ? (
                            <Chip
                              size="small"
                              label={assignmentCourse.name}
                              color="info"
                              variant="outlined"
                            />
                          ) : null}
                          {getAssignmentStatusChips(assignment, submission)}
                        </Stack>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography variant="body2" color="text.secondary">
                            开始时间：{formatDate(assignment.unlock_at)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            截止时间：
                            {formatDate(getBaseDate(assignment.all_dates)?.due_at)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            结束时间：
                            {formatDate(getBaseDate(assignment.all_dates)?.lock_at)}
                          </Typography>
                        </Stack>
                      </Stack>

                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "stretch", sm: "center" }}
                      >
                        <Chip
                          label={`得分：${scoreText}`}
                          color="primary"
                          variant="outlined"
                        />
                        {stats ? (
                          <Chip
                            label={`最低/最高/平均：${stats.min}/${stats.max}/${stats.mean}`}
                            variant="outlined"
                          />
                        ) : null}
                      </Stack>
                    </Stack>

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Button
                        variant="outlined"
                        startIcon={expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                        onClick={() => void toggleExpanded(assignment)}
                      >
                        {expanded ? "收起详情" : "展开详情"}
                      </Button>
                      <Button
                        component="a"
                        href={assignment.html_url}
                        target="_blank"
                        rel="noreferrer"
                        variant="text"
                        startIcon={<LaunchRoundedIcon />}
                      >
                        在 Canvas 打开
                      </Button>
                      {isTAOrTeacher(assignment.course_id) ? (
                        <Button
                          variant="text"
                          startIcon={<EditCalendarRoundedIcon />}
                          onClick={() => {
                            setShowModifyDDLModal(true);
                            setAssignmentToModify(assignment);
                          }}
                        >
                          修改日期
                        </Button>
                      ) : allowSubmit ? (
                        <Button
                          variant="contained"
                          startIcon={<SendRoundedIcon />}
                          onClick={() => {
                            setSelectedAssignment(assignment);
                            setShowModal(true);
                          }}
                        >
                          提交作业
                        </Button>
                      ) : null}
                    </Stack>

                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                      <Stack spacing={2.5} sx={{ pt: 1 }}>
                        <Box
                          sx={{
                            p: 2.25,
                            borderRadius: "8px",
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                            作业描述
                          </Typography>
                          {assignment.description ? (
                            <Box
                              sx={{
                                color: "text.secondary",
                                "& a": {
                                  color: "primary.main",
                                },
                                "& img": {
                                  maxWidth: "100%",
                                },
                              }}
                              dangerouslySetInnerHTML={{
                                __html: assignment.description,
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              暂无作业描述。
                            </Typography>
                          )}
                        </Box>

                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.25 }}>
                            作业附件
                          </Typography>
                          {renderAttachmentsTable(linksMap[assignment.id])}
                        </Box>

                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.25 }}>
                            历史评论
                          </Typography>
                          {submissionComments.length ? (
                            <List
                              sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: "8px",
                                overflow: "hidden",
                                p: 0,
                              }}
                            >
                              {submissionComments.map((comment, index) => (
                                <Box key={comment.id}>
                                  <ListItem
                                    alignItems="flex-start"
                                    secondaryAction={
                                      comment.author_id === me.data?.id ? (
                                        <Button
                                          color="error"
                                          variant="text"
                                          size="small"
                                          onClick={() =>
                                            void handleDeleteComment(
                                              comment.id,
                                              assignment.id,
                                              assignment.course_id
                                            )
                                          }
                                        >
                                          删除
                                        </Button>
                                      ) : undefined
                                    }
                                  >
                                    <ListItemAvatar>
                                      <Avatar src={baseURL.data + comment.avatar_path} />
                                    </ListItemAvatar>
                                    <ListItemText
                                      primary={comment.author_name}
                                      secondary={comment.comment}
                                    />
                                  </ListItem>
                                  {index !== submissionComments.length - 1 ? (
                                    <Divider component="li" />
                                  ) : null}
                                </Box>
                              ))}
                            </List>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              暂无评论记录。
                            </Typography>
                          )}
                        </Box>

                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.25 }}>
                            我的提交
                          </Typography>
                          {renderAttachmentsTable(attachments, true)}
                        </Box>
                      </Stack>
                    </Collapse>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          {!operating && assignments.length === 0 ? (
            <Card sx={surfaceCardSx}>
              <CardContent sx={{ py: 8 }}>
                <Typography align="center" variant="h6" sx={{ fontWeight: 700 }}>
                  当前没有可展示的作业
                </Typography>
                <Typography align="center" variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  可以切换课程，或者关闭“只显示未完成”后再看看。
                </Typography>
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Stack>
    </BasicLayout>
  );
}

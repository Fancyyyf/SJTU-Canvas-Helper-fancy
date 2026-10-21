import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import ClosedCaptionRoundedIcon from "@mui/icons-material/ClosedCaptionRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  FormControl, InputLabel, LinearProgress, MenuItem, Select, Stack,
  Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import BasicLayout from "../components/layout";
import SubtitleAgentDialog from "../components/subtitle_agent_dialog";
import type { AgentMode, AgentProgress, KnowledgeSource } from "../components/subtitle_agent_dialog";
import { WorkspaceHero } from "../components/workspace_hero";
import type { CanvasVideo, Course } from "../lib/model";

type Language = "res" | "zh" | "en";
type ArchiveSource = "bundled" | "saved";
type ManifestItem = { stem: string; courseId: number | null };
type SavedItem = { stem: string; courseFolder: string; courseId: number; hasAgent: boolean; hasCleaned: boolean; hasKnowledgeRaw: boolean; hasKnowledgeCleaned: boolean };
type ArchiveItem = ManifestItem & { source: ArchiveSource; course: string; lesson: number | null; part: number | null; hasAgent: boolean; hasCleaned: boolean; hasKnowledgeRaw: boolean; hasKnowledgeCleaned: boolean };
type Segment = { bg: number; ed: number; courseId: number; res: string; zh?: string; en?: string };
type SubtitlePayload = { data?: { afterAssemblyList?: Segment[] } };

const archiveBase = `${import.meta.env.BASE_URL}subtitle_archive`;
const stemPattern = /^(.*)_(\d+)_([12])$/;

function makeItem(item: ManifestItem, source: ArchiveSource, courseFolder?: string, flags?: Partial<SavedItem>): ArchiveItem {
  const match = stemPattern.exec(item.stem);
  return {
    ...item,
    source,
    course: courseFolder || match?.[1] || item.stem.replace(/\d+$/, "") || "其他课程",
    lesson: match ? Number(match[2]) : null,
    part: match ? Number(match[3]) : null,
    hasAgent: flags?.hasAgent || false,
    hasCleaned: flags?.hasCleaned || false,
    hasKnowledgeRaw: flags?.hasKnowledgeRaw || false,
    hasKnowledgeCleaned: flags?.hasKnowledgeCleaned || false,
  };
}

function sortItems(left: ArchiveItem, right: ArchiveItem): number {
  return Number(left.course !== "web2") - Number(right.course !== "web2")
    || left.course.localeCompare(right.course)
    || (left.lesson ?? Infinity) - (right.lesson ?? Infinity)
    || (left.part ?? 0) - (right.part ?? 0)
    || left.stem.localeCompare(right.stem);
}

function itemLabel(item: ArchiveItem): string {
  return item.lesson === null ? item.stem : `第 ${item.lesson} 次 · ${item.part === 1 ? "上半节" : "下半节"}`;
}

function formatTime(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) return "--:--";
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${minutes}:${remainder}` : `${minutes}:${remainder}`;
}

function segmentText(segment: Segment, language: Language): string {
  return segment[language] || (language === "res" ? "" : segment.res) || "";
}

function courseFolderName(course: Course): string {
  const name = Array.from(course.name, (character) => /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? "_" : character)
    .join("").trim().replace(/[. ]+$/, "");
  const shortName = Array.from(name).slice(0, 65).join("") || "未命名课程";
  return `${shortName}_${course.id}`;
}

function alreadyTaught(video: CanvasVideo): boolean {
  const parseCourseTime = (value: string) => {
    const raw = value.trim();
    const numeric = /^\d{10,13}$/.test(raw) ? Number(raw) : NaN;
    return Number.isFinite(numeric) ? (raw.length === 10 ? numeric * 1000 : numeric) : Date.parse(raw.replace(" ", "T"));
  };
  const end = parseCourseTime(video.courseEndTime);
  const begin = parseCourseTime(video.courseBeginTime);
  const taughtAt = Number.isFinite(end) ? end : begin;
  return !Number.isFinite(taughtAt) || taughtAt <= Date.now();
}

function highlighted(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  const pieces: ReactNode[] = [];
  let offset = 0;
  let index = lower.indexOf(needle, offset);
  while (index >= 0) {
    pieces.push(text.slice(offset, index), <mark key={index}>{text.slice(index, index + query.length)}</mark>);
    offset = index + query.length;
    index = lower.indexOf(needle, offset);
  }
  pieces.push(text.slice(offset));
  return pieces;
}

export default function SubtitleArchivePage() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [selectedStem, setSelectedStem] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [payload, setPayload] = useState<SubtitlePayload | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [agentResult, setAgentResult] = useState("");
  const [readerTab, setReaderTab] = useState<"subtitle" | "agent">("subtitle");
  const [agentMode, setAgentMode] = useState<AgentMode>("clean");
  const [knowledgeSource, setKnowledgeSource] = useState<KnowledgeSource>("raw");
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentProgress, setAgentProgress] = useState<AgentProgress | null>(null);
  const [archiveLocation, setArchiveLocation] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<Language>("res");
  const [fontSize, setFontSize] = useState(17);
  const [loading, setLoading] = useState(true);
  const [readerError, setReaderError] = useState("");
  const [notice, setNotice] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [captureCourseId, setCaptureCourseId] = useState<number | "">("");
  const [prefix, setPrefix] = useState("");
  const [captureStatus, setCaptureStatus] = useState("请先加载视频课程目录。");
  const [captureProgress, setCaptureProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => () => { stopRef.current = true; }, []);

  useEffect(() => {
    let disposed = false;
    let detach: (() => void) | undefined;
    void listen<AgentProgress>("subtitle_archive://agent_progress", (event) => {
      if (!disposed) setAgentProgress(event.payload);
    }).then((unlisten) => {
      if (disposed) unlisten(); else detach = unlisten;
    }).catch(() => { /* Browser preview has no Tauri event bridge. */ });
    return () => { disposed = true; detach?.(); };
  }, []);

  const refresh = useCallback(async () => {
    setArchiveLocation("");
    const response = await fetch(`${archiveBase}/manifest.json`);
    if (!response.ok) throw new Error(`原始资料目录读取失败：HTTP ${response.status}`);
    const bundled = (await response.json() as ManifestItem[]).map((item) => makeItem(item, "bundled"));
    let saved: ArchiveItem[] = [];
    try {
      const location = await invoke<string>("archive_location");
      setArchiveLocation(location);
      let records = await invoke<SavedItem[]>("list_saved_subtitles");
      const missing = bundled.filter((item) => !records.some((savedItem) => savedItem.courseFolder === item.course && savedItem.stem === item.stem));
      for (const [index, item] of missing.entries()) {
        if (item.courseId === null) continue;
        setImportStatus(`正在整理原始资料 ${index + 1}/${missing.length}：${item.stem}`);
        const rawResponse = await fetch(`${archiveBase}/json_data/${item.stem}.json`);
        if (!rawResponse.ok) throw new Error(`原始 JSON 读取失败：${item.stem}`);
        await invoke("import_bundled_subtitle", {
          courseFolder: item.course,
          stem: item.stem,
          courseId: item.courseId,
          rawJson: await rawResponse.text(),
        });
      }
      setImportStatus("");
      if (missing.length) records = await invoke<SavedItem[]>("list_saved_subtitles");
      saved = records.map((record) => makeItem({ stem: record.stem, courseId: record.courseId }, "saved", record.courseFolder, record));
    } catch (error) {
      setImportStatus(`下载目录整理暂不可用：${String(error)}`);
    }
    const next = [...bundled.filter((item) => !saved.some((savedItem) => savedItem.course === item.course && savedItem.stem === item.stem)), ...saved].sort(sortItems);
    setItems(next);
    setSelectedStem((current) => current && next.some((item) => item.stem === current) ? current : next[0]?.stem || "");
    setSelectedCourse((current) => current && next.some((item) => item.course === current) ? current : next[0]?.course || "");
  }, []);

  useEffect(() => {
    refresh().catch((error) => setReaderError(String(error))).finally(() => setLoading(false));
  }, [refresh]);

  const selectedItem = useMemo(() => items.find((item) => item.stem === selectedStem && item.course === selectedCourse), [items, selectedStem, selectedCourse]);
  useEffect(() => { if (knowledgeSource === "cleaned" && !selectedItem?.hasCleaned) setKnowledgeSource("raw"); }, [knowledgeSource, selectedItem]);
  useEffect(() => {
    if (!selectedItem) return;
    let cancelled = false;
    setPayload(null);
    setRawJson("");
    setAgentResult("");
    setReaderError("");
    setQuery("");
    const task = selectedItem.source === "bundled"
      ? fetch(`${archiveBase}/json_data/${selectedItem.stem}.json`).then((response) => {
        if (!response.ok) throw new Error(`字幕读取失败：HTTP ${response.status}`);
        return response.text();
      })
      : invoke<string>("read_saved_subtitle", { courseFolder: selectedItem.course, stem: selectedItem.stem });
    task.then(async (raw) => {
      if (cancelled) return;
      setRawJson(raw);
      setPayload(JSON.parse(raw) as SubtitlePayload);
      if (selectedItem.source === "saved") {
        const result = await invoke<string | null>("read_archive_agent_result", {
          courseFolder: selectedItem.course, stem: selectedItem.stem, mode: agentMode, source: knowledgeSource,
        });
        if (!cancelled) setAgentResult(result || "");
      }
    })
      .catch((error) => { if (!cancelled) setReaderError(String(error)); });
    return () => { cancelled = true; };
  }, [selectedItem, agentMode, knowledgeSource]);

  const courseNames = useMemo(() => [...new Set(items.map((item) => item.course))], [items]);
  const courseItems = useMemo(() => items.filter((item) => item.course === selectedCourse), [items, selectedCourse]);
  useEffect(() => {
    if (courseItems.length && !courseItems.some((item) => item.stem === selectedStem)) {
      setSelectedStem(courseItems[0].stem);
    }
  }, [courseItems, selectedStem]);
  const selectedIndex = courseItems.findIndex((item) => item.stem === selectedStem);
  const segments = useMemo(() => payload?.data?.afterAssemblyList || [], [payload]);
  const visibleSegments = useMemo(() => segments.filter((segment) => segmentText(segment, language).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [segments, language, query]);

  const loadCourses = async () => {
    setLoadingCourses(true);
    setCaptureStatus("正在检查登录并加载课程…");
    try {
      await invoke("login_canvas_website");
      const result = await invoke<Course[]>("list_video_space_courses");
      setCourses(result);
      setCaptureCourseId(result[0]?.id || "");
      setCaptureStatus(result.length ? `已加载 ${result.length} 门课程` : "当前账号没有可抓取的视频课程");
    } catch (error) {
      setCaptureStatus(`无法加载课程：${String(error)}。请先在首页完成额外登录。`);
    } finally {
      setLoadingCourses(false);
    }
  };

  const startCapture = async () => {
    if (!archiveLocation || captureCourseId === "" || !/^[A-Za-z0-9_-]{1,70}$/.test(prefix)) {
      setCaptureStatus("请先配置下载目录、选择课程，并填写不超过 70 个字符的英数字文件名前缀（可含 _ 和 -）。");
      return;
    }
    stopRef.current = false;
    setCapturing(true);
    setFailures([]);
    setCaptureProgress({ done: 0, total: 0 });
    try {
      const course = courses.find((item) => item.id === captureCourseId);
      if (!course) throw new Error("找不到所选课程");
      const courseFolder = courseFolderName(course);
      const allVideos = await invoke<CanvasVideo[]>("get_video_space_videos", { teachingClassId: captureCourseId });
      const videos = allVideos
        .filter((video) => video.source === "videoSpace" && Number(video.videoId) > 0 && alreadyTaught(video))
        .sort((a, b) => a.courseBeginTime.localeCompare(b.courseBeginTime) || Number(a.videoId) - Number(b.videoId));
      if (!videos.length) throw new Error("这门课程还没有已上过的视频课次");
      setCaptureProgress({ done: 0, total: videos.length });
      setCaptureStatus(`找到 ${videos.length} 节已上过的课，开始逐节抓取字幕。`);
      let completed = 0;
      const failed: string[] = [];
      for (const [index, video] of videos.entries()) {
        if (stopRef.current) break;
        const stem = `${prefix}_${Math.floor(index / 2) + 1}_${index % 2 + 1}`;
        const courseId = Number(video.videoId);
        const existing = items.find((item) => item.course === courseFolder && item.stem === stem);
        if (existing?.courseId && existing.courseId !== courseId) {
          failed.push(`${stem}：文件名已对应另一节课`);
        } else {
          try {
            setCaptureStatus(`正在抓取 ${stem} · ${completed + 1}/${videos.length}`);
            await invoke("fetch_archive_subtitle", { courseFolder, stem, canvasCourseId: courseId });
            completed += 1;
          } catch (error) {
            failed.push(`${stem}：${String(error)}`);
          }
        }
        setCaptureProgress({ done: index + 1, total: videos.length });
        setFailures([...failed]);
      }
      setCaptureStatus(stopRef.current
        ? `已停止：处理 ${completed} 节，失败 ${failed.length} 节。再次开始可续抓。`
        : `处理完成：${completed} 节，失败 ${failed.length} 节。`);
      await refresh();
      setSelectedCourse(courseFolder);
      setSelectedStem(`${prefix}_1_1`);
    } catch (error) {
      setCaptureStatus(`抓取失败：${String(error)}`);
    } finally {
      setCapturing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(segments.map((segment) => segmentText(segment, language)).join(""));
      setNotice("字幕已复制到剪贴板");
    } catch (error) {
      setNotice(`复制失败：${String(error)}`);
    }
  };

  return <BasicLayout>
    <Stack spacing={2.5}>
      <WorkspaceHero chipLabel="COURSE TRANSCRIPT STUDIO" chipIcon={<ClosedCaptionRoundedIcon />}
        title="字幕工作台" description="资料按课程保存到设置中的下载目录，分别保留原始 JSON、提取 TXT 和 Agent 整理结果。"
        stats={[{ label: "已收录字幕", value: items.length }, { label: "课程分组", value: courseNames.length }]} />
      {notice && <Alert severity="info" onClose={() => setNotice("")}>{notice}</Alert>}
      {importStatus && <Alert severity="info">{importStatus}</Alert>}
      {archiveLocation && <Alert severity="success" action={<Button size="small" onClick={() => void invoke("open_archive_folder", { courseFolder: null })}>打开字幕目录</Button>}>
        保存位置：{archiveLocation}／课程文件夹／01_原始JSON、02_提取TXT、03_Agent整理
      </Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(225px, 270px) minmax(0, 1fr) minmax(250px, 300px)" }, gap: 2, alignItems: "start" }}>
        <Card><CardContent><Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">课程目录</Typography><Chip size="small" label={`${courseItems.length} 节`} /></Stack>
          <FormControl size="small" fullWidth><InputLabel>课程分组</InputLabel><Select value={selectedCourse} label="课程分组" onChange={(event) => {
            const course = event.target.value;
            setSelectedCourse(course);
            setSelectedStem(items.find((item) => item.course === course)?.stem || "");
          }}>{courseNames.map((course) => <MenuItem key={course} value={course}>{course}</MenuItem>)}</Select></FormControl>
          <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void refresh()}>刷新资料</Button>
          <Divider />
          <Stack sx={{ maxHeight: { lg: "65vh" }, overflowY: "auto" }} spacing={0.5}>
            {loading && <CircularProgress size={24} />}
            {courseItems.map((item) => <Button key={item.stem} variant={selectedStem === item.stem ? "contained" : "text"} color={selectedStem === item.stem ? "primary" : "inherit"}
              onClick={() => setSelectedStem(item.stem)} sx={{ justifyContent: "flex-start", textAlign: "left", textTransform: "none", lineHeight: 1.4, py: 1 }}>
              <Stack alignItems="flex-start"><span>{itemLabel(item)}</span><Typography variant="caption" sx={{ opacity: 0.7 }}>{item.stem} · {item.source === "saved" ? "已保存" : "内置资料"}{item.hasCleaned ? " · 已清理" : ""}{item.hasKnowledgeRaw || item.hasKnowledgeCleaned ? " · 有知识笔记" : ""}</Typography></Stack>
            </Button>)}
          </Stack>
          {!loading && !items.length && <Typography color="text.secondary">暂无字幕资料</Typography>}
        </Stack></CardContent></Card>

        <Card sx={{ minWidth: 0 }}><CardContent><Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box><Typography variant="h5">{selectedItem ? itemLabel(selectedItem) : "选择一节课"}</Typography><Typography variant="body2" color="text.secondary">{selectedItem?.stem || ""}{segments[0]?.courseId ? ` · 课程 ID ${segments[0].courseId}` : ""}</Typography></Box>
            <Stack direction="row"><Button disabled={selectedIndex <= 0} onClick={() => setSelectedStem(courseItems[selectedIndex - 1].stem)}>上一节</Button><Button disabled={selectedIndex < 0 || selectedIndex >= courseItems.length - 1} onClick={() => setSelectedStem(courseItems[selectedIndex + 1].stem)}>下一节</Button></Stack>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <TextField size="small" type="search" label="搜索本节字幕" value={query} onChange={(event) => setQuery(event.target.value)} sx={{ flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 125 }}><InputLabel>语言</InputLabel><Select value={language} label="语言" onChange={(event) => setLanguage(event.target.value as Language)}><MenuItem value="res">优化中文</MenuItem><MenuItem value="zh">原始中文</MenuItem><MenuItem value="en">英文</MenuItem></Select></FormControl>
            <Button size="small" onClick={() => setFontSize((size) => Math.max(14, size - 1))}>A−</Button><Button size="small" onClick={() => setFontSize((size) => Math.min(24, size + 1))}>A+</Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" startIcon={<ContentCopyRoundedIcon />} disabled={!segments.length} onClick={() => void handleCopy()}>复制</Button>
            <Button size="small" startIcon={<FolderOpenRoundedIcon />} disabled={!archiveLocation || !selectedItem} onClick={() => void invoke("open_archive_folder", { courseFolder: selectedItem?.course || null })}>打开本课程文件夹</Button>
          </Stack>
          {selectedItem && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={rawJson ? "① 原始 JSON" : "① 待读取 JSON"} color={rawJson ? "success" : "default"} />
            <Chip size="small" label={segments.length ? "② 提取 TXT" : "② 待提取 TXT"} color={segments.length ? "success" : "default"} />
            <Chip size="small" label={selectedItem.hasCleaned ? "③ 字幕已清理" : "③ 字幕待清理"} color={selectedItem.hasCleaned ? "success" : "default"} />
            <Chip size="small" label={selectedItem.hasKnowledgeRaw || selectedItem.hasKnowledgeCleaned ? "知识点已整理" : "知识点待整理"} color={selectedItem.hasKnowledgeRaw || selectedItem.hasKnowledgeCleaned ? "success" : "default"} />
          </Stack>}
          <Tabs value={readerTab} onChange={(_, value: "subtitle" | "agent") => setReaderTab(value)}><Tab label="字幕阅读" value="subtitle" /><Tab label="Agent 整理" value="agent" /></Tabs>
          {readerTab === "agent" && <Stack spacing={1}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button size="small" variant={agentMode === "clean" ? "contained" : "outlined"} onClick={() => setAgentMode("clean")}>字幕清理</Button>
              <Button size="small" variant={agentMode === "knowledge" ? "contained" : "outlined"} onClick={() => setAgentMode("knowledge")}>知识点整理</Button>
              <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} disabled={!selectedItem || selectedItem.source !== "saved"} onClick={() => setAgentDialogOpen(true)}>打开 Agent 小窗口</Button>
            </Stack>
            {agentMode === "knowledge" && <FormControl size="small"><InputLabel>查看结果来源</InputLabel><Select value={knowledgeSource} label="查看结果来源" onChange={(event) => setKnowledgeSource(event.target.value as KnowledgeSource)}>
              <MenuItem value="raw">原始 TXT</MenuItem><MenuItem value="cleaned" disabled={!selectedItem?.hasCleaned}>清理分段后的字幕</MenuItem>
            </Select></FormControl>}
            <Typography variant="caption" color="text.secondary">每节课独立处理，长字幕由代码按标点和长度切块，结果保存到第三层 Agent 目录。</Typography>
          </Stack>}
          <Divider />
          {readerTab === "subtitle" && <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">{query ? `${visibleSegments.length} / ${segments.length} 段匹配` : `${segments.length} 段字幕`}</Typography><Typography variant="caption" color="text.secondary">{segments.length ? `时长 ${formatTime(segments[segments.length - 1].ed)}` : ""}</Typography></Stack>}
          {readerError && <Alert severity="error">{readerError}</Alert>}
          {!payload && !readerError && selectedItem && <CircularProgress size={24} />}
          {readerTab === "subtitle" ? <Box sx={{ maxHeight: { lg: "65vh" }, minHeight: 270, overflowY: "auto" }}>
            {visibleSegments.map((segment, index) => <Box key={`${segment.bg}-${index}`} sx={{ display: "grid", gridTemplateColumns: "58px minmax(0, 1fr)", gap: 1.5, py: 1.8, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" color="primary" sx={{ pt: 0.5, fontVariantNumeric: "tabular-nums" }}>{formatTime(segment.bg)}</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.9, fontSize }}>{highlighted(segmentText(segment, language), query.trim())}</Typography>
            </Box>)}
            {payload && !visibleSegments.length && <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>{query ? "没有匹配的字幕" : "这节课暂无字幕内容"}</Typography>}
          </Box> : <Box sx={{ maxHeight: { lg: "65vh" }, minHeight: 270, overflowY: "auto", lineHeight: 1.8, "& h2": { mt: 3 }, "& p": { overflowWrap: "anywhere" } }}>
            {agentResult ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{agentResult}</ReactMarkdown> : <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>这节课还没有当前模式的 Agent 结果</Typography>}
          </Box>}
        </Stack></CardContent></Card>

        <Card><CardContent><Stack spacing={2}>
          <Typography variant="h6">批量抓取</Typography>
          <Typography variant="body2" color="text.secondary">从当前登录账号的视频空间选择课程，按授课时间抓取整门课字幕。</Typography>
          <Button variant="outlined" loading={loadingCourses} onClick={() => void loadCourses()}>{loadingCourses ? "加载中…" : "加载我的视频课程"}</Button>
          <FormControl size="small" fullWidth disabled={!courses.length || capturing}><InputLabel>视频课程</InputLabel><Select value={captureCourseId} label="视频课程" onChange={(event) => setCaptureCourseId(Number(event.target.value))}>{courses.map((course) => <MenuItem key={course.id} value={course.id}>{course.name} · {course.term?.name}</MenuItem>)}</Select></FormControl>
          <TextField size="small" label="文件名前缀" value={prefix} disabled={capturing} onChange={(event) => setPrefix(event.target.value)} helperText="例如 web2；最多 70 个字符，同一前缀可续抓" />
          <Button variant="contained" disabled={!archiveLocation || !courses.length || capturing} onClick={() => void startCapture()}>抓取所有已上过的课</Button>
          {capturing && <Button color="warning" onClick={() => { stopRef.current = true; setCaptureStatus("正在停止，等待当前请求完成…"); }}>停止任务</Button>}
          <Divider />
          <Typography variant="body2">{captureStatus}</Typography>
          <LinearProgress variant="determinate" value={captureProgress.total ? captureProgress.done / captureProgress.total * 100 : 0} />
          <Typography variant="caption" color="text.secondary">{captureProgress.done} / {captureProgress.total}</Typography>
          {failures.length > 0 && <Alert severity="warning"><Typography variant="subtitle2">失败记录（{failures.length}）</Typography>{failures.map((failure) => <Typography key={failure} variant="caption" display="block">{failure}</Typography>)}</Alert>}
          <Typography variant="caption" color="text.secondary">拉取当前课程所有已上过的视频课次。原始 JSON 与 TXT 自动写入设置中的下载目录；Agent 整理结果可在阅读器中按需生成。</Typography>
        </Stack></CardContent></Card>
      </Box>
    </Stack>
    <SubtitleAgentDialog
      open={agentDialogOpen}
      onClose={() => setAgentDialogOpen(false)}
      selected={selectedItem}
      courseItems={courseItems}
      progress={agentProgress}
      initialMode={agentMode}
      onRefresh={refresh}
      onCompleted={async (mode, source, result) => {
        setAgentMode(mode);
        setKnowledgeSource(source);
        setAgentResult(result);
        setReaderTab("agent");
        await refresh();
      }}
    />
  </BasicLayout>;
}

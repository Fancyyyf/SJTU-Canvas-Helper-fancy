import { invoke } from "@tauri-apps/api/core";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Select, Stack,
  Switch, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { runLimited } from "../lib/run_limited";
import { agentProgressKey } from "../lib/subtitle_agent_progress";
import { cleanedSourceAvailable, missingAgentResults } from "../lib/subtitle_agent_targets";

export type AgentMode = "clean" | "knowledge";
export type KnowledgeSource = "raw" | "cleaned";
export type AgentLesson = {
  stem: string;
  course: string;
  source: "bundled" | "saved";
  hasCleaned: boolean;
  hasKnowledgeRaw: boolean;
  hasKnowledgeCleaned: boolean;
};
export type AgentProgress = {
  courseFolder: string;
  stem: string;
  mode: AgentMode;
  done: number;
  total: number;
};
type PromptSet = { clean: string; knowledge: string; folder: string };

function formatElapsed(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(seconds / 60);
  const clock = `${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${clock}` : clock;
}

type Props = {
  open: boolean;
  onClose: () => void;
  selected: AgentLesson | undefined;
  courseItems: AgentLesson[];
  progress: Record<string, AgentProgress>;
  initialMode: AgentMode;
  onStart: () => void;
  onCompleted: (mode: AgentMode, source: KnowledgeSource, result: string) => Promise<void>;
  onRefresh: () => Promise<void>;
};

export default function SubtitleAgentDialog({ open, onClose, selected, courseItems, progress, initialMode, onStart, onCompleted, onRefresh }: Props) {
  const [mode, setMode] = useState<AgentMode>(initialMode);
  const [source, setSource] = useState<KnowledgeSource>("raw");
  const [scope, setScope] = useState<"lesson" | "course">("lesson");
  const [prompts, setPrompts] = useState<PromptSet | null>(null);
  const [maxTurns, setMaxTurns] = useState("6");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [parallelChunks, setParallelChunks] = useState(true);
  const [parallelLessons, setParallelLessons] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeItems, setActiveItems] = useState<Array<{ lesson: AgentLesson; startedAt: number }>>([]);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runFinishedAt, setRunFinishedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const stopRef = useRef(false);

  useEffect(() => { if (open) setMode(initialMode); }, [open, initialMode]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (!open) return;
    invoke<PromptSet>("get_archive_agent_prompts")
      .then(setPrompts)
      .catch((error) => setNotice(`读取提示词失败：${String(error)}`));
  }, [open]);

  const candidates = useMemo(() => {
    if (scope === "lesson") return selected?.source === "saved" ? [selected] : [];
    return courseItems.filter((item) => item.source === "saved");
  }, [scope, selected, courseItems]);
  const targets = useMemo(() => missingAgentResults(candidates, mode, source), [candidates, mode, source]);
  const skipped = candidates.length - targets.length;
  const cleanAvailable = cleanedSourceAvailable(candidates);
  useEffect(() => { if (!cleanAvailable && source === "cleaned") setSource("raw"); }, [cleanAvailable, source]);
  const activePrompt = prompts?.[mode] || "";
  const elapsed = runStartedAt === null ? 0 : (runFinishedAt ?? clock) - runStartedAt;

  const savePrompt = async () => {
    if (!prompts) return;
    if (!activePrompt.trim() || activePrompt.length > 12000) throw new Error("提示词不能为空，且不能超过 12000 字");
    await invoke("save_archive_agent_prompt", { mode, prompt: activePrompt });
    setNotice("提示词已保存；外部编辑同一文件后，可点“从文件重载”。");
  };

  const start = async () => {
    if (!prompts || !targets.length) return;
    setNotice(""); setErrors([]); setDone(0); setTotal(targets.length);
    setActiveItems([]);
    const startedAt = Date.now();
    setRunStartedAt(startedAt);
    setRunFinishedAt(null);
    setClock(startedAt);
    onStart();
    stopRef.current = false;
    setRunning(true);
    try {
      await savePrompt();
      const options = {
        max_turns: Math.trunc(Math.min(12, Math.max(1, Number(maxTurns) || 6))),
        max_tokens: Math.trunc(Math.min(8192, Math.max(256, Number(maxTokens) || 4096))),
      };
      const failed: string[] = [];
      let processed = 0;
      await runLimited(targets, scope === "course" && parallelLessons ? 2 : 1, async (item) => {
        setActiveItems((current) => [...current, { lesson: item, startedAt: Date.now() }]);
        try {
          const result = await invoke<string>("process_archive_agent", {
            courseFolder: item.course, stem: item.stem, mode, source, parallelChunks, options,
          });
          if (item.stem === selected?.stem && item.course === selected.course) await onCompleted(mode, source, result);
        } catch (error) {
          failed.push(`${item.stem}：${String(error)}`);
          setErrors([...failed]);
        } finally {
          setActiveItems((current) => current.filter(({ lesson }) => lesson.course !== item.course || lesson.stem !== item.stem));
          processed += 1;
          setDone(processed);
        }
      }, () => stopRef.current);
      await onRefresh();
      setNotice(stopRef.current
        ? `已停止，处理 ${processed} / ${targets.length} 节；失败 ${failed.length} 节。`
        : `处理完成：${processed - failed.length} / ${targets.length} 节成功。`);
    } catch (error) {
      setNotice(`无法开始：${String(error)}`);
    } finally {
      setRunFinishedAt(Date.now());
      setRunning(false);
      setActiveItems([]);
    }
  };

  return <Dialog open={open} onClose={running ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>字幕 Agent</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Typography variant="body2" color="text.secondary">使用 Canvas Agent 的模型、密钥和服务地址设置。字幕清理每节最多并行 5 块，按原顺序合并；批量处理最多并行 2 节课。</Typography>
      <ToggleButtonGroup exclusive fullWidth size="small" value={mode} onChange={(_, value: AgentMode | null) => { if (value) setMode(value); }} disabled={running}>
        <ToggleButton value="clean">① 清理与分段</ToggleButton><ToggleButton value="knowledge">② 知识点整理</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup exclusive fullWidth size="small" value={scope} onChange={(_, value: "lesson" | "course" | null) => { if (value) setScope(value); }} disabled={running}>
        <ToggleButton value="lesson">当前课次</ToggleButton><ToggleButton value="course">本课程全部课次</ToggleButton>
      </ToggleButtonGroup>
      {mode === "knowledge" && <FormControl fullWidth size="small"><InputLabel>输入来源</InputLabel><Select label="输入来源" value={source} disabled={running} onChange={(event) => setSource(event.target.value as KnowledgeSource)}>
        <MenuItem value="raw">原始 TXT</MenuItem><MenuItem value="cleaned" disabled={!cleanAvailable}>清理分段后的字幕{!cleanAvailable ? "（尚未全部生成）" : ""}</MenuItem>
      </Select></FormControl>}
      {mode === "clean" && <FormControlLabel control={<Switch checked={parallelChunks} onChange={(event) => setParallelChunks(event.target.checked)} disabled={running} />} label="分块并发（最多 5 块；关闭后逐块处理）" />}
      {scope === "course" && <FormControlLabel control={<Switch checked={parallelLessons} onChange={(event) => setParallelLessons(event.target.checked)} disabled={running} />} label="课次并发（最多 2 节；关闭后逐节处理）" />}
      {skipped > 0 && <Alert severity="info">当前模式已有 {skipped} 节结果，已自动跳过。</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <TextField size="small" type="number" label="最大轮次" value={maxTurns} disabled={running} onChange={(event) => setMaxTurns(event.target.value)} inputProps={{ min: 1, max: 12 }} />
        <TextField size="small" type="number" label="最大输出 Tokens" value={maxTokens} disabled={running} onChange={(event) => setMaxTokens(event.target.value)} inputProps={{ min: 256, max: 8192 }} />
      </Box>
      <TextField label={mode === "clean" ? "字幕清理提示词" : "知识点整理提示词"} multiline minRows={7} maxRows={13} fullWidth value={activePrompt}
        disabled={running || !prompts} onChange={(event) => setPrompts((value) => value ? { ...value, [mode]: event.target.value } : value)} />
      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>提示词文件：{prompts?.folder || "加载中…"}</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" disabled={!prompts || running} onClick={() => void savePrompt().catch((error) => setNotice(String(error)))}>保存提示词</Button>
        <Button size="small" disabled={running} onClick={() => void invoke<PromptSet>("get_archive_agent_prompts").then((value) => { setPrompts(value); setNotice("已从文件重载提示词"); }).catch((error) => setNotice(String(error)))}>从文件重载</Button>
        <Button size="small" startIcon={<FolderOpenRoundedIcon />} onClick={() => void invoke("open_archive_prompt_folder")}>打开提示词目录</Button>
      </Stack>
      {running && <><LinearProgress variant="determinate" value={total ? done / total * 100 : 0} />
        <Typography variant="caption">已完成 {done} / {total} 节 · 已用时 {formatElapsed(elapsed)} · 同时处理最多 {scope === "course" && parallelLessons ? 2 : 1} 节</Typography>
        {activeItems.map(({ lesson: item, startedAt }) => {
          const currentProgress = progress[agentProgressKey({ courseFolder: item.course, stem: item.stem, mode })];
          return <Box key={`${item.course}/${item.stem}`}>
            <Typography variant="caption">{item.stem}{currentProgress ? ` · 块 ${currentProgress.done}/${currentProgress.total}` : " · 正在启动"} · 用时 {formatElapsed(clock - startedAt)}</Typography>
            <LinearProgress variant={currentProgress?.total ? "determinate" : "indeterminate"} value={currentProgress?.total ? currentProgress.done / currentProgress.total * 100 : undefined} />
          </Box>;
        })}</>}
      {!running && total > 0 && <Typography variant="caption">已处理 {done} / {total} 节 · 本次用时 {formatElapsed(elapsed)}</Typography>}
      {notice && <Alert severity={errors.length ? "warning" : "info"}>{notice}</Alert>}
      {errors.length > 0 && <Alert severity="warning">{errors.map((item) => <Typography key={item} variant="caption" display="block">{item}</Typography>)}</Alert>}
    </Stack></DialogContent>
    <DialogActions>
      {running ? <Button color="warning" onClick={() => { stopRef.current = true; setNotice("正在等待当前处理的课次完成后停止"); }}>当前课次后停止</Button> : <Button onClick={onClose}>关闭</Button>}
      <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} disabled={running || !targets.length || !prompts || (mode === "knowledge" && source === "cleaned" && !cleanAvailable)} onClick={() => void start()}>
        处理 {targets.length} 节
      </Button>
    </DialogActions>
  </Dialog>;
}

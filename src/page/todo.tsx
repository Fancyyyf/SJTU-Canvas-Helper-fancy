import { invoke } from "@tauri-apps/api/core";
import { Alert, Box, Button, Card, Checkbox, Chip, IconButton, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import BasicLayout from "../components/layout";
import { addPersonalTodo, readTodos, removePersonalTodo, subscribeTodos, syncTodos, updateTodo, type TodoItem } from "../lib/todo";
import { checkTodoReminders, enableTodoNotifications } from "../lib/todo_reminders";

function label(item: TodoItem) {
  return { pending: "待完成", submitted: "已提交", graded: "已评分", completed: "已完成", offline: "线下完成" }[item.status];
}
export default function TodoPage() {
  const [account, setAccount] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => subscribeTodos(() => setRevision((value) => value + 1)), []);
  useEffect(() => { void invoke<{ current_account: string }>("read_account_info")
    .then((info) => setAccount(info.current_account || "local")).catch((value) => setError(String(value))); }, []);
  useEffect(() => {
    if (!account) return;
    setBusy(true);
    void syncTodos(account).catch((value) => setError(String(value))).finally(() => setBusy(false));
  }, [account]);
  const snapshot = useMemo(() => account ? readTodos(account) : { updatedAt: null, items: [], failedCourses: [] }, [account, revision]);
  const items = useMemo(() => snapshot.items.filter((item) => {
    if (filter === "open") return item.status === "pending" || item.status === "offline";
    if (filter === "done") return item.status === "completed" || item.status === "submitted" || item.status === "graded";
    if (filter === "unread") return item.source === "canvas" && !item.read;
    return true;
  }).sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity)), [snapshot, filter]);
  const refresh = async () => {
    if (!account) return;
    setBusy(true); setError("");
    try { await syncTodos(account); } catch (value) { setError(String(value)); }
    finally { setBusy(false); }
  };
  const create = () => {
    if (!account || !title.trim()) return;
    addPersonalTodo(account, title, dueAt ? new Date(dueAt).toISOString() : null);
    setTitle(""); setDueAt("");
  };
  return <BasicLayout>
    <Stack spacing={2.5} sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box><Typography variant="h4">TODO 与提醒</Typography>
          <Typography color="text.secondary">个人待办与 Canvas 学生作业统一查看；有无截止时间的作业都会收录。</Typography></Box>
        <Button startIcon={<RefreshRoundedIcon />} disabled={busy} onClick={() => void refresh()}>同步作业</Button>
      </Stack>
      <Button sx={{ alignSelf: "flex-start" }} onClick={() => void enableTodoNotifications().then((granted) => {
        setError(granted ? "" : "系统通知未获授权，请在系统设置中允许通知");
        if (granted && account) void checkTodoReminders(account);
      })}>开启系统提醒</Button>
      {error && <Alert severity="warning">{error}</Alert>}
      {snapshot.failedCourses.length > 0 && <Alert severity="warning">以下课程同步失败，保留了旧数据：{snapshot.failedCourses.join("、")}</Alert>}
      <Card sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center">
          <TextField label="新增个人待办" value={title} onChange={(event) => setTitle(event.target.value)} fullWidth size="small" />
          <TextField label="截止时间（可选）" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)}
            InputLabelProps={{ shrink: true }} size="small" sx={{ minWidth: 230 }} />
          <Button variant="contained" onClick={create} disabled={!title.trim() || !account}>添加</Button>
        </Stack>
      </Card>
      <Tabs value={filter} onChange={(_, value: string) => setFilter(value)}>
        <Tab label="待完成" value="open" /><Tab label={"新通知 " + snapshot.items.filter((item) => item.source === "canvas" && !item.read).length} value="unread" />
        <Tab label="已完成" value="done" /><Tab label="全部" value="all" />
      </Tabs>
      {items.length === 0 && <Alert severity="info">{busy ? "正在同步作业…" : "暂无待办"}</Alert>}
      {items.map((item) => <Card key={item.id} sx={{ p: 1.5, opacity: item.status === "completed" ? 0.65 : 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {item.source === "personal" && <Checkbox checked={item.status === "completed"}
            onChange={(event) => account && updateTodo(account, item.id, { status: event.target.checked ? "completed" : "pending" })} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{item.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {item.courseName || "个人待办"} · {item.dueAt ? dayjs(item.dueAt).format("YYYY-MM-DD HH:mm") : "无截止时间"}
            </Typography>
          </Box>
          <Chip label={label(item)} color={item.status === "pending" ? "warning" : "default"} size="small" />
          {item.source === "canvas" && !item.read && <Chip label="新" color="info" size="small" />}
          {item.source === "canvas" && !item.read && <Button size="small" onClick={() => account && updateTodo(account, item.id, { read: true })}>标记已读</Button>}
          {item.source === "canvas" && item.url && <Button size="small" onClick={() => {
            void import("@tauri-apps/plugin-shell").then(({ open }) => open(item.url!));
            if (account) updateTodo(account, item.id, { read: true });
          }}>打开</Button>}
          {item.source === "personal" && <IconButton aria-label="删除待办" onClick={() => account && removePersonalTodo(account, item.id)}>
            <DeleteOutlineRoundedIcon /></IconButton>}
        </Stack>
      </Card>)}
      <Typography variant="caption" color="text.secondary">到期前 24 小时提醒一次；提醒仅在应用运行时检查。最近同步：{snapshot.updatedAt ? dayjs(snapshot.updatedAt).format("YYYY-MM-DD HH:mm") : "尚未同步"}</Typography>
    </Stack>
  </BasicLayout>;
}

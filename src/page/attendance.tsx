import { invoke } from "@tauri-apps/api/core";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ContentPasteRoundedIcon from "@mui/icons-material/ContentPasteRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import MonitorRoundedIcon from "@mui/icons-material/MonitorRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import BasicLayout from "../components/layout";
import { SurfaceCard } from "../components/surface_card";
import { WorkspaceHero } from "../components/workspace_hero";
import { getConfig, saveConfig } from "../lib/config";
import { useTauriEvent } from "../lib/events";
import { useAppMessage } from "../lib/message";
import {
  AttendanceEventKind,
  AttendanceEventPayload,
  AttendancePythonStatus,
  AttendanceSignResult,
  AttendanceWatchStatus,
} from "../lib/model";

const ATTENDANCE_QR_PREFIX =
  "https://mlearning.sjtu.edu.cn/lms/mobile2/forscan/";

const EMPTY_STATUS: AttendanceWatchStatus = {
  running: false,
  intervalMs: 1_000,
  scanCount: 0,
  detectedCount: 0,
  duplicateCount: 0,
  successCount: 0,
  failureCount: 0,
  lastMessage: "正在读取签到守望状态…",
};

const eventMeta: Record<
  AttendanceEventKind,
  { label: string; color: "default" | "primary" | "success" | "warning" | "error" }
> = {
  started: { label: "已启动", color: "primary" },
  stopped: { label: "已停止", color: "default" },
  detected: { label: "已识别", color: "warning" },
  success: { label: "签到成功", color: "success" },
  failed: { label: "签到未成功", color: "error" },
  error: { label: "错误", color: "error" },
  info: { label: "信息", color: "default" },
};

function displayTime(value?: string | null) {
  if (!value) return "—";
  return dayjs(value).format("HH:mm:ss");
}

function createLocalEvent(
  kind: AttendanceEventKind,
  message: string,
  qrContent?: string
): AttendanceEventPayload {
  return {
    kind,
    message,
    qrContent,
    timestamp: new Date().toISOString(),
  };
}

function GuideItem({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters elevation={0}>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
        <Typography variant="subtitle2">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography component="div" variant="body2" color="text.secondary">
          {children}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

export default function AttendancePage() {
  const [messageApi] = useAppMessage();
  const [status, setStatus] = useState<AttendanceWatchStatus>(EMPTY_STATUS);
  const [events, setEvents] = useState<AttendanceEventPayload[]>([]);
  const [intervalMs, setIntervalMs] = useState(1_000);
  const [manualUrl, setManualUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [loginReady, setLoginReady] = useState<boolean | null>(null);
  const [passwordLoginEnabled, setPasswordLoginEnabled] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [riskDelayMs, setRiskDelayMs] = useState(1_000);
  const [pythonCommand, setPythonCommand] = useState("python");
  const [pythonBusy, setPythonBusy] = useState(false);
  const [pythonStatus, setPythonStatus] = useState<AttendancePythonStatus | null>(null);
  const [lastResult, setLastResult] = useState<AttendanceSignResult | null>(null);

  const appendEvent = useCallback((event: AttendanceEventPayload) => {
    setEvents((current) => [event, ...current].slice(0, 100));
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const nextStatus = await invoke<AttendanceWatchStatus>(
        "get_attendance_watch_status"
      );
      setStatus(nextStatus);
      setIntervalMs(nextStatus.intervalMs);
    } catch (error) {
      messageApi.error(`读取签到守望状态失败：${error}`);
    }
  }, [messageApi]);

  const loadLoginConfig = useCallback(async () => {
    try {
      const config = await getConfig(true);
      setPasswordLoginEnabled(config.attendance_password_login_enabled);
      setUsername(config.attendance_username);
      setPassword(config.attendance_password);
      setRiskDelayMs(config.attendance_risk_delay_ms || 1_000);
      setPythonCommand(config.attendance_python_command || "python");
      const passwordReady =
        config.attendance_password_login_enabled &&
        Boolean(config.attendance_username.trim()) &&
        Boolean(config.attendance_password);
      if (passwordReady) {
        setLoginReady(true);
        return true;
      }
      const cookieReady = await invoke<boolean>("check_extra_login_status");
      setLoginReady(cookieReady);
      return cookieReady;
    } catch {
      setLoginReady(false);
      return false;
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadLoginConfig();
  }, [loadLoginConfig, loadStatus]);

  useEffect(() => {
    if (!status.running) return;
    const timer = window.setInterval(() => void loadStatus(), 1_500);
    return () => window.clearInterval(timer);
  }, [loadStatus, status.running]);

  useTauriEvent("attendance://event", (event) => {
    appendEvent(event);
    void loadStatus();
    if (event.kind === "success") {
      messageApi.success(`签到成功：${event.message}`, 5);
    } else if (event.kind === "failed" || event.kind === "error") {
      messageApi.error(event.message, 5);
    }
  });

  const ensureLogin = async () => {
    const ready = await loadLoginConfig();
    if (!ready) {
      messageApi.warning("请完成额外扫码登录，或在本页保存账号密码配置。");
    }
    return ready;
  };

  const handleSaveLoginConfig = async () => {
    if (passwordLoginEnabled && (!username.trim() || !password)) {
      messageApi.warning("启用账号密码登录时，学号和密码都不能为空。");
      return;
    }
    setConfigBusy(true);
    try {
      const config = await getConfig(true);
      config.attendance_password_login_enabled = passwordLoginEnabled;
      config.attendance_username = passwordLoginEnabled ? username.trim() : "";
      config.attendance_password = passwordLoginEnabled ? password : "";
      config.attendance_risk_delay_ms = Math.min(5_000, Math.max(500, riskDelayMs));
      config.attendance_python_command = pythonCommand.trim() || "python";
      await saveConfig(config);
      setUsername(config.attendance_username);
      setPassword(config.attendance_password);
      setRiskDelayMs(config.attendance_risk_delay_ms);
      setPythonCommand(config.attendance_python_command);
      setLoginReady(
        passwordLoginEnabled && Boolean(username.trim()) && Boolean(password)
          ? true
          : await invoke<boolean>("check_extra_login_status")
      );
      messageApi.success("签到登录配置已保存。");
    } catch (error) {
      messageApi.error(`保存登录配置失败：${error}`);
    } finally {
      setConfigBusy(false);
    }
  };

  const handleCheckPython = async () => {
    setPythonBusy(true);
    try {
      const nextStatus = await invoke<AttendancePythonStatus>(
        "check_attendance_python",
        { pythonCommand: pythonCommand.trim() || "python" }
      );
      setPythonStatus(nextStatus);
      if (nextStatus.available) {
        messageApi.success(`Python ${nextStatus.version} 与签到依赖均可用。`);
      } else {
        messageApi.warning(nextStatus.message, 6);
      }
    } catch (error) {
      messageApi.error(`检测 Python 环境失败：${error}`);
    } finally {
      setPythonBusy(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      if (!(await ensureLogin())) return;
      const started = await invoke<boolean>("start_attendance_watch", {
        intervalMs,
      });
      if (!started) {
        messageApi.info("签到守望已经在运行。若需修改频率，请先停止再启动。");
      }
      await loadStatus();
    } catch (error) {
      messageApi.error(`启动失败：${error}`);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await invoke("stop_attendance_watch");
      await loadStatus();
    } catch (error) {
      messageApi.error(`停止失败：${error}`);
    } finally {
      setBusy(false);
    }
  };

  const submitUrl = async (url: string) => {
    const result = await invoke<AttendanceSignResult>("sign_attendance_url", {
      url,
    });
    setLastResult(result);
    setStatus((current) => ({
      ...current,
      successCount: current.successCount + (result.success ? 1 : 0),
      failureCount: current.failureCount + (result.success ? 0 : 1),
      lastMessage: result.message,
      lastQrContent: result.qrUrl,
    }));
    appendEvent(
      createLocalEvent(
        result.success ? "success" : "failed",
        result.message,
        result.qrUrl
      )
    );
    if (result.success) {
      messageApi.success(`签到成功：${result.message}`);
    } else {
      messageApi.error(`签到未成功：${result.message}`);
    }
    return result;
  };

  const handleManualSign = async () => {
    const url = manualUrl.trim();
    if (!url) {
      messageApi.warning("请先粘贴完整的签到二维码链接。");
      return;
    }
    setManualBusy(true);
    try {
      if (!(await ensureLogin())) return;
      await submitUrl(url);
    } catch (error) {
      const text = String(error);
      appendEvent(createLocalEvent("error", text, url));
      messageApi.error(`提交失败：${text}`);
    } finally {
      setManualBusy(false);
    }
  };

  const handleScanOnce = async () => {
    setManualBusy(true);
    try {
      if (!(await ensureLogin())) return;
      const codes = await invoke<string[]>("scan_attendance_once");
      const scannedAt = new Date().toISOString();
      setStatus((current) => ({
        ...current,
        scanCount: current.scanCount + 1,
        lastScanAt: scannedAt,
      }));
      const attendanceCodes = codes.filter((code) =>
        code.startsWith(ATTENDANCE_QR_PREFIX)
      );
      if (!attendanceCodes.length) {
        appendEvent(createLocalEvent("info", "本次扫描未发现课堂签到二维码"));
        messageApi.info(
          codes.length
            ? `识别到 ${codes.length} 个二维码，但都不是支持的课堂签到链接。`
            : "本次扫描未发现二维码。"
        );
        return;
      }
      setManualUrl(attendanceCodes[0]);
      setStatus((current) => ({
        ...current,
        detectedCount: current.detectedCount + attendanceCodes.length,
        lastDetectedAt: scannedAt,
        lastQrContent: attendanceCodes[0],
      }));
      appendEvent(
        createLocalEvent(
          "detected",
          `单次扫描发现 ${attendanceCodes.length} 个签到二维码`,
          attendanceCodes[0]
        )
      );
      for (const code of attendanceCodes) {
        await submitUrl(code);
      }
    } catch (error) {
      const text = String(error);
      appendEvent(createLocalEvent("error", text));
      messageApi.error(`扫描失败：${text}`);
    } finally {
      setManualBusy(false);
    }
  };

  const statusStats = useMemo(
    () => [
      { label: "扫描轮次", value: status.scanCount },
      { label: "有效二维码", value: status.detectedCount },
      { label: "签到成功", value: status.successCount },
      { label: "失败", value: status.failureCount },
      { label: "已去重", value: status.duplicateCount },
    ],
    [status]
  );

  return (
    <BasicLayout>
      <Stack spacing={3}>
        <WorkspaceHero
          chipLabel="ATTENDANCE WATCH"
          chipIcon={<HowToRegRoundedIcon />}
          title="签到守望"
          description="由内置的 Python 模块持续识别屏幕中的课堂签到二维码，通过扫码登录态或账号密码自动建立 jAccount 会话并提交签到。离开本页后监听仍会继续，退出应用时自动停止。"
          aside={
            <Chip
              icon={status.running ? <MonitorRoundedIcon /> : <StopCircleRoundedIcon />}
              color={status.running ? "success" : "default"}
              label={status.running ? "正在守望" : "当前已停止"}
              variant={status.running ? "filled" : "outlined"}
            />
          }
          stats={statusStats}
        />

        {loginReady === false ? (
          <Alert severity="warning">
            当前没有可用登录方式。你可以在下方保存账号密码，或前往
            <Button component={RouterLink} to="/settings" color="inherit" size="small">
              系统设置
            </Button>
            完成“额外扫码登录”。
          </Alert>
        ) : null}

        <Alert severity="info" icon={<SecurityRoundedIcon />}>
          密码模式会把凭据保存在本机应用配置中，并仅发送给交大 jAccount；验证码图片只在本机识别。请勿在共享设备使用，并仅在本人真实参与、课程规则允许的场景启用。
        </Alert>

        <SurfaceCard>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ sm: "center" }}
                spacing={1}
              >
                <Box>
                  <Typography variant="h6">登录与验证码配置</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Python 的 surveil.py 优先复用额外扫码登录态；不可用时，可回退到账号密码、ddddocr 本地识别与延迟提交。
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={passwordLoginEnabled}
                      onChange={(event) => setPasswordLoginEnabled(event.target.checked)}
                    />
                  }
                  label="启用密码登录回退"
                />
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 220px" },
                  gap: 1.5,
                }}
              >
                <TextField
                  size="small"
                  label="jAccount 学号"
                  autoComplete="username"
                  value={username}
                  disabled={!passwordLoginEnabled}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <TextField
                  size="small"
                  type="password"
                  label="jAccount 密码"
                  autoComplete="current-password"
                  value={password}
                  disabled={!passwordLoginEnabled}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <FormControl fullWidth size="small" disabled={!passwordLoginEnabled}>
                  <InputLabel id="risk-delay-label">登录提交延迟</InputLabel>
                  <Select
                    labelId="risk-delay-label"
                    label="登录提交延迟"
                    value={riskDelayMs}
                    onChange={(event) => setRiskDelayMs(Number(event.target.value))}
                  >
                    <MenuItem value={500}>0.5 秒</MenuItem>
                    <MenuItem value={1_000}>1 秒（推荐）</MenuItem>
                    <MenuItem value={2_000}>2 秒</MenuItem>
                    <MenuItem value={3_000}>3 秒</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "flex-start" }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Python 3 解释器"
                  placeholder="python，或 Python 可执行文件的完整路径"
                  value={pythonCommand}
                  disabled={status.running}
                  onChange={(event) => {
                    setPythonCommand(event.target.value);
                    setPythonStatus(null);
                  }}
                  helperText="留空时依次尝试 python、python3 和 Windows py -3。修改后请保存配置。"
                />
                <Button
                  variant="outlined"
                  sx={{ minWidth: 150 }}
                  disabled={pythonBusy || status.running}
                  onClick={() => void handleCheckPython()}
                >
                  检测 Python 环境
                </Button>
              </Stack>

              {pythonStatus ? (
                <Alert severity={pythonStatus.available ? "success" : "warning"}>
                  {pythonStatus.message}
                  {pythonStatus.available ? (
                    <Typography component="div" variant="caption" sx={{ mt: 0.5 }}>
                      解释器：{pythonStatus.interpreter} · Python {pythonStatus.version}
                      <br />模块：{pythonStatus.moduleDir}
                    </Typography>
                  ) : null}
                </Alert>
              ) : null}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <Button
                  variant="contained"
                  disabled={configBusy}
                  onClick={() => void handleSaveLoginConfig()}
                >
                  保存登录配置
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Python OCR 失败或验证码错误时最多重新获取并尝试 3 次；关闭回退并保存会清除已存凭据，应用日志不会记录密码、Cookie 或 Authorization。
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </SurfaceCard>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.05fr) minmax(0, .95fr)" },
            gap: 2,
          }}
        >
          <SurfaceCard>
            <CardContent>
              <Stack spacing={2.25}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <QrCodeScannerRoundedIcon color="primary" />
                  <Box>
                    <Typography variant="h6">自动监听</Typography>
                    <Typography variant="body2" color="text.secondary">
                      捕获所有显示器画面，仅对合法的交大课堂签到链接执行操作。
                    </Typography>
                  </Box>
                </Stack>

                <FormControl fullWidth size="small" disabled={status.running}>
                  <InputLabel id="attendance-interval-label">扫描频率</InputLabel>
                  <Select
                    labelId="attendance-interval-label"
                    label="扫描频率"
                    value={intervalMs}
                    onChange={(event) => setIntervalMs(Number(event.target.value))}
                  >
                    <MenuItem value={500}>每 0.5 秒（高频）</MenuItem>
                    <MenuItem value={1_000}>每 1 秒（推荐）</MenuItem>
                    <MenuItem value={2_000}>每 2 秒（节能）</MenuItem>
                    <MenuItem value={5_000}>每 5 秒（低频）</MenuItem>
                  </Select>
                </FormControl>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<PlayArrowRoundedIcon />}
                    disabled={busy || status.running}
                    onClick={() => void handleStart()}
                  >
                    启动守望
                  </Button>
                  <Button
                    fullWidth
                    color="error"
                    variant="outlined"
                    startIcon={<StopCircleRoundedIcon />}
                    disabled={busy || !status.running}
                    onClick={() => void handleStop()}
                  >
                    停止
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<RefreshRoundedIcon />}
                    disabled={manualBusy || status.running}
                    onClick={() => void handleScanOnce()}
                  >
                    扫描一次
                  </Button>
                </Stack>

                <Divider />
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    当前状态
                  </Typography>
                  <Typography variant="body2">{status.lastMessage}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    启动：{displayTime(status.startedAt)} · 最近扫描：
                    {displayTime(status.lastScanAt)} · 最近发现：
                    {displayTime(status.lastDetectedAt)}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </SurfaceCard>

          <SurfaceCard>
            <CardContent>
              <Stack spacing={2.25}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ContentPasteRoundedIcon color="primary" />
                  <Box>
                    <Typography variant="h6">手动提交与单次扫描</Typography>
                    <Typography variant="body2" color="text.secondary">
                      可粘贴二维码内容，或让应用立即扫描当前所有屏幕并提交。
                    </Typography>
                  </Box>
                </Stack>
                <TextField
                  multiline
                  minRows={4}
                  fullWidth
                  value={manualUrl}
                  onChange={(event) => setManualUrl(event.target.value)}
                  label="课堂签到二维码链接"
                  placeholder={`${ATTENDANCE_QR_PREFIX}?rollCallToken=…&signHistoryId=…`}
                  helperText="链接必须使用 HTTPS、指定 mLearning 域名，并包含 rollCallToken 与 signHistoryId。"
                />
                <Button
                  variant="contained"
                  startIcon={<HowToRegRoundedIcon />}
                  disabled={manualBusy}
                  onClick={() => void handleManualSign()}
                >
                  验证并提交签到
                </Button>
                {lastResult ? (
                  <Alert severity={lastResult.success ? "success" : "error"}>
                    <Typography variant="body2">{lastResult.message}</Typography>
                    <Typography variant="caption">
                      HTTP {lastResult.responseStatus}
                    </Typography>
                    {lastResult.responseBody ? (
                      <Box
                        component="pre"
                        sx={{
                          mt: 1,
                          mb: 0,
                          p: 1,
                          maxHeight: 120,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          fontSize: 11,
                        }}
                      >
                        {lastResult.responseBody}
                      </Box>
                    ) : null}
                  </Alert>
                ) : null}
              </Stack>
            </CardContent>
          </SurfaceCard>
        </Box>

        <SurfaceCard>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ sm: "center" }}
                spacing={1}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <HistoryRoundedIcon color="primary" />
                  <Box>
                    <Typography variant="h6">本页运行记录</Typography>
                    <Typography variant="body2" color="text.secondary">
                      最多保留最近 100 条；记录只存在于当前页面，不写入配置文件。
                    </Typography>
                  </Box>
                </Stack>
                <Button size="small" onClick={() => setEvents([])} disabled={!events.length}>
                  清空记录
                </Button>
              </Stack>

              {events.length ? (
                <Stack divider={<Divider flexItem />}>
                  {events.map((event, index) => {
                    const meta = eventMeta[event.kind] ?? eventMeta.info;
                    return (
                      <Stack key={`${event.timestamp}-${index}`} spacing={0.75} sx={{ py: 1.25 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" color={meta.color} label={meta.label} />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {event.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {displayTime(event.timestamp)}
                          </Typography>
                        </Stack>
                        {event.qrContent ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ wordBreak: "break-all" }}
                          >
                            {event.qrContent}
                          </Typography>
                        ) : null}
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <MonitorRoundedIcon color="disabled" sx={{ fontSize: 42 }} />
                  <Typography variant="body2" color="text.secondary">
                    启动守望、单次扫描或手动提交后，过程会显示在这里。
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </SurfaceCard>

        <SurfaceCard>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <CheckCircleRoundedIcon color="primary" />
                <Box>
                  <Typography variant="h6">完整使用指南与功能细节</Typography>
                  <Typography variant="body2" color="text.secondary">
                    第一次使用建议按顺序阅读前两节。
                  </Typography>
                </Box>
              </Stack>

              <Box>
                <GuideItem title="1. 使用前准备" defaultExpanded>
                  <Stack component="ol" spacing={1} sx={{ my: 0, pl: 2.5 }}>
                    <li>安装 Python 3，并运行 `python -m pip install -r python/attendance/requirements.txt` 安装模块依赖。</li>
                    <li>在上方填写解释器命令或完整路径，点击“检测 Python 环境”，确认解释器和依赖均可用后保存。</li>
                    <li>
                      任选一种登录方式：在设置页完成“额外扫码登录”，或在本页启用密码登录回退并保存学号、密码。扫码登录态会被优先使用。
                    </li>
                    <li>密码模式会自动获取验证码，在本机 OCR 识别，并按设置等待 0.5–3 秒后提交；识别失败会最多重试 3 次。</li>
                    <li>
                      macOS 首次启动监听时，请在系统设置中授予本应用“屏幕与系统录音”权限；授权后可能需要重启应用。
                    </li>
                    <li>Linux 需在可用的 X11/Wayland 桌面会话中运行；远程或无头环境无法捕获屏幕。</li>
                  </Stack>
                </GuideItem>

                <GuideItem title="2. 自动监听模式">
                  <Stack component="ol" spacing={1} sx={{ my: 0, pl: 2.5 }}>
                    <li>选择扫描频率。1 秒适合绝大多数课程；高频模式会占用更多 CPU。</li>
                    <li>点击“启动守望”，再正常打开 Canvas 直播、课件或教师展示的共享屏幕。</li>
                    <li>Rust 启动 `python/attendance/nn.py --watch --json`；截图和二维码解析都由原 Python 模块完成。</li>
                    <li>模块会扫描虚拟桌面，但只处理指定 mLearning 域名和路径的二维码。</li>
                    <li>发现有效二维码后，`nn.py` 调用 `surveil.py`，再通过扫码态 SSO 或密码登录建立 mLearning 会话并提交。</li>
                    <li>切换到其他页面不会停止任务；退出应用、切换账号或点击“停止”才会结束。</li>
                  </Stack>
                </GuideItem>

                <GuideItem title="3. 单次扫描与手动提交">
                  <Stack spacing={1}>
                    <span>
                      “扫描一次”适合不希望长期占用屏幕捕获权限的场景。按钮会立即扫描全部显示器，并自动提交发现的有效签到二维码。
                    </span>
                    <span>
                      如果你已经从截图、聊天或其他设备获得二维码内容，可将完整链接粘贴到输入框。后端仍会验证协议、域名、路径和必要参数，非交大签到地址会被拒绝。
                    </span>
                  </Stack>
                </GuideItem>

                <GuideItem title="4. 去重、重试和统计规则">
                  <Stack spacing={1}>
                    <span>成功提交过的同一链接在 10 分钟内不会重复提交。</span>
                    <span>失败链接会在 30 秒后允许自动重试，以覆盖临时网络错误或登录态刚刚刷新的情况。</span>
                    <span>
                      “有效二维码”统计实际进入提交阶段的次数；“已去重”表示扫描到了相同链接但跳过了提交。统计保存在应用进程内，重启后清零。
                    </span>
                  </Stack>
                </GuideItem>

                <GuideItem title="5. 隐私与安全边界">
                  <Stack spacing={1}>
                    <span>屏幕图像只在本机内存中用于二维码识别，不保存、不上传，也不会发送给 LLM。</span>
                    <span>密码登录为可选回退方式；学号和密码保存在本机应用配置文件中，只用于向交大 jAccount 登录接口提交。共享设备不应启用。</span>
                    <span>验证码图片只在 Python 进程内通过 ddddocr 识别，不上传到第三方 OCR 服务；每次登录最多尝试 3 次。</span>
                    <span>桌面应用通过子进程环境变量传递凭据，不把密码写入 `surveil.py`，也不放入可见的命令行参数。</span>
                    <span>
                      仅接受 HTTPS 的 `mlearning.sjtu.edu.cn/lms/mobile2/forscan/` 链接，并要求同时存在签到令牌与签到历史 ID。
                    </span>
                    <span>
                      本功能不能替代本人到课，也不能保证在签到已结束、账号无权限、网络异常或学校接口调整时成功。是否允许使用自动辅助功能以课程和学校规则为准。
                    </span>
                  </Stack>
                </GuideItem>

                <GuideItem title="6. 常见问题排查">
                  <Stack spacing={1}>
                    <span>
                      <strong>Python 环境不可用：</strong>确认解释器路径正确，并在同一个 Python 环境中安装 `requirements.txt`。Linux/macOS 还需安装系统 zbar 库。
                    </span>
                    <span>
                      <strong>无法捕获屏幕：</strong>检查系统录屏权限；macOS 授权后重启，Linux 确认桌面会话和显示服务可用。
                    </span>
                    <span>
                      <strong>能看到二维码但识别不到：</strong>放大直播窗口、保证二维码完整清晰，或使用系统截图后通过手动方式复制链接。
                    </span>
                    <span>
                      <strong>提示登录态无效：</strong>前往设置页重新完成额外扫码登录，再返回启动守望。
                    </span>
                    <span>
                      <strong>自动登录失败：</strong>确认学号、密码无误；可增加登录提交延迟后再试。连续 3 次失败后任务会报告错误并按失败去重规则等待。
                    </span>
                    <span>
                      <strong>服务器返回失败：</strong>查看手动提交区域的 HTTP 状态和响应；常见原因包括签到尚未开始、已经结束、已经签到或不在允许范围。
                    </span>
                  </Stack>
                </GuideItem>

                <GuideItem title="7. Python 模块结构与独立运行">
                  <Stack spacing={1}>
                    <span>`python/attendance/nn.py` 保留原看门狗入口，负责截图、QR 识别、去重、循环监听和提示音。</span>
                    <span>`python/attendance/surveil.py` 保留 `auto_sign()` 入口，负责验证码 OCR、jAccount 登录和最终签到请求。</span>
                    <span>两个脚本仍可脱离桌面应用运行；具体命令、环境变量和 JSON Lines 协议见该目录内 README。</span>
                    <span>发布安装包时，Tauri 会把整个 `python/attendance/` 目录作为资源原样带入。</span>
                  </Stack>
                </GuideItem>
              </Box>

              <Alert severity="info" icon={<ErrorOutlineRoundedIcon />}>
                功能设计参考了开源项目{" "}
                <MuiLink
                  href="https://github.com/Castilane/surveillance/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Castilane/surveillance
                </MuiLink>
                。本模块直接沿用你提供的 Python 文件结构，并只为配置传递、结构化结果和 Tauri 子进程桥接做了必要封装。
              </Alert>
            </Stack>
          </CardContent>
        </SurfaceCard>
      </Stack>
    </BasicLayout>
  );
}

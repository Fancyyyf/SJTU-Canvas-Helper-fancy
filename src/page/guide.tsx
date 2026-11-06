import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import { invoke } from "@tauri-apps/api/core";
import { Alert, Box, Button, Card, CardContent, Chip, Link, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import BasicLayout from "../components/layout";
import { WorkspaceHero } from "../components/workspace_hero";

function Command({ children }: { children: string }) {
  return <Box component="pre" sx={{ m: 0, p: 2, borderRadius: 2, bgcolor: "action.hover", overflowX: "auto", fontFamily: "monospace", fontSize: 13 }}>{children}</Box>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card><CardContent><Stack spacing={1.5}><Typography variant="h6">{title}</Typography>{children}</Stack></CardContent></Card>;
}

type HealthDomain = { state: "ok" | "fail" | "unknown"; detail: string; at: string; checkedAt: string };
type HealthReport = { domains: Record<string, HealthDomain>; transitions: { domain: string; state: string }[] };
const domainNames: Record<string, string> = { canvas: "Canvas", jaccount: "jAccount", video: "视频", mlearning: "mLearning" };

export default function GuidePage() {
  const [tab, setTab] = useState(0);
  const [healthCourseId, setHealthCourseId] = useState("");
  const [healthBusy, setHealthBusy] = useState(false);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [healthError, setHealthError] = useState("");

  const refreshHealth = async () => {
    const courseId = healthCourseId.trim() ? Number(healthCourseId) : undefined;
    if (courseId !== undefined && (!Number.isSafeInteger(courseId) || courseId <= 0)) return;
    setHealthBusy(true);
    setHealthError("");
    try { setHealth(await invoke<HealthReport>("check_service_health", { courseId })); }
    catch (error) { setHealthError(String(error)); }
    finally { setHealthBusy(false); }
  };
  return <BasicLayout>
    <Stack spacing={2.5} sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <WorkspaceHero chipLabel="指南" chipIcon={<MenuBookRoundedIcon />} title="使用教程"
        description="桌面功能、AI 工具和命令行入口，以及它们共享的数据边界。" />
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="使用教程分类">
        <Tab label="桌面应用" /><Tab label="AI 与 CLI" /><Tab label="技术与开发" />
      </Tabs>
      {tab === 0 && <Stack spacing={2}>
        <Section title="开始使用"><Typography variant="body2">先到系统设置填写 Canvas Token 并测试连接。课程、作业、文件、日历和视频从当前应用账号读取。全局学期筛选决定课程页面展示范围。</Typography>
          <Button component={RouterLink} to="/settings" variant="outlined" sx={{ alignSelf: "flex-start" }}>前往系统设置</Button></Section>
        <Section title="视频与签到"><Typography variant="body2">视频管理支持播放、下载、字幕与课件；字幕工作台可检索和整理课程资料。签到守望只处理有效的交大课堂二维码，使用前请确认自己的登录状态和课堂参与情况。</Typography>
          <Stack direction="row" spacing={1}><Button component={RouterLink} to="/video" size="small">视频管理</Button><Button component={RouterLink} to="/attendance" size="small">签到守望</Button></Stack></Section>
        <Section title="诊断与隐私"><Typography variant="body2">应用内错误日志会保留在本机供查看。导出诊断报告会脱敏；请在分享前自行检查内容。账号切换后应确认页面显示的是目标账号。</Typography></Section>
      </Stack>}
      {tab === 1 && <Stack spacing={2}>
        <Alert severity="info">CLI 连接当前桌面应用的本机 MCP Server。先在“系统设置 → 高级与实验”启用 MCP，并保持应用运行；CLI 默认端口为 3100。</Alert>
        <Section title="命令行快速开始"><Command>{`yarn canvas:cli health\nyarn canvas:cli tools\nyarn canvas:cli call list_courses`}</Command>
          <Typography variant="body2">课程摘要会限定输出条数，并排除签名下载链接：</Typography><Command>{`yarn canvas:cli call course_snapshot '{"course_id":12345,"limit":50}'`}</Command>
          <Typography variant="body2">Windows PowerShell 传 JSON 时，建议通过标准输入避免引号转义：</Typography>
          <Command>{`'{"course_id":12345,"limit":50}' | node script/canvas-cli.mjs call course_snapshot -`}</Command>
          <Typography variant="body2">自定义端口：<code>yarn canvas:cli --port 3200 tools</code>。标准输出为单行 JSON，错误输出为 JSON；CLI 仅开放文档列出的只读工具。</Typography></Section>
        <Section title="AI 接入"><Typography variant="body2">支持 MCP 的客户端可使用系统设置页生成的连接配置。仓库中的 <code>skills/sjtu-canvas-helper/SKILL.md</code> 说明工具边界和项目技术结构，可提供给阅读本项目的 AI。不要把 Token、Cookie 或完整本机配置粘贴到聊天中。</Typography>
          <Button component={RouterLink} to="/settings?section=advanced" size="small" sx={{ alignSelf: "flex-start" }}>查看 MCP 设置</Button></Section>
        <Section title="TUI 决策"><Typography variant="body2">当前先提供可组合的 JSON CLI。已有桌面 UI 和 MCP 工具覆盖交互操作，暂不加入第二套 TUI；若以后出现持续的终端交互需求，再在同一 CLI 上增加可选交互模式。</Typography></Section>
      </Stack>}
      {tab === 2 && <Stack spacing={2}>
        <Section title="连接健康状态">
          <Typography variant="body2">手动检查 Canvas、jAccount、视频和 mLearning。网络异常显示“未知”，不会误判为登录失效。填写课程 ID 才会查询 mLearning；该查询不提交签到。</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField size="small" label="课程 ID（可选）" value={healthCourseId} onChange={(event) => setHealthCourseId(event.target.value)} /><Button variant="outlined" disabled={healthBusy} onClick={refreshHealth}>检查连接</Button></Stack>
          {healthError && <Alert severity="error">{healthError}</Alert>}
          {health && <Stack spacing={1}>{Object.entries(health.domains).map(([name, item]) => <Stack key={name} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}><Chip size="small" label={`${domainNames[name] || name}: ${item.state === "ok" ? "正常" : item.state === "fail" ? "失效" : "未知"}`} color={item.state === "ok" ? "success" : item.state === "fail" ? "error" : "default"} /><Typography variant="body2">{item.detail}</Typography></Stack>)}</Stack>}
        </Section>
        <Section title="代码结构"><Typography variant="body2"><code>src/</code> 是 React 页面与状态；<code>src-tauri/src/app/</code> 编排业务，<code>client/</code> 访问 Canvas 与视频服务，<code>mcp/</code> 暴露本机工具；<code>python/attendance/</code> 执行二维码识别和签到。维护脚本统一放在 <code>script/</code>。</Typography></Section>
        <Section title="凭据与缓存"><Typography variant="body2">账号 Token、Cookie 和 API Key 保存在当前系统用户的凭据库。旧配置在首次读取时迁移；失败时设置页会提示重试，原文件仍可恢复。课程摘要的作业和文件元数据写入加密磁盘缓存，签名下载地址不写入缓存。跨设备恢复后需要重新登录。</Typography></Section>
        <Section title="增量检查"><Command>{`yarn typecheck\nyarn test <filter>\nyarn check:rust:fast\nyarn test:rust:focused app::cache::tests`}</Command>
          <Typography variant="body2">Cargo 会复用 <code>src-tauri/target</code> 的编译产物。定向测试先验证相关模块，最终仍需执行项目要求的 Rust 检查与本地预览构建。不要随意更改 <code>CARGO_TARGET_DIR</code> 或清理 target。</Typography></Section>
        <Section title="项目文档"><Typography variant="body2">详细工具边界见仓库 <code>docs/agent-tools.md</code>；融合决策见 <code>docs/maintenance/SJTU_CANVAS_CLI_FUSION_PLAN_2026-11-03.md</code>。更多开发说明在项目 README。</Typography>
          <Link href="https://github.com/Fancyyyf/SJTU-Canvas-Helper-fancy" target="_blank" rel="noreferrer">查看项目仓库</Link></Section>
      </Stack>}
    </Stack>
  </BasicLayout>;
}

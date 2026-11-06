#!/usr/bin/env node
// A small, read-only CLI client for the desktop application's local MCP server.
const SAFE_TOOLS = new Set([
  "list_courses", "get_me", "get_colors", "course_snapshot",
  "list_course_folders", "list_folder_folders", "list_my_folders",
  "get_folder_by_id",
  "list_discussion_topics", "get_full_discussion", "list_calendar_events",
]);

export function parseArguments(argv, environment = process.env) {
  const args = [...argv];
  const portIndex = args.indexOf("--port");
  const portText = portIndex >= 0 ? args.splice(portIndex, 2)[1] : environment.SJTU_CANVAS_MCP_PORT || "3100";
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("--port 必须是 1–65535 的整数");
  const [command, name, raw] = args;
  if (!command || !["health", "tools", "call"].includes(command)) throw new Error("用法：canvas-cli [--port 3100] health|tools|call <tool> [JSON参数]");
  if (command === "call" && (!name || !SAFE_TOOLS.has(name))) throw new Error("仅允许调用文档列出的只读工具；运行 tools 查看可用名称");
  if (command !== "call" && (name || raw)) throw new Error(`${command} 不接受额外参数`);
  return { port, command, name, raw };
}

export function decodeResponse(body, contentType) {
  if (contentType.includes("text/event-stream")) {
    const data = body.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
    if (!data.length) throw new Error("MCP 服务没有返回数据事件");
    return JSON.parse(data.at(-1));
  }
  return JSON.parse(body);
}

export class McpClient {
  constructor(port, request = fetch) {
    this.url = `http://127.0.0.1:${port}/`;
    this.request = request;
    this.sessionId = "";
    this.nextId = 1;
  }

  async send(method, params) {
    const response = await this.request(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
    this.sessionId ||= response.headers.get("Mcp-Session-Id") || "";
    const payload = decodeResponse(await response.text(), response.headers.get("content-type") || "");
    if (payload.error) throw new Error(payload.error.message || JSON.stringify(payload.error));
    return payload.result;
  }

  async initialize() {
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "sjtu-canvas-helper-cli", version: "1" },
    });
    await this.request(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      signal: AbortSignal.timeout(10_000),
    });
  }
}

export async function run(argv, environment = process.env, request = fetch) {
  const { port, command, name, raw } = parseArguments(argv, environment);
  const client = new McpClient(port, request);
  if (command === "health") {
    const response = await request(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`健康检查 HTTP ${response.status}`);
    return JSON.parse(await response.text());
  }
  await client.initialize();
  if (command === "tools") {
    const result = await client.send("tools/list", {});
    return { tools: (result.tools || []).filter((tool) => SAFE_TOOLS.has(tool.name)).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
  }
  const input = raw === undefined ? "{}" : raw === "-" ? await readStdin() : raw;
  const parameters = JSON.parse(input);
  if (!parameters || Array.isArray(parameters) || typeof parameters !== "object") throw new Error("工具参数必须是 JSON 对象");
  const result = await client.send("tools/call", { name, arguments: parameters });
  if (result.isError) throw new Error(result.content?.map((item) => item.text).filter(Boolean).join("; ") || "工具调用失败");
  const content = result.content || [];
  if (content.length === 1 && content[0].type === "text") {
    try { return JSON.parse(content[0].text); } catch { return { text: content[0].text }; }
  }
  return result;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  run(process.argv.slice(2)).then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }).catch((error) => {
    const hint = error.cause?.code === "ECONNREFUSED" ? "请在应用设置中启用 MCP Server 并保持桌面应用运行" : "请检查工具参数、MCP 端口和桌面应用状态";
    process.stderr.write(`${JSON.stringify({ error: "cli_failed", hint, detail: String(error.message) })}\n`);
    process.exitCode = 1;
  });
}

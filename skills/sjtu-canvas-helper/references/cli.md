# CLI and MCP reference

## Setup

1. Open the desktop app, configure the Canvas Token for the intended account, and enable **MCP Server** under System Settings → Advanced & Experimental.
2. Keep the app running. The MCP endpoint is `http://127.0.0.1:3100/` by default; the port is configurable in Settings.
3. Run from the repository root:

```sh
yarn canvas:cli health
yarn canvas:cli tools
yarn canvas:cli call list_courses
yarn canvas:cli call course_snapshot '{"course_id":12345,"limit":50}'
```

PowerShell can pass JSON through stdin to avoid quoting problems:

```powershell
'{"course_id":12345,"limit":50}' | node script/canvas-cli.mjs call course_snapshot -
```

Use `--port 3200` before the command or `SJTU_CANVAS_MCP_PORT=3200` when the app uses another port. The CLI emits one compact JSON value on stdout; failures emit one JSON error on stderr and exit nonzero. The CLI limits calls to a read-only allowlist; `tools` shows their current input schemas. `course_snapshot` returns bounded metadata, counts, generation time, cache TTLs and partial errors without signed file URLs. The generation time is not the upstream fetch time; cached data may be as old as its TTL. The CLI never reads the desktop configuration file or sends a token as a command argument.

## AI connection

Use the MCP connection JSON displayed in the app settings. The current server is a local HTTP endpoint available to local processes. Keep it disabled when unused; do not expose or tunnel its port to a network. Check returned identity with `get_me` when switching accounts.

The in-app Canvas Agent has a narrower tool set than the general MCP server. See `docs/agent-tools.md`; no agent may assume broad course-user or student-submission access is appropriate just because an MCP tool exists.

## Data shape and freshness

The CLI returns the selected MCP tool's JSON payload. Canvas responses may be partial due to upstream permissions, paging or failures. Course IDs are scoped to the current Canvas account and instance. For attendance, live media and signed URLs, do not treat previous results as current. Diagnostics are local to the app; CLI stderr is intended for automation and does not replace the user's local error-log view.

## Troubleshooting

`health` verifies that the local MCP process answers; it does not validate Canvas authentication. If connection fails, verify the app is open, MCP is enabled and the port matches Settings. If a query fails, use the application's Token test and local diagnostics viewer. Do not paste credentials into a bug report or AI chat.

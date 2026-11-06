---
name: sjtu-canvas-helper
description: Use this repository's desktop app, local MCP tools, or read-only CLI to inspect the current user's SJTU Canvas data, and navigate its implementation when changing the project. Applies to SJTU-Canvas-Helper-fancy, not arbitrary Canvas deployments.
---

# SJTU Canvas Helper

This skill is the project entry point for AI clients and developers. The desktop app owns the active account and credentials. Prefer its existing UI for interactive tasks; use the local MCP server or `script/canvas-cli.mjs` for programmatic **read-only** course queries. Read [CLI and MCP reference](references/cli.md) before connecting a client or writing an automation. Read [architecture reference](references/architecture.md) before changing code.

## Operational boundaries

- Work in the active app account. Do not infer that a saved course ID belongs to another account or Canvas instance.
- Query tools are read-only. Submission, grading, calendar writes, account changes, and attendance submission require an explicit user request and the app's established action path.
- Never send Canvas Token, jAccount Cookie, passwords, signed media URLs, student submissions, or complete config files to a model or diagnostic output. The repository's `docs/agent-tools.md` lists the narrower Canvas Agent tool set.
- Preserve structured diagnostics **and** the user's local error log. Scripts belong only in `script/`.
- For app changes, run relevant checks and build a local preview with `yarn build:preview:local`; report the executable path. Do not make a Release unless requested.

## Choose an interface

| Need | Interface |
| --- | --- |
| Human interaction | Desktop pages, including “使用教程” and “系统设置” |
| AI tool calling | Local MCP Server, enabled in Settings; use the app's generated connection configuration |
| Shell automation | `yarn canvas:cli tools` and `yarn canvas:cli call <read-only-tool> [JSON]` |
| Project maintenance | Source modules and checks in [architecture reference](references/architecture.md) |

The CLI uses the running desktop app's MCP endpoint and does not implement a second credential store. TUI is deferred until there is an actual need for sustained terminal interaction.

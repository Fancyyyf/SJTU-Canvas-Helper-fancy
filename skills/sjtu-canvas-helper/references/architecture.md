# Project architecture and maintenance map

## Layers

- `src/page/`, `src/components/`, `src/lib/`: React pages, navigation, models, state, frontend diagnostics and task orchestration.
- `src-tauri/src/main.rs`: Tauri command registration and lifecycle.
- `src-tauri/src/app/`: account-aware application operations, cache, downloads, attendance process and video material workflows.
- `src-tauri/src/app/credentials.rs`: OS credential store migration, account-scoped references, atomic config replacement and recovery.
- `src-tauri/src/app/cache.rs`, `snapshot.rs`: in-memory TTL plus encrypted persistent safe course metadata. The Canvas Token in the OS credential store supplies the disk encryption key material; never persist full Canvas File or Assignment objects with signed URLs.
- `src-tauri/src/client/`: Canvas API, video authorization, media download and external services.
- `src-tauri/src/mcp/`: local streamable HTTP MCP server. Inspect its actual tool list and access controls before broadening exposure.
- `python/attendance/`: QR recognition, jAccount/MLearning login and sign submission. It is not a generic web fetcher.
- `src-tauri/src/diagnostics.rs`, `local_error_log.rs`, `src/components/log_modal.tsx`: structured redaction and user-visible local error history. Keep both paths working.
- `script/`: all repository scripts, including local preview and CLI. Do not recreate `scripts/`.

## Changes and verification

Use the existing domain model instead of adding a second Go service. Keep the current app account in every cache key and invalidate affected data after writes or account switches. Do not cache signed media URLs, live state, or attendance status. Bound queries and report partial data explicitly.

Fast local feedback: `yarn typecheck`, relevant `yarn test <filter>`, then `yarn check:rust:fast` or `yarn test:rust:focused <filter>`. Cargo reuses `src-tauri/target`; avoid `cargo clean` and changing `CARGO_TARGET_DIR` between runs. A test name filter reduces executed tests, while the first build still compiles the test binary. Run `yarn check:rust` for the required full Rust gate, and after desktop changes run `yarn build:preview:local`. The latter creates a local executable under `local-preview/<timestamp>/` without publishing a Release or bumping versions.

See `docs/maintenance/SJTU_CANVAS_CLI_FUSION_PLAN_2026-11-03.md` for which ideas from the separate Go CLI are adopted, adapted, or deferred.

import { invoke } from "@tauri-apps/api/core";

import {
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_WARN,
  LogLevel,
} from "./model";

export type DiagnosticOutcome =
  | "started"
  | "success"
  | "failed"
  | "fallback"
  | "cancelled";

export interface DiagnosticFallback {
  used: boolean;
  strategy: string;
  result?: "success" | "failed" | "not_attempted";
}

export interface DiagnosticEventInput {
  level: LogLevel;
  code: string;
  scope: string;
  action: string;
  outcome: DiagnosticOutcome;
  recoverable?: boolean;
  fallback?: DiagnosticFallback;
  userMessage?: string;
  context?: Record<string, unknown>;
  error?: unknown;
  traceId?: string;
}

export interface DiagnosticEvent {
  schemaVersion: 1;
  eventId: string;
  timestamp: string;
  level: LogLevel;
  code: string;
  scope: string;
  action: string;
  outcome: DiagnosticOutcome;
  recoverable: boolean;
  fallback?: DiagnosticFallback;
  userMessage?: string;
  context?: unknown;
  error?: unknown;
  traceId?: string;
}

const SECRET_KEY_PATTERN =
  /(^|_|-)(authorization|cookie|password|passwd|secret|token|api.?key|signature|jwt|credential|session|key)($|_|-)/i;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

function createEventId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_KEY_PATTERN.test(key)) {
        url.searchParams.set(key, "<redacted>");
      }
    }
    if (url.username) url.username = "<redacted>";
    if (url.password) url.password = "<redacted>";
    return url.toString();
  } catch {
    return raw;
  }
}

function sanitizeString(value: string): string {
  return value
    .replace(URL_PATTERN, (url) => sanitizeUrl(url))
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1<redacted>")
    .replace(
      /((?:password|passwd|token|api[_-]?key|signature|jwt|cookie|secret)\s*[:=]\s*)[^\s,;&]+/gi,
      "$1<redacted>"
    );
}

export function sanitizeDiagnosticValue(
  value: unknown,
  key = "",
  depth = 0,
  seen = new WeakSet<object>()
): unknown {
  if (SECRET_KEY_PATTERN.test(key)) return "<redacted>";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return `<function:${value.name || "anonymous"}>`;
  if (depth >= 6) return "<max-depth>";

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      ...(import.meta.env.DEV && value.stack
        ? { stack: sanitizeString(value.stack).split("\n").slice(0, 12).join("\n") }
        : {}),
    };
  }
  if (value instanceof URL) return sanitizeUrl(value.toString());
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeDiagnosticValue(item, "", depth + 1, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "<circular>";
    seen.add(value);
    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([childKey, child]) => [
        childKey,
        sanitizeDiagnosticValue(child, childKey, depth + 1, seen),
      ]);
    return Object.fromEntries(entries);
  }
  return sanitizeString(String(value));
}

function shouldPersist(level: LogLevel): boolean {
  return import.meta.env.DEV || level >= LOG_LEVEL_WARN;
}

export function logDiagnostic(input: DiagnosticEventInput): string {
  const eventId = createEventId();
  if (!shouldPersist(input.level)) return eventId;

  const event: DiagnosticEvent = {
    schemaVersion: 1,
    eventId,
    timestamp: new Date().toISOString(),
    level: input.level,
    code: input.code,
    scope: input.scope,
    action: input.action,
    outcome: input.outcome,
    recoverable: input.recoverable ?? false,
    ...(input.traceId ? { traceId: input.traceId } : {}),
    ...(input.fallback ? { fallback: input.fallback } : {}),
    ...(input.userMessage
      ? { userMessage: sanitizeString(input.userMessage) }
      : {}),
    ...(import.meta.env.DEV && input.context
      ? { context: sanitizeDiagnosticValue(input.context) }
      : {}),
    ...(input.error !== undefined
      ? { error: sanitizeDiagnosticValue(input.error) }
      : {}),
  };

  void invoke("frontend_log", { event }).catch((error) => {
    if (import.meta.env.DEV) {
      console.warn("[diagnostics] failed to persist frontend event", {
        eventId,
        error: sanitizeDiagnosticValue(error),
      });
    }
  });

  if (import.meta.env.DEV) {
    const consoleMethod =
      input.level >= LOG_LEVEL_ERROR
        ? console.error
        : input.level >= LOG_LEVEL_WARN
          ? console.warn
          : input.level <= LOG_LEVEL_DEBUG
            ? console.debug
            : console.info;
    consoleMethod("[diagnostics]", event);
  }
  return eventId;
}

export function logHandledError(options: {
  code: string;
  scope: string;
  action: string;
  error: unknown;
  userMessage: string;
  recoverable?: boolean;
  fallback?: DiagnosticFallback;
  context?: Record<string, unknown>;
  traceId?: string;
}): string {
  return logDiagnostic({
    level: options.fallback?.used && options.fallback.result === "success"
      ? LOG_LEVEL_WARN
      : LOG_LEVEL_ERROR,
    code: options.code,
    scope: options.scope,
    action: options.action,
    outcome: options.fallback?.used ? "fallback" : "failed",
    recoverable: options.recoverable ?? Boolean(options.fallback?.used),
    fallback: options.fallback,
    userMessage: options.userMessage,
    context: options.context,
    error: options.error,
    traceId: options.traceId,
  });
}

export function logLegacy(level: LogLevel, messages: unknown[], caller?: string) {
  const [first, ...rest] = messages;
  const firstIsError = first instanceof Error;
  logDiagnostic({
    level,
    code: "LEGACY.UNCLASSIFIED",
    scope: "legacy",
    action: "console_log",
    outcome: level >= LOG_LEVEL_ERROR ? "failed" : "success",
    recoverable: level < LOG_LEVEL_ERROR,
    context: {
      caller,
      messages: firstIsError ? rest : messages,
    },
    error: firstIsError ? first : undefined,
  });
}

let globalHandlersInstalled = false;

export function installGlobalDiagnosticHandlers() {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    logDiagnostic({
      level: LOG_LEVEL_ERROR,
      code: "FRONTEND.UNHANDLED_ERROR",
      scope: "window",
      action: "runtime_error",
      outcome: "failed",
      recoverable: false,
      error: event.error ?? event.message,
      context: {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logDiagnostic({
      level: LOG_LEVEL_ERROR,
      code: "FRONTEND.UNHANDLED_REJECTION",
      scope: "window",
      action: "promise_rejection",
      outcome: "failed",
      recoverable: false,
      error: event.reason,
    });
  });
}

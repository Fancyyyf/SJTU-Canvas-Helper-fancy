import {
  Alert,
  Box,
  Portal,
  Stack,
} from "@mui/material";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { logDiagnostic, type DiagnosticEventInput } from "./logger";
import { LOG_LEVEL_ERROR, LOG_LEVEL_WARN } from "./model";

type MessageType = "success" | "error" | "warning" | "info" | "loading";

interface MessageOptions {
  key?: string;
  type?: MessageType;
  content: ReactNode;
  duration?: number;
  diagnostic?: Partial<Omit<DiagnosticEventInput, "level" | "userMessage">>;
}

interface MessageRecord {
  id: string;
  type: MessageType;
  content: ReactNode;
  duration?: number;
}

export interface AppMessageApi {
  open: (options: MessageOptions) => void;
  destroy: (key?: string) => void;
  success: (content: ReactNode, duration?: number) => void;
  error: (content: ReactNode, duration?: number) => void;
  warning: (content: ReactNode, duration?: number) => void;
  info: (content: ReactNode, duration?: number) => void;
}

const noop = () => {};

const defaultApi: AppMessageApi = {
  open: noop,
  destroy: noop,
  success: noop,
  error: noop,
  warning: noop,
  info: noop,
};

const MessageContext = createContext<AppMessageApi>(defaultApi);

let globalMessageApi: AppMessageApi = defaultApi;

function normalizeType(type?: MessageType) {
  return type === "loading" ? "info" : type ?? "info";
}

function userMessageText(content: ReactNode): string {
  if (typeof content === "string" || typeof content === "number") {
    return String(content);
  }
  return "<non-text user notice>";
}

function logUserNotice(options: MessageOptions) {
  if (options.type !== "error" && options.type !== "warning") return;
  const diagnostic = options.diagnostic;
  logDiagnostic({
    level: options.type === "error" ? LOG_LEVEL_ERROR : LOG_LEVEL_WARN,
    code: diagnostic?.code ?? `UI.${options.type.toUpperCase()}_NOTICE`,
    scope: diagnostic?.scope ?? `route:${window.location.pathname}`,
    action: diagnostic?.action ?? "show_user_notice",
    outcome: diagnostic?.outcome ?? "failed",
    recoverable: diagnostic?.recoverable ?? true,
    fallback: diagnostic?.fallback,
    context: diagnostic?.context,
    error: diagnostic?.error,
    traceId: diagnostic?.traceId,
    userMessage: userMessageText(options.content),
  });
}

export function AppMessageProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<MessageRecord[]>([]);

  useEffect(() => {
    const timers = messages
      .filter((message) => message.duration !== 0)
      .map((message) =>
        window.setTimeout(() => {
          setMessages((prev) => prev.filter((item) => item.id !== message.id));
        }, (message.duration ?? 3) * 1000)
      );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [messages]);

  const api = useMemo<AppMessageApi>(() => {
    const remove = (id?: string) => {
      if (!id) {
        setMessages([]);
        return;
      }
      setMessages((prev) => prev.filter((message) => message.id !== id));
    };

    return {
      open: (options) => {
        const { key, type, content, duration } = options;
        logUserNotice(options);
        const id = key ?? `${Date.now()}-${Math.random()}`;
        setMessages((prev) => {
          const next = prev.filter((message) => message.id !== id);
          return [
            ...next,
            {
              id,
              type: type ?? "info",
              content,
              duration,
            },
          ];
        });
      },
      destroy: remove,
      success: (content, duration) =>
        api.open({ type: "success", content, duration }),
      error: (content, duration) =>
        api.open({ type: "error", content, duration }),
      warning: (content, duration) =>
        api.open({ type: "warning", content, duration }),
      info: (content, duration) =>
        api.open({ type: "info", content, duration }),
    };
  }, []);

  globalMessageApi = api;

  return (
    <MessageContext.Provider value={api}>
      {children}
      <Portal>
        <Box
          sx={{
            position: "fixed",
            top: 16,
            left: "50vw",
            transform: "translateX(-50%)",
            zIndex: 1600,
            width: "min(560px, calc(100vw - 32px))",
            maxWidth: "calc(100vw - 32px)",
            pointerEvents: "none",
          }}
        >
          <Stack spacing={1} sx={{ width: "100%", alignItems: "stretch" }}>
            {messages.map((message) => (
              <Alert
                key={message.id}
                onClose={() => api.destroy(message.id)}
                severity={normalizeType(message.type) as "success" | "error" | "warning" | "info"}
                variant="filled"
                sx={{ width: "100%", pointerEvents: "auto" }}
              >
                {message.content}
              </Alert>
            ))}
          </Stack>
        </Box>
      </Portal>
    </MessageContext.Provider>
  );
}

export function useAppMessage(): [AppMessageApi, null] {
  return [useContext(MessageContext), null];
}

export function appMessage() {
  return globalMessageApi;
}

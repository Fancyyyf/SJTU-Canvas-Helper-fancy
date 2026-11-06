import { invoke } from "@tauri-apps/api/core";
import { AISessionStore, aiMessage, aiPayload } from "./ai_session_store";
import type { CanvasAgentChatMessage } from "./model";
import { isAccountTransitioning } from "./account_transition";
import { readCanvasCalendarSnapshot } from "./canvas_calendar_cache";
import { loadPersonalEvents } from "./personal_calendar";
import { readTodos } from "./todo";

interface AgentState {
  messages: CanvasAgentChatMessage[];
  input: string;
  maxTurns: string;
  maxTokens: string;
  loading: boolean;
  engine: "rig" | "pi";
  rigMessages: CanvasAgentChatMessage[];
  piMessages: CanvasAgentChatMessage[];
  piConversationId: string;
}

function normalize(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export class CanvasAgentSession extends AISessionStore<AgentState> {
  constructor() {
    super(() => ({ messages: [], input: "", maxTurns: "6", maxTokens: "4096", loading: false, engine: "rig", rigMessages: [], piMessages: [], piConversationId: crypto.randomUUID() }));
  }

  selectEngine = (engine: "rig" | "pi") => {
    if (this.state.loading || this.state.engine === engine) return;
    this.update({ engine, messages: engine === "pi" ? this.state.piMessages : this.state.rigMessages });
  };

  newConversation = () => {
    if (this.state.loading) return;
    if (this.state.engine === "pi") {
      this.update({ messages: [], piMessages: [], piConversationId: crypto.randomUUID(), input: "" });
    } else {
      this.update({ messages: [], rigMessages: [], input: "" });
    }
  };

  send = async (content: string) => {
    if (isAccountTransitioning() || this.state.loading || !content.trim()) return;
    const sentAt = new Date();
    const utcOffsetMinutes = -sentAt.getTimezoneOffset();
    const generation = ++this.generation;
    const engine = this.state.engine;
    const piConversationId = this.state.piConversationId;
    const history = [...this.state.messages, aiMessage("user", content.trim())];
    const pending = aiMessage("assistant", "", { pending: true });
    const options = {
      max_turns: normalize(this.state.maxTurns, 6, 1, 12),
      max_tokens: normalize(this.state.maxTokens, 4096, 256, 8192),
    };
    this.update({ messages: [...history, pending], [engine === "pi" ? "piMessages" : "rigMessages"]: [...history, pending], loading: true });
    try {
      const info = await invoke<{ current_account: string }>("read_account_info");
      const account = info.current_account || "local";
      await loadPersonalEvents(account);
      if (generation !== this.generation || isAccountTransitioning()) return;
      const calendarSnapshot = readCanvasCalendarSnapshot(account);
      const response = engine === "pi"
        ? await invoke<string>("pi_agent_chat", {
            messages: aiPayload(history), account, conversationId: piConversationId,
            context: JSON.stringify({ calendar: calendarSnapshot, todos: readTodos(account).items }),
          })
        : await invoke<string>("canvas_agent_chat", {
            messages: aiPayload(history), options, calendarSnapshot, account,
            sentAt: sentAt.toISOString(), utcOffsetMinutes,
          });
      if (generation !== this.generation) return;
      const completed = [...history, { ...pending, content: response, pending: false }];
      this.update({ messages: completed, [engine === "pi" ? "piMessages" : "rigMessages"]: completed });
    } catch (error) {
      if (generation !== this.generation) return;
      const failed = [...history, { ...pending, content: `Agent 调用失败：${error}`, pending: false, error: true }];
      this.update({ messages: failed, [engine === "pi" ? "piMessages" : "rigMessages"]: failed });
    } finally {
      if (generation === this.generation) this.update({ loading: false });
    }
  };
}

export const canvasAgentSession = new CanvasAgentSession();

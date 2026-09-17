import { Component, type ErrorInfo, type ReactNode } from "react";

import { logHandledError } from "../lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
  eventId?: string;
}

export default class DiagnosticErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const eventId = logHandledError({
      code: "FRONTEND.REACT_RENDER_FAILED",
      scope: "react",
      action: "render_application",
      error,
      userMessage: "页面渲染失败，请重新加载应用。",
      recoverable: true,
      fallback: { used: true, strategy: "render_recovery_screen", result: "success" },
      context: { componentStack: info.componentStack },
    });
    this.setState({ eventId });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
          background: "#f5f9f7",
          color: "#1f2a24",
        }}
      >
        <section style={{ maxWidth: 560, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>页面暂时无法显示</h1>
          <p>应用已经记录诊断信息。请重新加载；如果问题持续出现，请附上事件编号反馈。</p>
          {this.state.eventId ? <p>事件编号：{this.state.eventId}</p> : null}
          <button type="button" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </section>
      </main>
    );
  }
}


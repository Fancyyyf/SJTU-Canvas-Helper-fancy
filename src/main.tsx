import ReactDOM from "react-dom/client";
import { Provider } from 'react-redux';
import App from "./App";
import DiagnosticErrorBoundary from "./components/diagnostic_error_boundary";
import { installGlobalDiagnosticHandlers, logDiagnostic } from "./lib/logger";
import { LOG_LEVEL_INFO } from "./lib/model";
import { configStore } from "./lib/store";

installGlobalDiagnosticHandlers();
logDiagnostic({
  level: LOG_LEVEL_INFO,
  code: "APP.FRONTEND_STARTED",
  scope: "application",
  action: "bootstrap",
  outcome: "success",
  recoverable: true,
  context: {
    origin: window.location.origin,
    userAgent: navigator.userAgent,
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <DiagnosticErrorBoundary>
    <Provider store={configStore}>
      <App />
    </Provider>
  </DiagnosticErrorBoundary>
);


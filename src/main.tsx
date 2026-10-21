import ReactDOM from "react-dom/client";
import { Provider } from 'react-redux';
import App from "./App";
import DiagnosticErrorBoundary from "./components/diagnostic_error_boundary";
import { installGlobalDiagnosticHandlers, logDiagnostic } from "./lib/logger";
import { LOG_LEVEL_INFO, LOG_LEVEL_WARN } from "./lib/model";
import { configStore } from "./lib/store";
import { getConfig } from "./lib/config";

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

// Load the persisted palette before mounting the theme provider. Otherwise the
// first frame uses the green fallback until another page happens to read config.
void getConfig()
  .catch((error) => {
    logDiagnostic({
      level: LOG_LEVEL_WARN,
      code: "APP.INITIAL_CONFIG_FAILED",
      scope: "application",
      action: "load_initial_config",
      outcome: "failed",
      recoverable: true,
      context: { error: String(error) },
    });
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <DiagnosticErrorBoundary>
        <Provider store={configStore}>
          <App />
        </Provider>
      </DiagnosticErrorBoundary>
    );
  });


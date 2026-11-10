import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { startRuntimeLogging } from "./lib/logger";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/views.css";
import "./styles/player.css";

startRuntimeLogging();

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 挂载点");

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

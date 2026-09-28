import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./global.css";
import { setupDevMock } from "./lib/devMock";

// Activate mock only if running in browser outside Tauri
setupDevMock();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
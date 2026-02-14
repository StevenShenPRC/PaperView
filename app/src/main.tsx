import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import "./i18n";

import { DialogProvider } from "./context/DialogContext";
import { AppThemeProvider } from "./context/ThemeContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </AppThemeProvider>
  </React.StrictMode>,
);

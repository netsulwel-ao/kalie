import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./i18n";
import "./index.css";
import { useThemeStore } from "@/stores/themeStore";

// Apply saved theme before first render to avoid flash
const savedTheme = useThemeStore.getState().theme;
useThemeStore.getState().setTheme(savedTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ensureOfficeReady } from "./services/storageService";
import "./styles/theme.css";

const container = document.getElementById("container");

async function bootstrap() {
  await ensureOfficeReady();

  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  }
}

bootstrap();

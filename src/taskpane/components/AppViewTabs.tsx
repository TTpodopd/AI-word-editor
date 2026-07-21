import React from "react";
import { AppView } from "../types";

interface AppViewTabsProps {
  view: AppView;
  disabled?: boolean;
  onChange: (view: AppView) => void;
}

export function AppViewTabs({ view, disabled, onChange }: AppViewTabsProps) {
  return (
    <div className="app-view-tabs">
      <button
        type="button"
        className={`app-view-tab${view === "chat" ? " active" : ""}`}
        disabled={disabled}
        onClick={() => onChange("chat")}
      >
        对话
      </button>
      <button
        type="button"
        className={`app-view-tab${view === "writing" ? " active" : ""}`}
        disabled={disabled}
        onClick={() => onChange("writing")}
      >
        写作
      </button>
    </div>
  );
}

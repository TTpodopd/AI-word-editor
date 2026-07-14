import React from "react";

interface SettingsHeaderProps {
  onBack: () => void;
}

export function SettingsHeader({ onBack }: SettingsHeaderProps) {
  return (
    <header className="settings-header">
      <button className="icon-btn" onClick={onBack} title="返回">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M10.5 3.5L5.5 8l5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      <span className="settings-header-title">设置</span>
    </header>
  );
}

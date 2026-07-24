import React from "react";

interface NewChatFabProps {
  disabled?: boolean;
  onClick: () => void;
}

function NewChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.8 4.2c0-1 .8-1.8 1.8-1.8h6.2c1 0 1.8.8 1.8 1.8v3.2c0 1-.8 1.8-1.8 1.8H7.1L3.8 12.6V9.4c-1 0-1.8-.8-1.8-1.8V4.2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M10.8 2.4v3.2M9.2 4h3.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NewChatFab({ disabled, onClick }: NewChatFabProps) {
  return (
    <button
      type="button"
      className="chat-conversation-fab"
      title="新建对话"
      aria-label="新建对话"
      disabled={disabled}
      onClick={onClick}
    >
      <NewChatIcon />
    </button>
  );
}

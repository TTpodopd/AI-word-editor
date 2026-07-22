import React from "react";

interface WelcomeViewProps {
  onCardClick: (cardId: string) => void;
}

function GenerateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 3.5h8.5L15 5v10.5a1 1 0 01-1 1H5a1 1 0 01-1-1V4.5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8.5 3.5V6H13" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path
        d="M7.5 10.5l4.5-2.5M7.5 13.5l4.5-2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M14.5 4.5l1.8 1.8-5.2 5.2-2.1.4.4-2.1 5.1-5.3z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

function AdjustIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3.5l1.1 2.4 2.6.4-1.9 1.8.5 2.6L10 9.4 7.7 10.7l.5-2.6-1.9-1.8 2.6-.4L10 3.5z"
        fill="currentColor"
      />
      <path
        d="M4.5 12.5l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2.7-1.5z"
        fill="currentColor"
        opacity="0.72"
      />
      <path
        d="M15.5 11.5l.6 1.3 1.4.2-1 1 .3 1.4-1.2-.7-1.2.7.3-1.4-1-1 1.4-.2.6-1.3z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  );
}

function ReadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 5.5c2.2-1.2 4.3-1.2 6 0 1.7-1.2 3.8-1.2 6 0v9.5c-2.2-1.2-4.3-1.2-6 0-1.7-1.2-3.8-1.2-6 0V5.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 5.5v9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6.5 8.5h2M6.5 10.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const CARDS = [
  {
    id: "generate",
    icon: GenerateIcon,
    title: "内容生成",
    desc: "让 AI 根据主题生成文档内容",
  },
  {
    id: "adjust",
    icon: AdjustIcon,
    title: "文档调整",
    desc: "一键完成文档内容智能润色",
  },
  {
    id: "read",
    icon: ReadIcon,
    title: "文档阅读",
    desc: "快速理解文档要点",
  },
] as const;

export function WelcomeView({ onCardClick }: WelcomeViewProps) {
  return (
    <div className="welcome-section">
      <div className="greeting">
        <span className="greeting-emoji" aria-hidden="true">
          👋
        </span>
        <h2 className="greeting-title">你好，欢迎使用 AI 助理</h2>
        <p className="greeting-subtitle">高效编辑文档，试试以下操作</p>
      </div>
      <div className="feature-cards">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              className="feature-card"
              onClick={() => onCardClick(card.id)}
            >
              <span className="feature-card-icon-wrap">
                <Icon />
              </span>
              <span className="feature-card-body">
                <span className="feature-card-title">{card.title}</span>
                <span className="feature-card-desc">{card.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

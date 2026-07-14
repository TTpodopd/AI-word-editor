import React from "react";

interface WelcomeViewProps {
  onCardClick: (cardId: string) => void;
}

const CARDS = [
  {
    id: "generate",
    icon: "📝",
    title: "内容生成",
    desc: "让 AI 根据主题生成文档内容",
    colorClass: "purple",
  },
  {
    id: "adjust",
    icon: "✨",
    title: "文档调整",
    desc: "一键完成文档内容智能润色",
    colorClass: "cyan",
  },
  {
    id: "read",
    icon: "📖",
    title: "文档阅读",
    desc: "快速理解文档要点",
    colorClass: "pink",
  },
];

export function WelcomeView({ onCardClick }: WelcomeViewProps) {
  return (
    <div className="welcome-section">
      <div className="greeting">
        <span className="greeting-emoji">👋</span>
        <h2 className="greeting-title">你好，欢迎使用 AI 助理</h2>
        <p className="greeting-subtitle">高效编辑文档，试试以下操作</p>
      </div>
      <div className="feature-cards">
        {CARDS.map((card) => (
          <button
            key={card.id}
            className={`feature-card ${card.colorClass}`}
            onClick={() => onCardClick(card.id)}
          >
            <span className="feature-card-icon">{card.icon}</span>
            <span className="feature-card-title">{card.title}</span>
            <span className="feature-card-desc">{card.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

import React, { useId } from "react";

interface SettingsCollapsibleSectionProps {
  title: string;
  description?: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  headerAction?: React.ReactNode;
  nested?: boolean;
  children: React.ReactNode;
}

export function SettingsCollapsibleSection({
  title,
  description,
  badge,
  expanded,
  onToggle,
  headerAction,
  nested = false,
  children,
}: SettingsCollapsibleSectionProps) {
  const contentId = useId();

  return (
    <section className={`settings-collapse${nested ? " nested" : ""}${expanded ? " expanded" : ""}`}>
      <div className="settings-collapse-header">
        <button
          type="button"
          className="settings-collapse-trigger"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggle}
        >
          <svg
            className={`settings-collapse-chevron${expanded ? " open" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 3.5L9 7L5 10.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="settings-collapse-title-wrap">
            <span className="settings-collapse-title">{title}</span>
            {badge && <span className="settings-collapse-badge">{badge}</span>}
          </span>
        </button>
        {headerAction && (
          <div className="settings-collapse-action" onClick={(event) => event.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>

      {description && <p className="settings-collapse-desc">{description}</p>}

      {expanded && (
        <div id={contentId} className="settings-collapse-body">
          {children}
        </div>
      )}
    </section>
  );
}

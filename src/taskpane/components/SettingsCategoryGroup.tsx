import React from "react";

interface SettingsCategoryGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsCategoryGroup({ title, description, children }: SettingsCategoryGroupProps) {
  return (
    <section className="settings-category">
      <div className="settings-category-header">
        <h4 className="settings-category-title">{title}</h4>
        {description && <p className="settings-category-desc">{description}</p>}
      </div>
      <div className="settings-category-body">{children}</div>
    </section>
  );
}

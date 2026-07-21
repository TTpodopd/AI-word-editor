import React from "react";
import { WritingOutlineSection } from "../types";

interface WritingStepperProps {
  sections: WritingOutlineSection[];
  currentSectionId: string | null;
  disabled?: boolean;
  onSelect: (sectionId: string) => void;
}

export function WritingStepper({ sections, currentSectionId, disabled, onSelect }: WritingStepperProps) {
  return (
    <div className="writing-stepper">
      {sections.map((section, index) => {
        const isActive = section.id === currentSectionId;
        const isDone = !!section.content?.trim();
        const statusClass = isDone ? "done" : isActive ? "active" : "pending";

        return (
          <button
            key={section.id}
            type="button"
            className={`writing-stepper-item ${statusClass}`}
            disabled={disabled}
            onClick={() => onSelect(section.id)}
            title={section.brief}
          >
            <span className="writing-stepper-index">{index + 1}</span>
            <span className="writing-stepper-label">{section.title}</span>
          </button>
        );
      })}
    </div>
  );
}

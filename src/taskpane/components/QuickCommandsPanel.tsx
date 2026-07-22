import React, { useCallback, useMemo, useState } from "react";

import {
  DOCUMENT_TOOL_CATEGORIES,
  DocumentTool,
  DocumentToolCategory,
  countPrimaryToolsForCategory,
  getCompanionTool,
  getPrimaryToolsForCategory,
} from "../constants/documentTools";
import {
  buildDocumentToolOptions,
  runDocumentTool,
} from "../services/documentToolsService";
import {
  DocumentToolFieldValues,
  loadDocumentToolFieldValues,
  saveDocumentToolFieldValues,
} from "../services/documentToolConfigStorage";
import { localizeErrorMessage } from "../utils/localizeErrorMessage";
import { DocumentToolItem } from "./DocumentToolItem";
import { SettingsCollapsibleSection } from "./SettingsCollapsibleSection";

interface QuickCommandsPanelProps {
  hasSelection: boolean;
  disabled?: boolean;
  onNotify: (text: string) => void;
}

const DOC_CATEGORY_ACCENTS: Record<DocumentToolCategory, string> = {
  toc: "accent-blue",
  page: "accent-purple",
  headerFooter: "accent-teal",
  cleanup: "accent-orange",
  format: "accent-green",
};

export function QuickCommandsPanel({ hasSelection, disabled, onNotify }: QuickCommandsPanelProps) {
  const [busyDocToolId, setBusyDocToolId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<DocumentToolFieldValues>(() =>
    loadDocumentToolFieldValues()
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "doc-toc": false,
    "doc-page": false,
    "doc-headerFooter": false,
    "doc-cleanup": false,
    "doc-format": false,
  });

  const docToolsByCategory = useMemo(() => {
    const map = new Map<DocumentToolCategory, DocumentTool[]>();
    for (const category of DOCUMENT_TOOL_CATEGORIES) {
      map.set(category.id, getPrimaryToolsForCategory(category.id));
    }
    return map;
  }, []);

  const updateFieldValue = useCallback((toolId: string, key: string, value: string) => {
    setFieldValues((prev) => {
      const next = {
        ...prev,
        [toolId]: {
          ...prev[toolId],
          [key]: value,
        },
      };
      saveDocumentToolFieldValues(next);
      return next;
    });
  }, []);

  const runDocTool = useCallback(
    async (tool: DocumentTool) => {
      if (disabled || busyDocToolId) return;

      const values = fieldValues[tool.id] || {};
      const applyScope = values.applyScope || "document";
      const requiresSelection =
        tool.scope === "selection" ||
        (tool.fields?.some((field) => field.key === "applyScope") && applyScope === "selection");

      if (requiresSelection && !hasSelection) {
        onNotify("请先在 Word 中选中文本");
        return;
      }

      setBusyDocToolId(tool.id);
      try {
        const options = buildDocumentToolOptions(tool.id, values);
        const result = await runDocumentTool(tool.id, options);
        if (result.success) {
          onNotify(result.message || `${tool.label} 已完成`);
        } else {
          onNotify(result.error || `${tool.label} 失败`);
        }
      } catch (err) {
        onNotify(localizeErrorMessage(err, `${tool.label} 失败，请稍后重试`));
      } finally {
        setBusyDocToolId(null);
      }
    },
    [busyDocToolId, disabled, fieldValues, hasSelection, onNotify]
  );

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <div className="quick-commands-panel">
      {DOCUMENT_TOOL_CATEGORIES.map((category) => {
        const tools = docToolsByCategory.get(category.id) || [];
        if (tools.length === 0) return null;
        const sectionKey = `doc-${category.id}`;

        return (
          <div
            key={category.id}
            className={`quick-commands-doc-section document-tools-section ${DOC_CATEGORY_ACCENTS[category.id]}`}
          >
            <SettingsCollapsibleSection
              title={category.label}
              description={category.hint}
              badge={`${countPrimaryToolsForCategory(category.id)} 项`}
              expanded={expandedSections[sectionKey] ?? false}
              onToggle={() => toggleSection(sectionKey)}
            >
              <div className="document-tools-list">
                {tools.map((tool) => {
                  const companionTool = getCompanionTool(tool);
                  return (
                    <DocumentToolItem
                      key={tool.id}
                      tool={tool}
                      fieldValues={fieldValues[tool.id] || {}}
                      disabled={disabled}
                      loading={busyDocToolId === tool.id}
                      companionTool={companionTool}
                      companionLoading={companionTool ? busyDocToolId === companionTool.id : false}
                      selectionMissing={!hasSelection}
                      onFieldChange={(key, value) => updateFieldValue(tool.id, key, value)}
                      onRun={() => void runDocTool(tool)}
                      onRunCompanion={
                        companionTool ? () => void runDocTool(companionTool) : undefined
                      }
                    />
                  );
                })}
              </div>
            </SettingsCollapsibleSection>
          </div>
        );
      })}
    </div>
  );
}

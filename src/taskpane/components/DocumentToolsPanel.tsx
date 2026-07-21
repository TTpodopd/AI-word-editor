import React, { useCallback, useMemo, useState } from "react";

import {

  DOCUMENT_TOOL_CATEGORIES,

  DOCUMENT_TOOLS,

  DocumentTool,

  DocumentToolCategory,

} from "../constants/documentTools";

import {

  buildDocumentToolOptions,

  runDocumentTool,

} from "../services/documentToolsService";

import { localizeErrorMessage } from "../utils/localizeErrorMessage";

import {

  DocumentToolFieldValues,

  loadDocumentToolFieldValues,

  loadDocumentToolSectionState,

  saveDocumentToolFieldValues,

  saveDocumentToolSectionState,

} from "../services/documentToolConfigStorage";

import { DocumentToolItem } from "./DocumentToolItem";

import { SettingsCollapsibleSection } from "./SettingsCollapsibleSection";



interface DocumentToolsPanelProps {

  hasSelection: boolean;

  disabled?: boolean;

  onNotify: (text: string) => void;

}



const CATEGORY_ACCENTS: Record<DocumentToolCategory, string> = {

  toc: "accent-blue",

  page: "accent-purple",

  headerFooter: "accent-teal",

  cleanup: "accent-orange",

  format: "accent-green",

};



export function DocumentToolsPanel({ hasSelection, disabled, onNotify }: DocumentToolsPanelProps) {

  const [busyId, setBusyId] = useState<string | null>(null);

  const [fieldValues, setFieldValues] = useState<DocumentToolFieldValues>(() =>

    loadDocumentToolFieldValues()

  );

  const [expandedSections, setExpandedSections] = useState(() => loadDocumentToolSectionState());



  const toolsByCategory = useMemo(() => {

    const map = new Map<DocumentToolCategory, DocumentTool[]>();

    for (const category of DOCUMENT_TOOL_CATEGORIES) {

      map.set(

        category.id,

        DOCUMENT_TOOLS.filter((tool) => tool.category === category.id)

      );

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



  const toggleSection = useCallback((categoryId: DocumentToolCategory) => {

    setExpandedSections((prev) => {

      const next = {

        ...prev,

        [categoryId]: !prev[categoryId],

      };

      saveDocumentToolSectionState(next);

      return next;

    });

  }, []);



  const runTool = async (tool: DocumentTool) => {

    const values = fieldValues[tool.id] || {};

    const applyScope = values.applyScope || "document";

    const requiresSelection =

      tool.scope === "selection" ||

      (tool.fields?.some((field) => field.key === "applyScope") && applyScope === "selection");



    if (requiresSelection && !hasSelection) {

      onNotify("请先在 Word 中选中文本");

      return;

    }



    const options = buildDocumentToolOptions(tool.id, values);

    setBusyId(tool.id);

    try {
      const result = await runDocumentTool(tool.id, options);
      setBusyId(null);

      if (result.success) {
        onNotify(result.message || `${tool.label} 已完成`);
      } else {
        onNotify(result.error || `${tool.label} 失败`);
      }
    } catch (err) {
      setBusyId(null);
      onNotify(localizeErrorMessage(err, `${tool.label} 失败，请稍后重试`));
    }
  };



  return (

    <div className="document-tools-panel">

      {DOCUMENT_TOOL_CATEGORIES.map((category) => {

        const tools = toolsByCategory.get(category.id) || [];

        if (tools.length === 0) return null;



        const expanded = !!expandedSections[category.id];



        return (

          <div

            key={category.id}

            className={`document-tools-section ${CATEGORY_ACCENTS[category.id]}`}

          >

            <SettingsCollapsibleSection

              title={category.label}

              description={category.hint}

              badge={`${tools.length} 项`}

              expanded={expanded}

              onToggle={() => toggleSection(category.id)}

            >

              <div className="document-tools-list">

                {tools.map((tool) => (

                  <DocumentToolItem

                    key={tool.id}

                    tool={tool}

                    fieldValues={fieldValues[tool.id] || {}}

                    disabled={disabled}

                    loading={busyId === tool.id}

                    selectionMissing={!hasSelection}

                    onFieldChange={(key, value) => updateFieldValue(tool.id, key, value)}

                    onRun={() => void runTool(tool)}

                  />

                ))}

              </div>

            </SettingsCollapsibleSection>

          </div>

        );

      })}

    </div>

  );

}



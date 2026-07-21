import React from "react";

import { DocumentTool, ToolFieldDefinition } from "../constants/documentTools";



interface DocumentToolItemProps {

  tool: DocumentTool;

  fieldValues: Record<string, string>;

  disabled?: boolean;

  loading?: boolean;

  selectionMissing?: boolean;

  onFieldChange: (key: string, value: string) => void;

  onRun: () => void;

}



function scopeLabel(scope: DocumentTool["scope"]): string {

  if (scope === "selection") return "选区";

  if (scope === "cursor") return "光标处";

  return "全文";

}



function renderField(

  field: ToolFieldDefinition,

  value: string,

  disabled: boolean | undefined,

  onChange: (key: string, value: string) => void

) {

  const fieldClass = `document-tool-field${field.type === "text" ? " document-tool-field--wide" : ""}`;



  if (field.type === "select") {

    return (

      <label key={field.key} className={fieldClass}>

        <span className="document-tool-field-label">{field.label}</span>

        <select

          className="document-tool-field-control"

          value={value}

          disabled={disabled}

          onChange={(event) => onChange(field.key, event.target.value)}

        >

          {(field.options || []).map((option) => (

            <option key={option.value} value={option.value}>

              {option.label}

            </option>

          ))}

        </select>

      </label>

    );

  }



  if (field.type === "number") {

    return (

      <label key={field.key} className={fieldClass}>

        <span className="document-tool-field-label">{field.label}</span>

        <input

          className="document-tool-field-control"

          type="number"

          min={field.min}

          max={field.max}

          value={value}

          disabled={disabled}

          onChange={(event) => onChange(field.key, event.target.value)}

        />

      </label>

    );

  }



  return (

    <label key={field.key} className={fieldClass}>

      <span className="document-tool-field-label">{field.label}</span>

      <input

        className="document-tool-field-control"

        type="text"

        value={value}

        disabled={disabled}

        placeholder={field.placeholder}

        onChange={(event) => onChange(field.key, event.target.value)}

      />

    </label>

  );

}



export function DocumentToolItem({

  tool,

  fieldValues,

  disabled,

  loading,

  selectionMissing,

  onFieldChange,

  onRun,

}: DocumentToolItemProps) {

  const applyScope = fieldValues.applyScope || "document";

  const requiresSelection =

    tool.scope === "selection" || (tool.fields?.some((field) => field.key === "applyScope") && applyScope === "selection");



  const blockedBySelection = requiresSelection && selectionMissing;

  const missingRequiredText =

    (tool.id === "set-header" && !fieldValues.headerText?.trim()) ||

    (tool.id === "set-footer-text" && !fieldValues.footerText?.trim());

  const runDisabled = disabled || loading || blockedBySelection || missingRequiredText;



  return (

    <article className={`document-tool-item${loading ? " loading" : ""}`}>

      <div className="document-tool-item-head">

        <div className="document-tool-item-meta">

          <h4 className="document-tool-item-title">{tool.label}</h4>

          <p className="document-tool-item-desc">{tool.description}</p>

        </div>

        <span className="document-tool-scope">{scopeLabel(tool.scope)}</span>

      </div>



      {tool.fields?.length ? (

        <div className="document-tool-item-fields">

          {tool.fields.map((field) =>

            renderField(field, fieldValues[field.key] ?? field.defaultValue, disabled || loading, onFieldChange)

          )}

        </div>

      ) : null}



      <div className="document-tool-item-actions">

        {blockedBySelection ? <span className="document-tool-item-tip">请先在 Word 中选中文本</span> : null}

        {missingRequiredText && !blockedBySelection ? (

          <span className="document-tool-item-tip">请先填写内容</span>

        ) : null}

        <button

          type="button"

          className="document-tool-run-btn"

          disabled={runDisabled}

          onClick={onRun}

        >

          {loading ? "处理中…" : tool.actionLabel || "执行"}

        </button>

      </div>

    </article>

  );

}



export type DocumentToolScope = "document" | "selection" | "cursor";

export type DocumentToolCategory = "toc" | "page" | "headerFooter" | "cleanup" | "format";

export type ToolFieldType = "text" | "number" | "select";

export interface ToolFieldOption {
  value: string;
  label: string;
}

export interface ToolFieldDefinition {
  key: string;
  label: string;
  type: ToolFieldType;
  defaultValue: string;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: ToolFieldOption[];
}

export interface DocumentTool {
  id: string;
  label: string;
  description: string;
  scope: DocumentToolScope;
  category: DocumentToolCategory;
  fields?: ToolFieldDefinition[];
  actionLabel?: string;
}

/** 附属操作（清除/更新等）挂在主工具按钮旁，不再单独占卡片 */
export const DOCUMENT_TOOL_COMPANIONS: Record<string, string> = {
  "insert-toc": "update-toc",
  "insert-page-number": "clear-page-numbers",
  "set-header": "clear-header",
  "set-footer-text": "clear-footer",
  "indent-first-line": "clear-first-line-indent",
};

const COMPANION_TOOL_IDS = new Set(Object.values(DOCUMENT_TOOL_COMPANIONS));

const OUTLINE_LEVEL_OPTIONS: ToolFieldOption[] = [
  { value: "1", label: "1 级" },
  { value: "2", label: "2 级" },
  { value: "3", label: "3 级" },
  { value: "4", label: "4 级" },
  { value: "5", label: "5 级" },
  { value: "6", label: "6 级" },
  { value: "7", label: "7 级" },
  { value: "8", label: "8 级" },
  { value: "9", label: "9 级" },
];

export const DOCUMENT_TOOL_CATEGORIES: Array<{ id: DocumentToolCategory; label: string; hint: string }> = [
  { id: "toc", label: "目录", hint: "基于段落大纲级别生成目录，与「引用 → 目录」一致" },
  { id: "page", label: "页码", hint: "支持正文起编、前置节无页码与奇偶页不同显示" },
  { id: "headerFooter", label: "页眉页脚", hint: "直接在下方编辑内容后一键写入" },
  { id: "cleanup", label: "清理排版", hint: "处理空行、空白页、空格等多余格式" },
  { id: "format", label: "段落格式", hint: "批量设置段落大纲级别、首行缩进等" },
];

export const DOCUMENT_TOOLS: DocumentTool[] = [
  {
    id: "insert-toc",
    label: "插入目录",
    description: "在光标处插入自动目录，识别段落大纲级别（需先用「设置大纲级别」标记标题）",
    scope: "cursor",
    category: "toc",
    actionLabel: "插入",
    fields: [
      {
        key: "tocUpperLevel",
        label: "起始级别",
        type: "select",
        defaultValue: "1",
        options: OUTLINE_LEVEL_OPTIONS,
      },
      {
        key: "tocLowerLevel",
        label: "结束级别",
        type: "select",
        defaultValue: "3",
        options: OUTLINE_LEVEL_OPTIONS,
      },
    ],
  },
  {
    id: "update-toc",
    label: "更新目录",
    description: "刷新文档中已有目录的页码与条目",
    scope: "document",
    category: "toc",
    actionLabel: "更新",
  },
  {
    id: "insert-page-number",
    label: "插入页码",
    description: "光标置于正文第一页开头，自动下一页分节、断开页脚链接，正文从起始页码起编",
    scope: "cursor",
    category: "page",
    actionLabel: "插入",
    fields: [
      {
        key: "pageNumberScope",
        label: "应用范围",
        type: "select",
        defaultValue: "bodyFromCursor",
        options: [
          { value: "bodyFromCursor", label: "正文起编（下一页分节）" },
          { value: "all", label: "全文统一" },
        ],
      },
      {
        key: "pageNumberLayout",
        label: "页码布局",
        type: "select",
        defaultValue: "uniform",
        options: [
          { value: "uniform", label: "统一位置" },
          { value: "oddEven", label: "奇偶页不同（奇右偶左）" },
        ],
      },
      {
        key: "pageNumberFormat",
        label: "格式",
        type: "select",
        defaultValue: "simple",
        options: [
          { value: "simple", label: "纯数字" },
          { value: "full", label: "第 X 页 / 共 Y 页" },
        ],
      },
      {
        key: "pageNumberAlign",
        label: "对齐",
        type: "select",
        defaultValue: "center",
        options: [
          { value: "center", label: "居中" },
          { value: "right", label: "右对齐" },
          { value: "left", label: "左对齐" },
        ],
      },
      {
        key: "pageNumberStart",
        label: "起始页码",
        type: "number",
        defaultValue: "1",
        min: 1,
        max: 999,
      },
    ],
  },
  {
    id: "clear-page-numbers",
    label: "清除页码",
    description: "清除所有节页脚中的页码（含奇偶页、首页页脚）",
    scope: "document",
    category: "page",
    actionLabel: "清除",
  },
  {
    id: "set-header",
    label: "设置页眉",
    description: "将页眉文字写入所有节，可设置对齐",
    scope: "document",
    category: "headerFooter",
    actionLabel: "写入页眉",
    fields: [
      {
        key: "headerText",
        label: "页眉内容",
        type: "text",
        defaultValue: "",
        placeholder: "例如：XX 单位工作汇报",
      },
      {
        key: "headerAlign",
        label: "对齐",
        type: "select",
        defaultValue: "center",
        options: [
          { value: "left", label: "左对齐" },
          { value: "center", label: "居中" },
          { value: "right", label: "右对齐" },
        ],
      },
    ],
  },
  {
    id: "set-footer-text",
    label: "设置页脚文字",
    description: "写入纯文本页脚（不含页码域）",
    scope: "document",
    category: "headerFooter",
    actionLabel: "写入页脚",
    fields: [
      {
        key: "footerText",
        label: "页脚内容",
        type: "text",
        defaultValue: "",
        placeholder: "例如：内部资料 · 请勿外传",
      },
      {
        key: "footerAlign",
        label: "对齐",
        type: "select",
        defaultValue: "center",
        options: [
          { value: "left", label: "左对齐" },
          { value: "center", label: "居中" },
          { value: "right", label: "右对齐" },
        ],
      },
    ],
  },
  {
    id: "clear-header",
    label: "清除页眉",
    description: "清除所有节的主页眉内容",
    scope: "document",
    category: "headerFooter",
    actionLabel: "清除",
  },
  {
    id: "clear-footer",
    label: "清除页脚",
    description: "清除所有节的主页脚内容",
    scope: "document",
    category: "headerFooter",
    actionLabel: "清除",
  },
  {
    id: "remove-empty-lines",
    label: "去除空行",
    description: "删除空白段落，保留至少一段正文",
    scope: "document",
    category: "cleanup",
    actionLabel: "执行",
    fields: [
      {
        key: "applyScope",
        label: "范围",
        type: "select",
        defaultValue: "document",
        options: [
          { value: "document", label: "全文" },
          { value: "selection", label: "选区" },
        ],
      },
    ],
  },
  {
    id: "remove-blank-pages",
    label: "去除空白页",
    description: "删除分节/分页后的空段落、连续空段及段前超大间距，清理空白页",
    scope: "document",
    category: "cleanup",
    actionLabel: "执行",
    fields: [
      {
        key: "applyScope",
        label: "范围",
        type: "select",
        defaultValue: "document",
        options: [
          { value: "document", label: "全文" },
          { value: "selection", label: "选区" },
        ],
      },
    ],
  },
  {
    id: "trim-extra-spaces",
    label: "删除多余空格",
    description: "合并连续空格并修剪段首段尾空格",
    scope: "document",
    category: "cleanup",
    actionLabel: "执行",
    fields: [
      {
        key: "applyScope",
        label: "范围",
        type: "select",
        defaultValue: "document",
        options: [
          { value: "document", label: "全文" },
          { value: "selection", label: "选区" },
        ],
      },
    ],
  },
  {
    id: "set-heading-level",
    label: "设置大纲级别",
    description: "设置段落属性中的大纲级别（不影响字体样式），便于导航窗格与目录生成",
    scope: "selection",
    category: "format",
    actionLabel: "应用",
    fields: [
      {
        key: "outlineLevel",
        label: "大纲级别",
        type: "select",
        defaultValue: "1",
        options: [
          { value: "bodyText", label: "正文文本" },
          { value: "1", label: "1 级" },
          { value: "2", label: "2 级" },
          { value: "3", label: "3 级" },
          { value: "4", label: "4 级" },
          { value: "5", label: "5 级" },
          { value: "6", label: "6 级" },
          { value: "7", label: "7 级" },
          { value: "8", label: "8 级" },
          { value: "9", label: "9 级" },
        ],
      },
    ],
  },
  {
    id: "indent-first-line",
    label: "首行缩进",
    description: "为正文段落设置首行缩进字符数",
    scope: "document",
    category: "format",
    actionLabel: "应用",
    fields: [
      {
        key: "indentChars",
        label: "缩进字符",
        type: "number",
        defaultValue: "2",
        min: 1,
        max: 8,
      },
    ],
  },
  {
    id: "clear-first-line-indent",
    label: "清除首行缩进",
    description: "清除正文段落的首行缩进",
    scope: "document",
    category: "format",
    actionLabel: "清除",
  },
  {
    id: "uniform-line-spacing",
    label: "统一行距",
    description: "批量设置段落行距，支持倍距与固定磅值",
    scope: "document",
    category: "format",
    actionLabel: "应用",
    fields: [
      {
        key: "lineSpacingPreset",
        label: "行距",
        type: "select",
        defaultValue: "1.5",
        options: [
          { value: "single", label: "单倍行距" },
          { value: "1.5", label: "1.5 倍行距" },
          { value: "2", label: "2 倍行距" },
          { value: "fixed20", label: "固定 20 磅" },
          { value: "fixed22", label: "固定 22 磅" },
          { value: "fixed24", label: "固定 24 磅" },
        ],
      },
      {
        key: "applyScope",
        label: "范围",
        type: "select",
        defaultValue: "document",
        options: [
          { value: "document", label: "全文" },
          { value: "selection", label: "选区" },
        ],
      },
    ],
  },
];

export function getDocumentToolById(id: string): DocumentTool | undefined {
  return DOCUMENT_TOOLS.find((tool) => tool.id === id);
}

export function getCompanionTool(primaryTool: DocumentTool): DocumentTool | undefined {
  const companionId = DOCUMENT_TOOL_COMPANIONS[primaryTool.id];
  return companionId ? getDocumentToolById(companionId) : undefined;
}

export function isCompanionOnlyTool(tool: DocumentTool): boolean {
  return COMPANION_TOOL_IDS.has(tool.id);
}

export function getPrimaryToolsForCategory(category: DocumentToolCategory): DocumentTool[] {
  return DOCUMENT_TOOLS.filter((tool) => tool.category === category && !isCompanionOnlyTool(tool));
}

export function countPrimaryToolsForCategory(category: DocumentToolCategory): number {
  return getPrimaryToolsForCategory(category).length;
}

export function buildDefaultToolFieldValues(): Record<string, Record<string, string>> {
  const values: Record<string, Record<string, string>> = {};
  for (const tool of DOCUMENT_TOOLS) {
    if (!tool.fields?.length) continue;
    values[tool.id] = {};
    for (const field of tool.fields) {
      values[tool.id][field.key] = field.defaultValue;
    }
  }
  return values;
}

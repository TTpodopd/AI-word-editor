import { AppSettings, getSystemPrompt } from "../types";
import { FormScanResult } from "../services/formFillService";

export const FORM_FILL_SLASH_COMMAND = "/填表";

export function isFormFillCommand(content: string): boolean {
  return content.trim().startsWith(FORM_FILL_SLASH_COMMAND);
}

export function extractFormFillInstruction(content: string): string {
  return content.trim().replace(/^\/填表\s*/, "").trim();
}

export function buildFormFillSystemPrompt(settings: AppSettings): string {
  const basePrompt = getSystemPrompt(settings, false);
  return `${basePrompt}

【当前任务】你是申报材料智能填表助手。用户已在 Word 文档中选中了一段表单区域，请仅针对该选中区域内出现的字段生成填写内容。

输出规则（必须严格遵守）：
1. 只输出一个 JSON 对象，不要输出 markdown 代码块、解释或其他文字
2. JSON 结构：
{
  "fields": { "字段名": "填写内容" },
  "checkboxes": { "技术水平": "选项名" },
  "optionChecks": ["方框选项1", "方框选项2"],
  "personnel": [{ "姓名": "", "单位": "", "职务/职称": "", "学历": "", "专业方向": "", "联系电话": "" }]
}
3. 只为「待填字段列表」中出现的字段生成内容，不要生成列表以外的字段
4. 若选中区域包含 □ 方框选项列表，使用 optionChecks 数组返回需要勾选的选项名称，可多选
5. optionChecks 中的名称必须与「方框可选项列表」完全一致，仅勾选与用户资料明确相关的项，不要全选
6. 若选中区域不包含某类字段（如研发人员表格），对应数组返回 []，不要生成无关内容
7. checkboxes.技术水平 只能选一个：国际领先、国际先进、国内领先、国内先进、填补国内空白、填补省内空白
8. personnel 按实际研发人员填写，最多 10 人；选中区域无人员表格时返回 []
9. 若选中区域是「主要研发人员」表格，必须返回 personnel 数组，每人一条，键名用：姓名、单位、职务/职称、学历、专业方向、联系电话
10. 内容应专业准确，符合科技奖项申报风格
11. 资料不足时可合理推断，确实无法确定的填「待补充」`;
}

export function buildFormFillUserPrompt(scan: FormScanResult, userInstruction: string): string {
  const fieldList = scan.fieldLabels.length
    ? scan.fieldLabels.map((label) => `- ${label}`).join("\n")
    : "- 技术名称\n- 申报人\n- 联系人\n- 联系电话\n- 联系邮箱";

  const extras: string[] = [];
  if (scan.hasCheckboxGroups) extras.push("- 技术水平（checkboxes，单选）");
  if (scan.hasOptionChecks && scan.checkboxOptions.length > 0) {
    extras.push(
      `- 方框勾选项（optionChecks 数组，可多选）：\n${scan.checkboxOptions
        .map((option) => `  · ${option}`)
        .join("\n")}`
    );
  }
  if (scan.hasPersonnelTable) extras.push("- 主要研发人员表格（personnel 数组）");

  const instructionBlock = userInstruction
    ? `用户提供的项目资料：\n${userInstruction}`
    : "用户未提供具体资料，请根据文档内容生成合理的示例填写内容。";

  return `请为 Word 文档中【用户选中的表单区域】生成填写内容。仅处理选中区域内的字段，不要生成选中区域以外的内容。

待填字段列表（仅生成以下字段）：
${fieldList}
${extras.length ? `\n特殊字段：\n${extras.join("\n")}` : ""}

选中区域内容：
${scan.selectionPreview.slice(0, 2000)}

${instructionBlock}`;
}

export function buildFormFillMessages(
  settings: AppSettings,
  scan: FormScanResult,
  userInstruction: string
): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: buildFormFillSystemPrompt(settings) },
    { role: "user", content: buildFormFillUserPrompt(scan, userInstruction) },
  ];
}

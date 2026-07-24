import { WritingTemplate } from "../../types";

/** 依据《党政机关公文处理工作条例》与 GB/T 9704-2012 的通用写作规则 */
export const OFFICIAL_DOCUMENT_BASE_PROMPT = `你是一位熟悉《党政机关公文处理工作条例》和 GB/T 9704-2012《党政机关公文格式》的公文写作助手。语言规范、庄重、准确，符合机关行文习惯。

【通用规则】
- 标题一般采用"发文机关＋关于＋事由＋文种"
- 发文字号使用占位符"＋机关代字〔年份〕序号＋"，不得自行编造真实文号
- 主送机关：下行文、上行文和平行文通常标注；决议、公告、通告及部分纪要不标注
- 正文层级依次使用"一、""（一）""1.""（1）"，同一层级格式保持一致
- 附件在正文后标注"附件：1.＋附件名称＋"，附件名称末不加标点
- 落款署发文机关全称和成文日期，日期用阿拉伯数字写全年月日
- 不得把"报告"写成"请示"，不得套用不存在的政策依据、文号、会议结论或审批意见`;

export const OFFICIAL_DOCUMENT_SECTION_RULES = `直接输出正文，不要 Markdown 标记；不要重复章节标题；段落之间仅用单个换行分隔，不要空行；不要使用 *、_、#、- 等符号；不要输出 emoji 或特殊符号；涉及文号、日期、机关名称处保留"＋占位符＋"格式，便于用户替换；不得编造政策文件名称或审批结论。`;

export const OFFICIAL_WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: "gov-resolution",
    name: "决议",
    description: "会议讨论通过的重大决策事项",
    category: "decision",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题与通过说明", brief: "标题下标注（＋会议名称＋通过），一般不写主送机关" },
      { level: 1, title: "开篇判断", brief: "说明会议审议对象、形势背景和总体判断" },
      { level: 1, title: "会议认为", brief: "阐述基本评价或重大意义" },
      {
        level: 1,
        title: "会议决定",
        brief: "分条列示：总体目标与基本原则、重大事项部署、组织实施和贯彻要求",
      },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：决议】
适用于会议讨论通过的重大决策事项，通常由党的会议、人民代表大会等法定会议主体作出。
正文重在说明会议判断、原则立场、重大部署和贯彻要求；语气权威、表述严谨。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 150-400 字；"会议决定"部分宜分条表述，层次清晰。`,
  },
  {
    id: "gov-decision",
    name: "决定",
    description: "对重要事项作出决策和部署、奖惩或撤销下级不适当决定",
    category: "decision",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题与发文字号", brief: "＋发文机关＋关于＋事由＋的决定；＋机关代字〔年份〕序号＋" },
      {
        level: 1,
        title: "导语",
        brief: "为＋目的＋，根据＋法律法规/政策依据＋，结合＋实际情况＋，经＋会议或审批程序＋研究，作出如下决定",
      },
      { level: 1, title: "一、决定事项及适用范围", brief: "明确决定的核心内容和适用对象、范围" },
      { level: 1, title: "二、主要任务、责任主体和完成时限", brief: "列出具体任务、责任单位和时间节点" },
      { level: 1, title: "三、监督检查、责任追究或衔接安排", brief: "说明监督机制、问责措施或与原有规定的衔接" },
      { level: 1, title: "施行说明与落款", brief: "本决定自＋日期＋起施行；＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：决定】
适用于对重要事项作出决策和部署、奖惩有关单位和人员，或变更、撤销下级机关不适当的决定事项。
先写事实和依据，再写明确结论；部署性决定应写明目标、任务和实施要求。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 200-500 字；奖惩决定应写清对象、事实和决定内容。`,
  },
  {
    id: "gov-announcement",
    name: "公告",
    description: "向国内外宣布重要事项或法定事项",
    category: "notice",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题与公告号", brief: "＋发文机关＋公告；＋年份＋年第＋序号＋号；不写主送机关" },
      {
        level: 1,
        title: "正文",
        brief: "根据＋法律法规或法定权限＋，现将＋公布事项＋予以公告，自＋日期＋起施行/执行；＋原规定废止或过渡安排＋",
      },
      { level: 1, title: "附件说明", brief: "附件：＋附件名称＋（名称末不加标点）" },
      { level: 1, title: "特此公告与落款", brief: "特此公告；＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：公告】
适用于向国内外宣布重要事项或者法定事项，发布主体、事项和程序通常具有法定性、权威性。
正文宜直接写依据、公布事项、生效时间和附件；语言简洁权威。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 100-300 字；正文直述，避免过多层次嵌套。`,
  },
  {
    id: "gov-circular",
    name: "通告",
    description: "一定范围内公布应当遵守或周知的事项",
    category: "notice",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题", brief: "＋发文机关＋关于＋事项＋的通告；不写主送机关" },
      { level: 1, title: "导语", brief: "为＋目的＋，根据＋法律法规/政策依据＋，现将有关事项通告如下" },
      { level: 1, title: "一、适用范围", brief: "明确地域、对象或业务范围" },
      { level: 1, title: "二、实施时间", brief: "自＋日期时间＋起至＋日期时间＋止" },
      {
        level: 1,
        title: "三、具体要求",
        brief: "（一）应当遵守的事项；（二）禁止或限制事项",
      },
      { level: 1, title: "四、法律责任", brief: "对违反本通告的行为，由＋执法主体＋依据＋法律依据＋处理" },
      { level: 1, title: "五、咨询方式", brief: "＋受理单位、电话或地址＋" },
      { level: 1, title: "特此通告与落款", brief: "特此通告；＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：通告】
适用于在一定区域或特定行业范围内公布应当遵守或者周知的事项。
必须写清适用范围、起止时间、行为要求、禁止事项、法律后果和咨询渠道；避免使用超越职权的强制性表述。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 80-250 字；要求具体明确，便于执行。`,
  },
  {
    id: "gov-opinion",
    name: "意见",
    description: "对重要问题提出见解和处理办法",
    category: "request",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题、字号与主送", brief: "＋发文机关＋关于＋事项＋的意见；＋机关代字〔年份〕序号＋；＋主送机关＋" },
      { level: 1, title: "导语", brief: "为＋目的＋，根据＋依据＋，结合＋实际＋，现提出如下意见" },
      {
        level: 1,
        title: "一、总体要求",
        brief: "（一）指导思想；（二）基本原则；（三）主要目标（到＋时间＋，实现＋可检验目标＋）",
      },
      {
        level: 1,
        title: "二、重点任务",
        brief: "分条列示主要任务，每项写明措施、责任主体和时限",
      },
      { level: 1, title: "三、组织保障", brief: "组织领导、协同机制、资金保障、监督评估等" },
      { level: 1, title: "落款", brief: "＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：意见】
适用于对重要问题提出见解和处理办法，可用于上行、下行或平行行文。
政策性意见通常采用"总体要求—重点任务—保障措施"结构；每项任务尽量明确责任主体和实施路径。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 250-600 字；任务表述应可检验、可落实。`,
  },
  {
    id: "gov-notice",
    name: "通知（部署事项）",
    description: "发布传达要求下级执行和周知的事项",
    category: "notice",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题、字号与主送", brief: "＋发文机关＋关于＋事项＋的通知；＋机关代字〔年份〕序号＋；＋主送机关＋" },
      { level: 1, title: "导语", brief: "为＋目的＋，根据＋依据＋，现将有关事项通知如下" },
      { level: 1, title: "一、工作任务一", brief: "＋具体要求、责任主体和时限＋" },
      { level: 1, title: "二、工作任务二", brief: "＋具体要求、责任主体和时限＋" },
      { level: 1, title: "三、工作要求", brief: "组织实施、材料报送、联系人及联系方式" },
      { level: 1, title: "落款", brief: "＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：通知（部署/事项性）】
适用于发布、传达要求下级机关执行和有关单位周知或执行的事项。
根据用途区分部署性、事项性通知；每项任务应明确责任主体、完成时限和工作标准。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 150-400 字；任务表述具体，避免空泛部署。`,
  },
  {
    id: "gov-notice-forward",
    name: "通知（印发转发）",
    description: "批转、转发公文或印发规范性文件",
    category: "notice",
    builtin: true,
    outlineSkeleton: [
      {
        level: 1,
        title: "标题与主送",
        brief: "＋发文机关＋关于印发/转发《＋文件名称＋》的通知；＋主送机关＋",
      },
      {
        level: 1,
        title: "正文",
        brief: "《＋文件名称＋》已经＋审议或批准程序＋同意，现印发/转发给你们，请结合实际认真贯彻执行",
      },
      { level: 1, title: "落款", brief: "＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：通知（印发/转发性）】
适用于批转、转发公文或印发规范性文件。
印发性通知正文通常较短，不应机械扩写；准确引述文件名称和批准程序即可。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n正文宜简洁，一般 100-200 字；不重复附件全文内容。`,
  },
  {
    id: "gov-report",
    name: "报告",
    description: "向上级机关汇报工作、反映情况",
    category: "request",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题、字号与主送", brief: "＋发文机关＋关于＋事项＋的报告；＋机关代字〔年份〕序号＋；＋上级机关＋" },
      { level: 1, title: "导语", brief: "根据＋部署要求/工作安排＋，现将＋事项＋有关情况报告如下" },
      { level: 1, title: "一、总体情况", brief: "工作背景、进展及关键数据" },
      {
        level: 1,
        title: "二、主要做法和成效",
        brief: "（一）做法及成效一；（二）做法及成效二",
      },
      { level: 1, title: "三、存在的问题及原因", brief: "客观列明问题、影响和原因" },
      { level: 1, title: "四、下一步工作安排", brief: "措施、责任和时间计划" },
      { level: 1, title: "特此报告与落款", brief: "特此报告；＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：报告】
适用于向上级机关汇报工作、反映情况，回复上级机关询问。
突出事实、数据和问题分析；不得夹带要求上级批准的事项（报告与请示严格区分）。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 250-500 字；进展部分尽量量化；不得出现"请批准""恳请同意"等请示用语。`,
  },
  {
    id: "gov-request",
    name: "请示",
    description: "向上级机关请求指示、批准（一文一事）",
    category: "request",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题、字号与主送", brief: "＋发文机关＋关于＋事项＋的请示；＋机关代字〔年份〕序号＋；＋上级机关＋（原则上只主送一个）" },
      {
        level: 1,
        title: "背景与方案说明",
        brief: "＋事项背景、现状及必须请示的原因＋；根据＋政策或法律依据＋，经研究，拟＋倾向性方案＋",
      },
      { level: 1, title: "一、请示事项", brief: "恳请同意/批准＋唯一、明确、可直接答复的事项＋（严格一文一事）" },
      {
        level: 1,
        title: "二、有关说明",
        brief: "实施方案、资金来源、风险控制、已履行程序和相关单位意见",
      },
      { level: 1, title: "妥否请批示与落款", brief: "妥否，请批示；＋发文机关＋；＋年月日＋" },
      { level: 1, title: "联系人信息", brief: "联系人：＋姓名＋；联系电话：＋号码＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：请示】
适用于向上级机关请求指示、批准，必须事前行文。
严格一文一事；只提出一个核心请示事项；先写必要性和依据，再写本单位倾向性方案、风险和资金来源，最后明确请求。不得仅转报下级原文。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 200-450 字；请示事项必须唯一、明确；不得在一个请示中提出多个需批复的事项。`,
  },
  {
    id: "gov-reply",
    name: "批复",
    description: "答复下级机关请示事项",
    category: "request",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题、字号与主送", brief: "＋发文机关＋关于＋事项＋的批复；＋机关代字〔年份〕序号＋；＋请示机关＋" },
      {
        level: 1,
        title: "引述来文",
        brief: "你单位《关于＋请示事项＋的请示》（＋文号＋）收悉。现批复如下",
      },
      { level: 1, title: "一、批复意见", brief: "＋同意/原则同意/不同意＋＋请示的核心事项＋" },
      { level: 1, title: "二、实施条件与工作要求", brief: "实施条件、工作要求或不得突破的边界" },
      { level: 1, title: "三、责任主体与再请示要求", brief: "责任主体、监督评估和重大事项再请示要求" },
      { level: 1, title: "落款", brief: "＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：批复】
适用于答复下级机关的请示事项，必须针对来文作出明确答复。
开头完整引述请示标题和文号；先写"同意/不同意/原则同意"，再列条件、要求和监督安排；不得答非所问。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 150-350 字；批复意见须明确、可直接执行；保留来文文号占位符。`,
  },
  {
    id: "gov-letter",
    name: "函",
    description: "不相隶属机关之间商洽、询问和答复事项",
    category: "letter",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题、字号与受函机关", brief: "＋发文机关＋关于＋事项＋的函；＋机关代字〔年份〕序号＋；＋受函机关＋" },
      {
        level: 1,
        title: "背景与函商事项",
        brief: "＋来函背景、工作依据或双方关系＋；为＋目的＋，现就有关事项函商/函询如下",
      },
      { level: 1, title: "一、事项一", brief: "具体商洽或询问内容" },
      { level: 1, title: "二、事项二", brief: "具体商洽或询问内容" },
      { level: 1, title: "复函时限与联系人", brief: "请贵单位于＋日期＋前将意见/办理结果函复我单位；联系人及电话" },
      { level: 1, title: "结语与落款", brief: "特此函商/函询（答复函用「现函复如下」）；＋发文机关＋；＋年月日＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：函】
适用于不相隶属机关之间商洽工作、询问和答复问题、请求批准和答复审批事项。
语气平等、简洁、明确；按用途选择商洽函、询问函、答复函、征求意见函或审批函；结语与用途匹配。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 150-350 字；语气平实平等，不用命令式表述。`,
  },
  {
    id: "gov-minutes",
    name: "纪要",
    description: "记载会议主要情况和议定事项",
    category: "letter",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "标题与期号", brief: "＋会议名称＋纪要；第＋期＋" },
      {
        level: 1,
        title: "会议基本情况",
        brief: "时间、地点、主持人、参会范围；会议听取了＋汇报＋，研究了＋议题＋；经讨论，议定如下",
      },
      {
        level: 1,
        title: "一、议定事项一",
        brief: "会议原则同意＋事项及前提条件＋；责任单位、配合单位、完成时限",
      },
      {
        level: 1,
        title: "二、议定事项二",
        brief: "会议要求＋具体任务＋；责任单位、完成时限",
      },
      {
        level: 1,
        title: "三、待研究事项说明",
        brief: "对尚需研究的事项，由＋牵头单位＋会同＋相关单位＋进一步论证，按程序报审，不得将未决事项表述为会议决定",
      },
      { level: 1, title: "出席列席请假", brief: "出席：＋人员＋；列席：＋人员＋；请假：＋人员＋" },
    ],
    systemPrompt: `${OFFICIAL_DOCUMENT_BASE_PROMPT}

【文种：纪要】
适用于记载会议主要情况和议定事项。纪要不是逐字记录，应提炼会议共识、决定事项和落实要求。
议定事项应明确责任单位、完成时限和协同机制；未形成一致意见的事项不得写成会议决定。`,
    sectionRules: `${OFFICIAL_DOCUMENT_SECTION_RULES}\n每节 150-400 字；议定事项须含责任单位与完成时限；不编造与会人员姓名。`,
  },
];

export function isOfficialDocumentTemplate(template: WritingTemplate): boolean {
  return template.id.startsWith("gov-");
}

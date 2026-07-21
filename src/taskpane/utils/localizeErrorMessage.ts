const OFFICE_ERROR_MESSAGES: Record<string, string> = {
  GeneralException: "Word 无法完成此操作，请稍后重试或减少选区范围后再试",
  ItemNotFound: "未找到目标内容，请检查文档结构是否已变化",
  InvalidArgument: "操作参数无效，请检查输入后重试",
  AccessDenied: "没有权限执行此操作",
  ApiNotAvailable: "当前 Word 版本不支持此功能，请升级 Office 后重试",
  Conflict: "文档正在被其他操作占用，请稍后重试",
  NotSupported: "当前环境不支持此操作",
  RequestTooLarge: "文档内容过大，无法完成此操作",
  Unauthenticated: "尚未完成身份验证，无法执行此操作",
  InvalidObjectPath: "文档结构已变化，请重新定位光标或选区后重试",
  RuntimeError: "Word 运行时出错，请稍后重试",
  Busy: "Word 正在处理其他任务，请稍后重试",
  ConnectionFailure: "与 Word 的连接中断，请重试",
  NoRelationship: "文档关系无效，无法完成操作",
  ActivityLimitReached: "操作过于频繁，请稍后再试",
  InvalidRequest: "请求无效，请检查文档状态后重试",
  ResponsePayloadTooLarge: "返回内容过大，请缩小处理范围",
  ServiceUnavailable: "Word 服务暂时不可用，请稍后重试",
  UnauthorizedClient: "未授权访问 Word 文档",
  UnsupportedOperation: "当前文档状态不支持此操作",
};

function readOfficeErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;

  const record = err as { code?: unknown; name?: unknown; message?: unknown };
  if (typeof record.code === "string" && record.code.trim()) {
    return record.code.trim();
  }
  if (typeof record.name === "string" && OFFICE_ERROR_MESSAGES[record.name]) {
    return record.name;
  }
  if (typeof record.message === "string" && OFFICE_ERROR_MESSAGES[record.message.trim()]) {
    return record.message.trim();
  }
  return undefined;
}

function containsChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

export function localizeErrorMessage(err: unknown, fallback: string): string {
  const code = readOfficeErrorCode(err);
  if (code && OFFICE_ERROR_MESSAGES[code]) {
    return OFFICE_ERROR_MESSAGES[code];
  }

  if (err instanceof Error) {
    const trimmed = err.message.trim();
    if (trimmed && OFFICE_ERROR_MESSAGES[trimmed]) {
      return OFFICE_ERROR_MESSAGES[trimmed];
    }
    if (trimmed && containsChinese(trimmed)) {
      return trimmed;
    }
  }

  if (typeof err === "string") {
    const trimmed = err.trim();
    if (OFFICE_ERROR_MESSAGES[trimmed]) {
      return OFFICE_ERROR_MESSAGES[trimmed];
    }
    if (containsChinese(trimmed)) {
      return trimmed;
    }
  }

  return fallback;
}

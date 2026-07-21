/* global Office */

export function openExternalLink(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) return;

  try {
    if (typeof Office !== "undefined" && Office.context?.ui?.openBrowserWindow) {
      Office.context.ui.openBrowserWindow(trimmed);
      return;
    }
  } catch {
    // fall through
  }

  window.open(trimmed, "_blank", "noopener,noreferrer");
}

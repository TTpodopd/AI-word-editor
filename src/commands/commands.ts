/* global Office */

Office.onReady(() => {
  // Commands page for shared runtime
});

function showTaskpane(event: Office.AddinCommands.Event) {
  Office.addin.showAsTaskpane();
  event.completed();
}

// Register command functions globally for Office
(globalThis as unknown as Record<string, unknown>).showTaskpane = showTaskpane;

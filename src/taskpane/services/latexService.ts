import { convertLatexToOoxml as convertLocally } from "../utils/latexOoxml";

export async function convertLatexToOoxml(
  latex: string,
  displayMode = false
): Promise<{ ooxml: string; error?: string }> {
  return convertLocally(latex, displayMode);
}

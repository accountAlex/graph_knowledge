/**
 * A LaTeX formula on the board = an Excalidraw image element whose pixels come
 * from MathJax and whose LaTeX source lives in `customData.latex`.
 *
 * The image binary is NOT synced through Yjs: the fileId is derived deterministically
 * from the LaTeX, so every client re-renders the identical SVG locally from the
 * (tiny) latex that travels inside the element's customData. See ensureFormulaFiles
 * in WhiteboardCanvas for the receiver side.
 */
import { latexToSvg, svgToDataUrl } from "./mathToSvg";

export const FORMULA_MIME = "image/svg+xml";
export const FORMULA_DEFAULT_HEIGHT = 48;

export interface FormulaCustomData {
  latex: string;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function fileIdForLatex(latex: string): string {
  return `formula-${hash(latex)}`;
}

export interface FormulaFile {
  fileId: string;
  dataURL: string;
  aspect: number;
}

export async function buildFormulaFile(latex: string): Promise<FormulaFile> {
  const { svg, aspect } = await latexToSvg(latex);
  return { fileId: fileIdForLatex(latex), dataURL: svgToDataUrl(svg), aspect };
}

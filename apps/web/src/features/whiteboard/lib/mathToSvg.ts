/**
 * LaTeX -> self-contained SVG via MathJax.
 *
 * Loads the prebuilt **browser** bundle from `/public/mathjax/tex-svg.js` via a
 * <script> tag (NOT a bundler import — the modular `mathjax-full/js/*` files are
 * CommonJS and break under Turbopack with "require is not defined"; a plain script
 * cleanly attaches `window.MathJax`). Self-hosted, so CSP `script-src 'self'` is fine.
 * `fontCache:"none"` inlines glyphs as <path> so the SVG renders standalone.
 *
 * Async: the bundle is fetched on demand (one shared promise).
 */

interface MathJaxGlobal {
  tex2svg: (latex: string, opts?: Record<string, unknown>) => HTMLElement;
  startup: { promise: Promise<void>; typeset?: boolean };
}

const MATHJAX_SRC = "/mathjax/tex-svg.js";
let mjReady: Promise<MathJaxGlobal> | null = null;

function loadMathJax(): Promise<MathJaxGlobal> {
  if (mjReady) return mjReady;
  mjReady = new Promise<MathJaxGlobal>((resolve, reject) => {
    const w = window as unknown as { MathJax?: unknown };
    // Config read by the bundle on load; it then replaces this with the full API.
    w.MathJax = { startup: { typeset: false }, svg: { fontCache: "none" } };
    const script = document.createElement("script");
    script.src = MATHJAX_SRC;
    script.async = true;
    script.onload = () => {
      const mj = w.MathJax as MathJaxGlobal;
      mj.startup.promise.then(() => resolve(mj));
    };
    script.onerror = () => reject(new Error("Failed to load MathJax bundle"));
    document.head.appendChild(script);
  });
  return mjReady;
}

export interface RenderedMath {
  svg: string;
  aspect: number; // width / height, for proportional sizing
}

export async function latexToSvg(latex: string, color = "#1f2937"): Promise<RenderedMath> {
  const mj = await loadMathJax();
  const node = mj.tex2svg(latex && latex.trim() ? latex : "\\;", { display: true });
  const svg = node.querySelector("svg") as SVGSVGElement | null;
  if (!svg) return { svg: "", aspect: 1 };
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.style.color = color;
  const vb = (svg.getAttribute("viewBox") || "0 0 1 1").split(/\s+/).map(Number);
  const aspect = vb[2] && vb[3] ? vb[2] / vb[3] : 1;
  return { svg: svg.outerHTML, aspect };
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

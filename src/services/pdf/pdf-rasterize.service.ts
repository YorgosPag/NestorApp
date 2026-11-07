/**
 * PDF Rasterize Service — server-side, SSoT (ADR-327 §6.7).
 *
 * Converts a PDF buffer into per-page PNG buffers for downstream vision AI
 * (OpenAI Responses API, Anthropic Vision, Document AI). Bypasses native PDF
 * parsing limits in vision models when document layout is column-heavy or
 * mixes images with numeric tables (FENPLAST-class quotes).
 *
 * Pattern: AWS Textract / Google Document AI rasterization step.
 *
 * Browser-side equivalent: `src/services/thumbnail-generator.ts::generatePdfThumbnail`.
 * This module is the server-side SSoT — DO NOT inline pdfjs in route handlers.
 *
 * ADR-900 §3.8 — also the server-side **text** extraction ({@link extractPdfText}), through
 * the SAME loader: a second `import('pdfjs-dist/...')` elsewhere would be a second place
 * where the globals-before-load contract below can be forgotten.
 */

import 'server-only';

import { readPageStructure, type PageStructureRule, type PageStructureTagTable, type PdfjsOperators, type StructurePage } from './pdf-page-structure';

export interface RasterizeOptions {
  dpi?: number;
  maxPages?: number;
  maxWidthPx?: number;
}

export class RasterizeUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`PDF rasterization unavailable (native canvas binding missing or runtime not supported): ${String(cause)}`);
    this.name = 'RasterizeUnavailableError';
  }
}

const DEFAULT_DPI = 200;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_WIDTH_PX = 2000;

type CanvasLike = {
  width: number;
  height: number;
  getContext(kind: '2d'): CanvasContextLike;
  toBuffer(mime: 'image/png'): Buffer;
};
type CanvasContextLike = {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
};
/** Κατασκευαστής browser API όπως τον εξάγει το `@napi-rs/canvas` (δεν τον καλούμε εμείς). */
type BrowserGlobalCtor = new (...args: never[]) => object;

interface CanvasModule {
  createCanvas(w: number, h: number): CanvasLike;
  DOMMatrix: BrowserGlobalCtor;
  Path2D: BrowserGlobalCtor;
}

interface CanvasAndContext {
  canvas: CanvasLike | null;
  context: CanvasContextLike | null;
}

interface CanvasFactory {
  create(width: number, height: number): CanvasAndContext;
  reset(canvasAndContext: CanvasAndContext, width: number, height: number): void;
  destroy(canvasAndContext: CanvasAndContext): void;
}

interface PdfjsLib {
  OPS: PdfjsOperators;
  getDocument(opts: {
    data: Uint8Array;
    isEvalSupported: boolean;
    canvasFactory?: CanvasFactory;
  }): { promise: Promise<PdfjsDoc> };
}
interface PdfjsDoc {
  numPages: number;
  getPage(n: number): Promise<PdfjsPage>;
  destroy(): Promise<void>;
}
interface PdfjsViewport {
  width: number;
  height: number;
  /** Σημείο PDF (αρχή κάτω-αριστερά) → σημείο όψης (αρχή πάνω-αριστερά), με περιστροφή και μετατόπιση της σελίδας. */
  convertToViewportPoint(x: number, y: number): [number, number];
}
/** Ένα κομμάτι κειμένου της σελίδας — `hasEOL` = αλλαγή γραμμής μετά από αυτό. */
interface PdfjsTextItem { str?: string; hasEOL?: boolean; transform?: readonly number[]; width?: number; height?: number; type?: string; id?: string; }
interface PdfjsPage extends Pick<StructurePage, 'getOperatorList' | 'getStructTree'> {
  getTextContent(options?: { readonly includeMarkedContent: true }): Promise<{ items: ReadonlyArray<PdfjsTextItem> }>;
  getViewport(opts: { scale: number }): PdfjsViewport;
  /** PDF 1.6 `UserUnit`: 1 μονάδα χώρου χρήστη = `userUnit`/72 ίντσες. ⚠️ Το `getViewport` του pdfjs 4.5 **δεν** το λαμβάνει υπόψη. */
  readonly userUnit?: number;
  render(opts: { canvasContext: CanvasContextLike; viewport: PdfjsViewport }): { promise: Promise<void> };
  cleanup(): void;
}

let cachedPdfjs: PdfjsLib | null = null;
let cachedCanvas: CanvasModule | null = null;

/**
 * Δίνει στο global scope τα `DOMMatrix` / `Path2D` από την ΙΔΙΑ υλοποίηση καμβά
 * που ζωγραφίζει. Ο Node δεν τα έχει (επαληθευμένο σε v20), και το pdf.js τα
 * διαβάζει από το `globalThis` τη στιγμή της ζωγραφικής: χωρίς αυτά, κάθε PDF με
 * tiling pattern πέφτει με `ReferenceError: DOMMatrix is not defined`.
 *
 * Ιδεμποτητή (`??=`): δεύτερη κλήση δεν πατάει ό,τι υπάρχει ήδη.
 */
function installPdfjsBrowserGlobals(mod: CanvasModule): void {
  const scope = globalThis as unknown as Record<'DOMMatrix' | 'Path2D', BrowserGlobalCtor | undefined>;
  scope.DOMMatrix ??= mod.DOMMatrix;
  scope.Path2D ??= mod.Path2D;
}

/**
 * ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ, ΓΙ' ΑΥΤΟ ΖΕΙ ΕΔΩ ΜΕΣΑ.
 *
 * Το `pdf.mjs` αποφασίζει κατά τη ΦΟΡΤΩΣΗ αν πρέπει να γεμίσει μόνο του τα
 * `DOMMatrix`/`Path2D` (`if (!globalThis.DOMMatrix)`). Αν τα βρει έτοιμα, δεν
 * ψάχνει το προαιρετικό πακέτο `canvas` — γι' αυτό το `node-canvas` (και μαζί
 * του ολόκληρο το `@mapbox/node-pre-gyp > tar` υποδέντρο) αφαιρέθηκε από το
 * δέντρο με `pnpm.overrides["pdfjs-dist>canvas"] = "-"` (ADR-598 G2).
 *
 * Ένα `Promise.all([loadPdfjs(), loadCanvas()])` στον καλούντα ΘΑ ΗΤΑΝ ΑΓΩΝΑΣ
 * ΔΡΟΜΟΥ. Η προϋπόθεση εξασφαλίζεται εδώ, ώστε κανένας καλών να μην μπορεί να
 * τη χάσει.
 */
async function loadPdfjs(): Promise<PdfjsLib> {
  if (cachedPdfjs) return cachedPdfjs;
  installPdfjsBrowserGlobals(await loadCanvas());
  try {
    const mod = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsLib;
    cachedPdfjs = mod;
    return mod;
  } catch (e) {
    throw new RasterizeUnavailableError(e);
  }
}

async function loadCanvas(): Promise<CanvasModule> {
  if (cachedCanvas) return cachedCanvas;
  try {
    const mod = (await import('@napi-rs/canvas')) as unknown as CanvasModule;
    cachedCanvas = mod;
    return mod;
  } catch (e) {
    throw new RasterizeUnavailableError(e);
  }
}

// @napi-rs/canvas throws "Failed to unwrap exclusive reference" when pdfjs
// tries to set canvas.width = 0 during cleanup (browser pattern to release GPU
// memory — not applicable to native Node bindings). This factory overrides
// destroy() to null references instead of zeroing dimensions.
function makeCanvasFactory(createCanvas: (w: number, h: number) => CanvasLike): CanvasFactory {
  return {
    create(width, height) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(canvasAndContext, width, height) {
      if (!canvasAndContext.canvas) return;
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext) {
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    },
  };
}

/**
 * Μία ζωγραφισμένη σελίδα **μαζί με την κλίμακά της** (ADR-929 §6.9 #7). Το `dpi` είναι αυτό που **πράγματι** χρησιμοποιήθηκε,
 * όχι αυτό που ζητήθηκε: το ταβάνι πλάτους μικραίνει την κλίμακα σιωπηλά, και το `UserUnit` αλλάζει το μέγεθος της ίντσας.
 * Ένα DPI μαντεμένο από regex στο `/MediaBox` βγήκε 10/60/86 και έριξε τη μέτρηση καταγραφής (§6.9 #6).
 */
export interface RasterizedPdfPage {
  readonly png: Buffer;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Pixel ανά **φυσική** ίντσα της σελίδας = κλίμακα·72/userUnit. */
  readonly dpi: number;
  /** Φυσικό μέγεθος της (περιστραμμένης) σελίδας. */
  readonly pageWidthMm: number;
  readonly pageHeightMm: number;
}

const MM_PER_INCH = 25.4;

/** Ζωγραφίζει ΜΙΑ σελίδα σε PNG, με λευκό υπόβαθρο και ταβάνι πλάτους, και λέει σε ποια κλίμακα. */
async function renderPage(
  page: PdfjsPage,
  createCanvas: (w: number, h: number) => CanvasLike,
  limits: { dpi: number; maxWidthPx: number },
): Promise<RasterizedPdfPage> {
  const baseScale = limits.dpi / 72;
  const baseViewport = page.getViewport({ scale: baseScale });
  const widthCap = baseViewport.width > limits.maxWidthPx
    ? limits.maxWidthPx / baseViewport.width
    : 1;
  const scale = baseScale * widthCap;
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  const userUnit = page.userUnit && page.userUnit > 0 ? page.userUnit : 1;
  const inchesPerUnit = userUnit / 72;
  return {
    png: canvas.toBuffer('image/png'),
    widthPx: canvas.width,
    heightPx: canvas.height,
    dpi: scale / inchesPerUnit,
    pageWidthMm: (viewport.width / scale) * inchesPerUnit * MM_PER_INCH,
    pageHeightMm: (viewport.height / scale) * inchesPerUnit * MM_PER_INCH,
  };
}

/** Οι σελίδες ως PNG — για όποιον δεν χρειάζεται την κλίμακα (οπτική ανάγνωση AI). */
export async function rasterizePdfPages(
  pdfBuffer: Buffer,
  options: RasterizeOptions = {},
): Promise<Buffer[]> {
  return (await rasterizePdfPageImages(pdfBuffer, options)).map((page) => page.png);
}

/** Οι σελίδες ως PNG **με την κλίμακα που πράγματι χρησιμοποιήθηκε** — για ό,τι μετρά σε pixel (ADR-929 §6.9 #7). */
export async function rasterizePdfPageImages(
  pdfBuffer: Buffer,
  options: RasterizeOptions = {},
): Promise<RasterizedPdfPage[]> {
  const dpi = options.dpi ?? DEFAULT_DPI;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxWidthPx = options.maxWidthPx ?? DEFAULT_MAX_WIDTH_PX;

  // Σειριακά και ΟΧΙ Promise.all: το loadPdfjs() οφείλει να δει τα globals έτοιμα.
  const pdfjs = await loadPdfjs();
  const canvasMod = await loadCanvas();
  const { createCanvas } = canvasMod;
  const canvasFactory = makeCanvasFactory(createCanvas);

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    canvasFactory,
  });
  const doc = await loadingTask.promise;

  const pages: RasterizedPdfPage[] = [];
  const pageCount = Math.min(doc.numPages, maxPages);

  try {
    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      try {
        pages.push(await renderPage(page, createCanvas, { dpi, maxWidthPx }));
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }

  return pages;
}

/** Ένα κομμάτι κειμένου σε κλάσματα σελίδας, αρχή πάνω-αριστερά — ανεξάρτητα από ανάλυση και ζουμ. */
export interface PdfPageTextItem {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PdfPageReading {
  readonly png: Buffer;
  readonly items: readonly PdfPageTextItem[];
  readonly pageCount: number;
  /** Οι ζωγραφισμένες γραμμές της σελίδας: από εκεί ανασυντίθενται οι πίνακες χωρίς μοντέλο. */
  readonly rules: readonly PageStructureRule[];
  /** Οι πίνακες των ετικετών δομής, όταν το PDF έχει. Δεύτερος μάρτυρας, όχι αυθεντία. */
  readonly tagTables: readonly PageStructureTagTable[];
}

function textItemOf(item: PdfjsTextItem, viewport: PdfjsViewport): PdfPageTextItem | null {
  const { str, transform, width = 0, height = 0 } = item;
  if (!str || str.trim() === '' || !transform) return null;
  const [left, baseline] = viewport.convertToViewportPoint(transform[4], transform[5]);
  return {
    text: str,
    x: left / viewport.width,
    y: (baseline - height) / viewport.height,
    width: width / viewport.width,
    height: height / viewport.height,
  };
}

/**
 * **Μία σελίδα ως εικόνα + κείμενο με θέσεις** (ADR-923 §5.5): η εικόνα πάει στο μοντέλο, το κείμενο με τις θέσεις του είναι
 * η απόδειξη απέναντι στην οποία ελέγχεται η απάντησή του. Σαρωμένη σελίδα ⇒ κενά `items`, ποτέ σφάλμα.
 */
export async function readPdfPage(
  pdfBuffer: Buffer,
  pageNumber: number,
  options: Pick<RasterizeOptions, 'dpi' | 'maxWidthPx'> = {},
): Promise<PdfPageReading> {
  const pdfjs = await loadPdfjs();
  const { createCanvas } = await loadCanvas();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), isEvalSupported: false, canvasFactory: makeCanvasFactory(createCanvas) }).promise;
  try {
    const page = await doc.getPage(pageNumber);
    try {
      const limits = { dpi: options.dpi ?? DEFAULT_DPI, maxWidthPx: options.maxWidthPx ?? DEFAULT_MAX_WIDTH_PX };
      const viewport = page.getViewport({ scale: 1 });
      const { items } = await page.getTextContent();
      const { png } = await renderPage(page, createCanvas, limits);
      const structure = await readPageStructure(page, viewport, pdfjs.OPS);
      return { png, items: items.flatMap((item) => textItemOf(item, viewport) ?? []), pageCount: doc.numPages, ...structure };
    } finally {
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
}

/** Πόσες σελίδες έχει το PDF (ο στόχος μιας παρτίδας κρίνεται πριν ξοδευτεί ούτε μία ανάγνωση). */
export async function countPdfPages(pdfBuffer: Buffer): Promise<number> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), isEvalSupported: false }).promise;
  try {
    return doc.numPages;
  } finally {
    await doc.destroy();
  }
}

/** Ένα κομμάτι κειμένου σε μονάδες PDF, αρχή κάτω-αριστερά, με τον πίνακα του: ο καλών ξέρει έτσι και μέγεθος και περιστροφή. */
export interface PdfTextRun {
  readonly text: string;
  readonly transform: readonly number[];
  readonly width: number;
}

export interface PdfPageTextLayout {
  readonly widthPt: number;
  readonly heightPt: number;
  readonly runs: readonly PdfTextRun[];
}

/** **Η γεωμετρία του κειμένου όλου του PDF** (ADR-923 §5.6.1), χωρίς ζωγραφική: ό,τι χρειάζεται ένας έλεγχος διάταξης. */
export async function readPdfTextLayout(pdfBuffer: Uint8Array): Promise<PdfPageTextLayout[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), isEvalSupported: false }).promise;
  const pages: PdfPageTextLayout[] = [];
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      try {
        const { width: widthPt, height: heightPt } = page.getViewport({ scale: 1 });
        const { items } = await page.getTextContent();
        const runs = items.flatMap(({ str, transform, width }) => (str && str.trim() !== '' && transform ? [{ text: str, transform, width: width ?? 0 }] : []));
        pages.push({ widthPt, heightPt, runs });
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

/**
 * **Το κείμενο του PDF, ανά σελίδα** (ADR-900 §3.8 — ανάγνωση ΠΚΑ). Γραμμές ενωμένες με αλλαγή γραμμής
 * όπου το pdf.js σημειώνει τέλος γραμμής· κανένα OCR (σαρωμένο PDF ⇒ κενό κείμενο, και ο
 * καλών το κρίνει ως «δεν διαβάστηκε», ποτέ ως «δεν υπάρχει»).
 */
export async function extractPdfText(
  pdfBuffer: Buffer,
  options: { readonly maxPages?: number } = {},
): Promise<string[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), isEvalSupported: false }).promise;
  const pageCount = Math.min(doc.numPages, options.maxPages ?? DEFAULT_MAX_PAGES);
  const pages: string[] = [];
  try {
    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      try {
        const { items } = await page.getTextContent();
        pages.push(items.map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ' ')).join(''));
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

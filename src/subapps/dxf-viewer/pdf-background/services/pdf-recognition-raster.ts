/**
 * =============================================================================
 * ΑΠΟΔΟΣΗ ΣΕΛΙΔΑΣ PDF ΣΤΗΝ ΕΓΓΕΝΗ ΑΝΑΛΥΣΗ ΤΗΣ ΣΑΡΩΣΗΣ — ΓΙΑ ΑΝΑΓΝΩΡΙΣΗ (ADR-929 §6.16 βήμα 4)
 * =============================================================================
 *
 * Το υπόβαθρο PDF ζωγραφίζεται στην οθόνη από απόδοση ×2 (`PdfPageProvider`, 144 dpi). Μια σάρωση 200 dpi όμως έχει
 * περισσότερη πληροφορία: για το OCR η σελίδα αποδίδεται **μία φορά, κατ' απαίτηση**, στην κλίμακα της ίδιας της σάρωσης
 * (`nativeImageScale`). Η εμφάνιση στην οθόνη **δεν** αλλάζει.
 *
 * 🔑 **Απομονωμένο έγγραφο.** Ο singleton `PdfRenderer` καταστρέφει το προηγούμενο έγγραφο σε κάθε `loadDocument`· εδώ ανοίγει
 *   **δικό μας** έγγραφο (ίδιο pdf.js, ίδιος worker, `PdfRenderer.pdfjs()`) και κλείνει πάντα στο `finally`.
 * 🔑 **Μόνο όταν κερδίζουμε.** Διανυσματική σελίδα ή σάρωση με ανάλυση ≤ `minScale` ⇒ `null` **πριν** από κάθε απόδοση· ο
 *   καλών κρατά την εικόνα που ήδη έχει.
 * 🔑 **Όριο pixel.** Η κλίμακα περιορίζεται ώστε η απόδοση να μην ξεπερνά `maxPixels` (μνήμη RGBA + όρια καμβά του browser).
 * ⚠️ Τρέχει στον κύριο νήμα (καμβάς DOM, όπως το `PdfRenderer.renderPage`).
 *
 * @module subapps/dxf-viewer/pdf-background/services/pdf-recognition-raster
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { nativeImageScale } from './pdf-native-resolution';
import { PdfRenderer } from './PdfRenderer';

const logger = createModuleLogger('pdf-recognition-raster');

export interface PdfRecognitionRenderOptions {
  /** Η κλίμακα που ήδη έχει ο καλών: δεν αποδίδεται τίποτα αν η σάρωση δεν είναι πυκνότερη. */
  readonly minScale: number;
  /** Ανώτατα pixel της απόδοσης. */
  readonly maxPixels: number;
}

export interface PdfRecognitionRender {
  readonly raster: PlanRaster;
  /** Η κλίμακα της απόδοσης (px ανά pt, όπως το `scale` του `getViewport`). */
  readonly scale: number;
}

/** Η μεγαλύτερη κλίμακα ≤ `scale` με απόδοση εντός `maxPixels` (σελίδα `w × h` pt σε κλίμακα 1). */
function scaleWithinPixels(scale: number, pageWidthPt: number, pageHeightPt: number, maxPixels: number): number {
  const area = pageWidthPt * pageHeightPt;
  return area > 0 ? Math.min(scale, Math.sqrt(maxPixels / area)) : scale;
}

type PageViewport = { readonly width: number; readonly height: number };
interface RenderablePage {
  getViewport(options: { scale: number }): PageViewport;
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PageViewport }): { promise: Promise<unknown> };
}

async function renderToRaster(page: RenderablePage, scale: number): Promise<PlanRaster | null> {
  const viewport = page.getViewport({ scale });
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx || width <= 0 || height <= 0) return null;
  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { rgba: ctx.getImageData(0, 0, width, height).data, width, height };
  } finally {
    canvas.width = 0; // αποδέσμευση της μνήμης του καμβά αμέσως, όχι στον επόμενο GC
    canvas.height = 0;
  }
}

type PdfJs = Awaited<ReturnType<typeof PdfRenderer.pdfjs>>;
type PdfDocument = Awaited<ReturnType<PdfJs['getDocument']>['promise']>;
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>;

/** Η σελίδα του `pdf` σε **δικό μας** έγγραφο (βλ. κεφαλίδα), η εγγενής ανάλυση της σάρωσής της, και κλείσιμο ΠΑΝΤΑ. */
async function withIsolatedPage<T>(
  pdf: Blob, pageNumber: number, use: (page: PdfPage, native: number | null) => Promise<T>,
): Promise<T> {
  const pdfjs = await PdfRenderer.pdfjs();
  const doc = await pdfjs.getDocument({ data: await pdf.arrayBuffer() }).promise;
  try {
    const page = await doc.getPage(pageNumber);
    const unit = page.getViewport({ scale: 1 });
    return await use(page, nativeImageScale(await page.getOperatorList(), pdfjs.OPS, unit.width * unit.height));
  } finally {
    await doc.destroy();
  }
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Η σελίδα `pageNumber` του `pdf` στην εγγενή ανάλυση της σάρωσής της, ή `null` (διανυσματική σελίδα · σάρωση όχι πυκνότερη
 * από `minScale` · αποτυχία απόδοσης). Δεν ρίχνει.
 */
export async function renderPdfPageAtNativeResolution(
  pdf: Blob, pageNumber: number, options: PdfRecognitionRenderOptions,
): Promise<PdfRecognitionRender | null> {
  const started = performance.now();
  try {
    return await withIsolatedPage(pdf, pageNumber, async (page, native) => {
      if (native === null) return null;
      const unit = page.getViewport({ scale: 1 });
      const scale = scaleWithinPixels(native, unit.width, unit.height, options.maxPixels);
      if (scale <= options.minScale) return null;
      const raster = await renderToRaster(page, scale);
      if (raster) logger.info('Native-resolution render', { native, scale, width: raster.width, height: raster.height, ms: Math.round(performance.now() - started) });
      return raster ? { raster, scale } : null;
    });
  } catch (error) {
    logger.warn('Native-resolution render failed', { error: errorText(error) });
    return null;
  }
}

/**
 * ADR-929 Δ7 Γ — το μέσο της σελίδας: `vector` = καμία κυρίαρχη εικόνα (σχεδιασμένη σε CAD) · `raster` = σάρωση. Ο ΙΔΙΟΣ
 * κανόνας με την εγγενή ανάλυση (`nativeImageScale`, κάλυψη ≥ μισή σελίδα). Αποτυχία ⇒ `null` (ο καλών δεν υποθέτει «CAD»).
 */
export async function pdfPageMedium(pdf: Blob, pageNumber: number): Promise<'vector' | 'raster' | null> {
  try {
    return await withIsolatedPage(pdf, pageNumber, async (_page, native) => (native === null ? 'vector' : 'raster'));
  } catch (error) {
    logger.warn('Page medium probe failed', { error: errorText(error) });
    return null;
  }
}

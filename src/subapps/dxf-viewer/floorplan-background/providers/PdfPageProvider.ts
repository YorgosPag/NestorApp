import { PdfRenderer } from '../../pdf-background/services/PdfRenderer';
import type { IFloorplanBackgroundProvider } from './IFloorplanBackgroundProvider';
import type {
  NaturalBounds,
  ProviderCapabilities,
  ProviderLoadResult,
  ProviderRenderParams,
  ProviderSource,
} from './types';
// 🔑 ΕΝΑΣ πίνακας px εικόνας → καμβάς, χτισμένος από το SSoT `rasterToSceneAffine` (ADR-929 Δ3):
// ο ίδιος που ρωτά η αναγνώριση κάτοψης, ώστε προεπισκόπηση ≡ αποτέλεσμα.
import { applyRasterCanvasTransform } from './provider-canvas-transforms';
import type { PlanRaster, RecognitionRaster } from '@/lib/geometry/raster/plan-raster';
import { cropPlanRegion, naturalRecognitionRaster, readPlanRaster } from './provider-plan-raster';
import type { RasterRectPx } from '../../types/coordinate-space';
import { renderPdfPageAtNativeResolution } from '../../pdf-background/services/pdf-recognition-raster';
import { PDF_RENDER_CONFIG } from '../../pdf-background/types/pdf.types';

const SUPPORTED_MIME_TYPES = ['application/pdf'] as const;
const RENDER_SCALE = 2;
const PAGE_NUMBER = 1;

/**
 * PDF provider for the floorplan-background system. Wraps the existing
 * PdfRenderer singleton: loads a document, renders page 1 at 2× scale,
 * caches the rendered image as an HTMLImageElement (independent of the
 * pdfjs document lifecycle).
 *
 * ADR-340 §3.3 — Q7: single-page only. Multi-page PDFs render only page 1.
 */
export class PdfPageProvider implements IFloorplanBackgroundProvider {
  readonly id = 'pdf-page' as const;

  readonly capabilities: ProviderCapabilities = {
    multiPage: false,
    exifAware: false,
    vectorEquivalent: true,
    calibratable: true,
  };

  readonly supportedMimeTypes: ReadonlyArray<string> = SUPPORTED_MIME_TYPES;

  private _image: HTMLImageElement | null = null;
  private _bounds: NaturalBounds = { width: 0, height: 0 };
  /** Το PDF, για την κατ' απαίτηση απόδοση αναγνώρισης (ADR-929 §6.16 βήμα 4). Ο singleton μπορεί να έχει ήδη άλλο έγγραφο. */
  private _pdf: Blob | null = null;

  // ── Public API ────────────────────────────────────────────────────────────

  async loadAsync(source: ProviderSource): Promise<ProviderLoadResult> {
    try {
      const file = await this._sourceToFile(source);
      const loadResult = await PdfRenderer.loadDocument(file);
      if (!loadResult.success || !loadResult.document) {
        throw new Error(loadResult.error ?? 'PDF load failed');
      }

      const renderResult = await PdfRenderer.renderPage(PAGE_NUMBER, { scale: RENDER_SCALE });
      if (!renderResult.success || !renderResult.imageUrl || !renderResult.dimensions) {
        throw new Error(renderResult.error ?? 'PDF page render failed');
      }

      this._image = await this._decodeImage(renderResult.imageUrl);
      // ADR-929 Δ3 — τα όρια είναι το ΠΛΕΓΜΑ PIXEL που ζωγραφίζεται, όχι οι διαστάσεις του viewport του
      // pdf.js: εκείνες είναι δεκαδικές (π.χ. 1683,78) ενώ ο καμβάς τις κόβει (1683). Με τα δεκαδικά, η
      // απεικόνιση px → σκηνή και η εικόνα στην οθόνη θα διέφεραν κατά το κλάσμα σε κάθε υπόβαθρο PDF.
      this._bounds = { width: this._image.naturalWidth, height: this._image.naturalHeight };
      this._pdf = file;

      return {
        success: true,
        bounds: this._bounds,
        metadata: { pdfPageNumber: 1, imageMimeType: 'application/pdf' },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  render(ctx: CanvasRenderingContext2D, params: ProviderRenderParams): void {
    const img = this._image;
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = params.opacity;
    applyRasterCanvasTransform(ctx, params, this._bounds);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  getNaturalBounds(): NaturalBounds {
    return this._bounds;
  }

  getPlanRaster(): PlanRaster | null {
    return readPlanRaster(this._image, this._bounds);
  }

  /** ADR-929 Δ21 (δ) βήμα 1 — μικρογραφία περιοχής από την ίδια πηγή (`cropPlanRegion`). */
  getRegionImage(rect: RasterRectPx, maxEdgePx: number): Promise<Blob | null> {
    return cropPlanRegion(this._image, this._bounds, rect, maxEdgePx);
  }

  /**
   * ADR-929 §6.16 βήμα 4 — σάρωση πυκνότερη από την απόδοση της οθόνης ⇒ η σελίδα στην εγγενή της ανάλυση, με
   * `naturalPerRasterPx = RENDER_SCALE / κλίμακα` (και τα δύο είναι px ανά pt της ίδιας σελίδας, άρα η απεικόνιση είναι ακριβής
   * ομοιόμορφη κλίμακα). Διανυσματική σελίδα ή όχι πυκνότερη σάρωση ⇒ η εικόνα της οθόνης (`naturalPerRasterPx = 1`).
   */
  async getRecognitionRaster(): Promise<RecognitionRaster | null> {
    const pdf = this._pdf;
    if (pdf === null || this._image === null) return null;
    const native = await renderPdfPageAtNativeResolution(pdf, PAGE_NUMBER, {
      minScale: RENDER_SCALE, maxPixels: PDF_RENDER_CONFIG.RECOGNITION_MAX_PIXELS,
    });
    if (this._pdf !== pdf) return null; // dispose / νέα φόρτωση στο μεταξύ
    if (native !== null) return { raster: native.raster, naturalPerRasterPx: RENDER_SCALE / native.scale };
    return naturalRecognitionRaster(this.getPlanRaster());
  }

  dispose(): void {
    this._image = null;
    this._bounds = { width: 0, height: 0 };
    this._pdf = null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _sourceToFile(source: ProviderSource): Promise<File> {
    if (source.kind === 'file') return source.file;
    const url = source.kind === 'url' ? source.url : source.path;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const blob = await res.blob();
    return new File([blob], 'document.pdf', { type: 'application/pdf' });
  }

  private _decodeImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to decode PDF image: ${url}`));
      img.src = url;
    });
  }

}

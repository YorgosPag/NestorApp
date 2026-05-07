import { PdfRenderer } from '../../pdf-background/services/PdfRenderer';
import type { IFloorplanBackgroundProvider } from './IFloorplanBackgroundProvider';
import type {
  NaturalBounds,
  ProviderCapabilities,
  ProviderLoadResult,
  ProviderRenderParams,
  ProviderSource,
} from './types';

const SUPPORTED_MIME_TYPES = ['application/pdf'] as const;
const RENDER_SCALE = 2;

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

  // ── Public API ────────────────────────────────────────────────────────────

  async loadAsync(source: ProviderSource): Promise<ProviderLoadResult> {
    try {
      const file = await this._sourceToFile(source);
      const loadResult = await PdfRenderer.loadDocument(file);
      if (!loadResult.success || !loadResult.document) {
        throw new Error(loadResult.error ?? 'PDF load failed');
      }

      const renderResult = await PdfRenderer.renderPage(1, { scale: RENDER_SCALE });
      if (!renderResult.success || !renderResult.imageUrl || !renderResult.dimensions) {
        throw new Error(renderResult.error ?? 'PDF page render failed');
      }

      this._image = await this._decodeImage(renderResult.imageUrl);
      this._bounds = {
        width: renderResult.dimensions.width,
        height: renderResult.dimensions.height,
      };

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
    if (params.cad) {
      this._applyCadTransform(ctx, params);
      ctx.drawImage(img, 0, -img.height);
    } else {
      this._applyScreenTransform(ctx, params);
      ctx.drawImage(img, 0, 0);
    }
    ctx.restore();
  }

  getNaturalBounds(): NaturalBounds {
    return this._bounds;
  }

  dispose(): void {
    this._image = null;
    this._bounds = { width: 0, height: 0 };
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

  private _applyScreenTransform(
    ctx: CanvasRenderingContext2D,
    params: ProviderRenderParams,
  ): void {
    const { transform, worldToCanvas } = params;
    ctx.translate(worldToCanvas.offsetX, worldToCanvas.offsetY);
    ctx.scale(worldToCanvas.scale, worldToCanvas.scale);
    ctx.translate(transform.translateX, transform.translateY);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scaleX, transform.scaleY);
  }

  private _applyCadTransform(
    ctx: CanvasRenderingContext2D,
    params: ProviderRenderParams,
  ): void {
    const { transform, worldToCanvas, viewport, cad } = params;
    if (!cad) return;
    ctx.translate(cad.margins.left, viewport.height - cad.margins.top);
    ctx.scale(1, -1);
    ctx.translate(worldToCanvas.offsetX, worldToCanvas.offsetY);
    ctx.scale(worldToCanvas.scale, worldToCanvas.scale);
    ctx.translate(transform.translateX, transform.translateY);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scaleX, transform.scaleY);
    ctx.scale(1, -1);
  }
}

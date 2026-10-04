import * as utif from 'utif';
import exifr from 'exifr';
import type { IFloorplanBackgroundProvider } from './IFloorplanBackgroundProvider';
import type {
  NaturalBounds,
  ProviderCapabilities,
  ProviderLoadResult,
  ProviderRenderParams,
  ProviderSource,
} from './types';
import { isTiff } from './image-compression';
// 🔑 Ένας ορισμός των δύο μετασχηματισμών καμβά — ήταν γραμμένοι και στους δύο παρόχους
// (CHECK 3.28, 243 tokens). Η άγκυρα του CAD τρόπου είναι το SSoT της περιοχής σχεδίασης.
import { applyCadTransform, applyScreenTransform } from './provider-canvas-transforms';

const SUPPORTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
] as const;

export class ImageProvider implements IFloorplanBackgroundProvider {
  readonly id = 'image' as const;

  readonly capabilities: ProviderCapabilities = {
    multiPage: false,
    exifAware: true,
    vectorEquivalent: false,
    calibratable: true,
  };

  readonly supportedMimeTypes: ReadonlyArray<string> = SUPPORTED_MIME_TYPES;

  private _canvas: OffscreenCanvas | null = null;
  private _bounds: NaturalBounds = { width: 0, height: 0 };

  // ── Public API ────────────────────────────────────────────────────────────

  async loadAsync(source: ProviderSource): Promise<ProviderLoadResult> {
    try {
      const { blob, fileName } = await this._fetchBlob(source);
      // Μόνο πληροφορία (ADR-340: η αρχική τιμή EXIF για debugging) — ΔΕΝ στρέφουμε με αυτήν.
      const orientation = await this._readExifOrientation(blob, fileName);

      const canvas = isTiff(new File([blob], fileName ?? 'img'))
        ? await this._decodeTiff(blob)
        : await this._decodeStandard(blob);

      this._canvas = canvas;
      this._bounds = { width: canvas.width, height: canvas.height };

      return { success: true, bounds: this._bounds, metadata: { imageOrientation: orientation } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  render(ctx: CanvasRenderingContext2D, params: ProviderRenderParams): void {
    if (!this._canvas) return;
    ctx.save();
    ctx.globalAlpha = params.opacity;
    if (params.cad) {
      applyCadTransform(ctx, params);
      ctx.drawImage(this._canvas, 0, -this._canvas.height);
    } else {
      applyScreenTransform(ctx, params);
      ctx.drawImage(this._canvas, 0, 0);
    }
    ctx.restore();
  }


  getNaturalBounds(): NaturalBounds {
    return this._bounds;
  }

  dispose(): void {
    this._canvas = null;
    this._bounds = { width: 0, height: 0 };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _fetchBlob(
    source: ProviderSource,
  ): Promise<{ blob: Blob; fileName?: string }> {
    if (source.kind === 'file') {
      return { blob: source.file, fileName: source.file.name };
    }
    const url = source.kind === 'url' ? source.url : source.path;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const blob = await res.blob();
    return { blob };
  }

  private async _readExifOrientation(
    blob: Blob,
    fileName?: string,
  ): Promise<number> {
    try {
      if (fileName && isTiff(new File([blob], fileName))) return 1;
      const result = await exifr.parse(blob, { pick: ['Orientation'] });
      return (result as Record<string, number> | null)?.Orientation ?? 1;
    } catch {
      return 1;
    }
  }

  private async _decodeTiff(blob: Blob): Promise<OffscreenCanvas> {
    const buffer = await blob.arrayBuffer();
    const pages = utif.decode(buffer);
    if (!pages.length) throw new Error('TIFF: no pages decoded');
    utif.decodeImages(buffer, pages);
    const page = pages[0];
    const rgba = utif.toRGBA8(page);
    const imageData = new ImageData(
      new Uint8ClampedArray(rgba),
      page.width,
      page.height,
    );
    const canvas = new OffscreenCanvas(page.width, page.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('TIFF: OffscreenCanvas 2d context unavailable');
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * 🔑 ΜΙΑ πηγή αλήθειας για τον προσανατολισμό: ο decoder του browser (ADR-899 §9 · ADR-340).
   * Το `from-image` εφαρμόζει τον EXIF πριν φτάσουμε στο canvas — ίδιο μοτίβο με
   * `services/profile/avatar-render.ts`. Εδώ υπήρχε ΚΑΙ χειροκίνητη στροφή από `exifr`
   * ⇒ λήψη κινητού (`Orientation = 6`) στρεφόταν δύο φορές (2400×1800 αντί 1800×2400, μετρημένο).
   * ⚠️ ΜΗΝ τη φέρεις πίσω με `imageOrientation: 'none'`: ο Chrome 154 το αγνοεί (μετρημένο 1800×2400).
   */
  private async _decodeStandard(blob: Blob): Promise<OffscreenCanvas> {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  }
}

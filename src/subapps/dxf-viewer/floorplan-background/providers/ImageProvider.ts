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
  private _exifOrientation = 1;

  // ── Public API ────────────────────────────────────────────────────────────

  async loadAsync(source: ProviderSource): Promise<ProviderLoadResult> {
    try {
      const { blob, fileName } = await this._fetchBlob(source);
      const orientation = await this._readExifOrientation(blob, fileName);
      this._exifOrientation = orientation;

      const canvas = isTiff(new File([blob], fileName ?? 'img'))
        ? await this._decodeTiff(blob)
        : await this._decodeStandard(blob);

      const rotated = this._applyOrientation(canvas, orientation);
      this._canvas = rotated;
      this._bounds = { width: rotated.width, height: rotated.height };

      return { success: true, bounds: this._bounds, metadata: { imageOrientation: orientation } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  render(ctx: CanvasRenderingContext2D, params: ProviderRenderParams): void {
    if (!this._canvas) return;
    const { transform, worldToCanvas, opacity } = params;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(worldToCanvas.offsetX, worldToCanvas.offsetY);
    ctx.scale(worldToCanvas.scale, worldToCanvas.scale);
    ctx.translate(transform.translateX, transform.translateY);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scaleX, transform.scaleY);
    ctx.drawImage(this._canvas, 0, 0);
    ctx.restore();
  }

  getNaturalBounds(): NaturalBounds {
    return this._bounds;
  }

  dispose(): void {
    this._canvas = null;
    this._bounds = { width: 0, height: 0 };
    this._exifOrientation = 1;
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

  private async _decodeStandard(blob: Blob): Promise<OffscreenCanvas> {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  }

  private _applyOrientation(
    source: OffscreenCanvas,
    orientation: number,
  ): OffscreenCanvas {
    if (orientation === 1) return source;

    const { width: sw, height: sh } = source;
    const swapped = orientation >= 5 && orientation <= 8;
    const dw = swapped ? sh : sw;
    const dh = swapped ? sw : sh;

    const out = new OffscreenCanvas(dw, dh);
    const ctx = out.getContext('2d');
    if (!ctx) return source;

    this._setOrientationTransform(ctx, orientation, sw, sh, dw, dh);
    ctx.drawImage(source, 0, 0);
    return out;
  }

  private _setOrientationTransform(
    ctx: OffscreenCanvasRenderingContext2D,
    orientation: number,
    sw: number,
    sh: number,
    dw: number,
    dh: number,
  ): void {
    // EXIF orientation 1–8 → canvas transform (pre-rotation = hardware rotation)
    // sw/sh = source width/height; dw/dh = destination (post-rotation) width/height
    switch (orientation) {
      case 2: ctx.transform(-1, 0, 0,  1, dw,  0 ); break; // flip H
      case 3: ctx.transform(-1, 0, 0, -1, dw, dh ); break; // rotate 180
      case 4: ctx.transform( 1, 0, 0, -1,  0, dh ); break; // flip V
      case 5: ctx.transform( 0, 1, 1,  0,  0,  0 ); break; // transpose
      case 6: ctx.transform( 0, 1,-1,  0, sh,  0 ); break; // rotate 90 CW
      case 7: ctx.transform( 0,-1,-1,  0, sh, sw ); break; // transverse
      case 8: ctx.transform( 0,-1, 1,  0,  0, sw ); break; // rotate 270 CW
      default: break;
    }
  }
}

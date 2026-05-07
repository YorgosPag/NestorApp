const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const RESIZE_MAX_EDGE = 8192;
const JPEG_QUALITY = 0.85;

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface CompressionError {
  kind: 'too-large';
  message: string;
}

export type CompressionOutcome =
  | { ok: true; result: CompressionResult }
  | { ok: false; error: CompressionError };

function calcResizeDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= RESIZE_MAX_EDGE) return { width, height };
  const ratio = RESIZE_MAX_EDGE / maxEdge;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

async function drawToOffscreen(
  source: ImageBitmap | HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): Promise<Blob | null> {
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
}

export async function compressImage(
  source: ImageBitmap | HTMLImageElement,
  originalSize: number,
  hasAlpha: boolean,
): Promise<CompressionOutcome> {
  if (originalSize <= MAX_BYTES) {
    const canvas = new OffscreenCanvas(source.width, source.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0);
    const mime = hasAlpha ? 'image/png' : 'image/jpeg';
    const quality = hasAlpha ? undefined : JPEG_QUALITY;
    const blob = await canvas.convertToBlob({ type: mime, quality });
    return { ok: true, result: { blob, width: source.width, height: source.height } };
  }

  const { width, height } = calcResizeDimensions(source.width, source.height);
  const blob = await drawToOffscreen(source, width, height);
  if (!blob) {
    return { ok: false, error: { kind: 'too-large', message: 'OffscreenCanvas unavailable' } };
  }

  if (blob.size > MAX_BYTES) {
    return {
      ok: false,
      error: { kind: 'too-large', message: `File ${Math.round(blob.size / 1024 / 1024)}MB > 50MB after compression` },
    };
  }

  return { ok: true, result: { blob, width, height } };
}

export function isTiff(file: File): boolean {
  return (
    file.type === 'image/tiff' ||
    file.type === 'image/tif' ||
    /\.tiff?$/i.test(file.name)
  );
}

/**
 * ============================================================================
 * IMAGE EXPORT — κοινά decode/fetch helpers (N.12/N.18 anti-clone)
 * ============================================================================
 *
 * Κοινή λογική ανάμεσα σε δύο ανεξάρτητα async pre-pass:
 *   • `image-fill-export.ts`   (ADR-643 Φ5b — hatch image fill, tile-grid + PIP culling)
 *   • `image-entity-export.ts` (ADR-651 Φάση Ε — «γυμνό» ImageEntity, ΕΝΑ insert)
 *
 * Και οι δύο χρειάζονται μόνο: (1) decode εικόνας → pixel dims με timeout-guard, και
 * (2) fetch raw bytes → `ExportArtifact` για bundling στο `.zip`. Το tile-grid/PIP
 * culling είναι hatch-specific και ΔΕΝ ζει εδώ — μένει στο `image-fill-export.ts`.
 *
 * @module export/core/image-export-shared
 * @see export/core/image-fill-export
 * @see export/core/image-entity-export
 */

import type { ExportArtifact } from '../types';
import { DXF_TIMING } from '../../config/dxf-timing';

/**
 * ADR-644 export-blocker — μέγιστος χρόνος ανά image op (decode / fetch). Ένα διαγραμμένο
 * asset (404) με `crossOrigin='anonymous'` μπορεί να κάνει το `img.decode()` να μη
 * settle-άρει ποτέ (γνωστό Chromium gotcha) → πάγωμα ΟΛΟΥ του export. Ο timeout εγγυάται
 * ασφαλή fallback (καλών αποφασίζει: solid downgrade ή σιωπηλή παράλειψη).
 */
export const IMAGE_OP_TIMEOUT_MS = DXF_TIMING.lifecycle.IMAGE_OP_TIMEOUT;

/** Reject `p` αν δεν settle-άρει εντός `ms`. Το dangling promise αφήνεται — αβλαβές. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('image-export: op timed out')), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * One-shot decode ενός `src` (https URL ή data URL) με timeout-guard. `crossOrigin='anonymous'`
 * ώστε τυχόν μετέπειτα χρήση canvas (π.χ. `averageImageColor`) να μη taint-άρει. `null` σε αποτυχία.
 */
export async function decodeImageWithTimeout(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = src;
    await withTimeout(img.decode(), IMAGE_OP_TIMEOUT_MS);
    return img;
  } catch {
    return null;
  }
}

/** Fetch bytes at `src` (both `fetch` + `.blob()` timeout-guarded). `null` on HTTP error/timeout. */
async function fetchBlobWithTimeout(src: string): Promise<Blob | null> {
  const res = await withTimeout(fetch(src), IMAGE_OP_TIMEOUT_MS);
  if (!res.ok) return null;
  return withTimeout(res.blob(), IMAGE_OP_TIMEOUT_MS);
}

/**
 * Κατέβασμα raster bytes για bundling. `filename` = `images/<sanitized-id>.<ext>` (relative
 * path μέσα στο zip, ΠΑΡΑΓΟΜΕΝΟ από το mime/url). `null` σε αποτυχία (missing/HTTP error/timeout).
 */
export async function fetchRasterWithTimeout(
  src: string, id: string,
): Promise<{ filename: string; artifact: ExportArtifact } | null> {
  try {
    const blob = await fetchBlobWithTimeout(src);
    if (!blob) return null;
    const ext = extFromMime(blob.type) ?? extFromUrl(src) ?? 'png';
    const filename = `images/${sanitizeFilenameId(id)}.${ext}`;
    return { filename, artifact: { filename, blob } };
  } catch {
    return null;
  }
}

/**
 * ADR-679 Φ5.1b — fetch bytes at `src` into an `ExportArtifact` with the GIVEN `filename`.
 * Δίδυμο του `fetchRasterWithTimeout`, αλλά ο caller ΞΕΡΕΙ ήδη το archive-relative path (π.χ.
 * ένα COLLADA `init_from` texture ref `textures/oak.jpg`), ώστε το zip entry να ταιριάζει
 * byte-για-byte με την αναφορά μέσα στο `.dae`. Κοινό `fetchBlobWithTimeout` (μηδέν clone,
 * N.18). `null` σε αποτυχία (missing/HTTP error/timeout).
 */
export async function fetchArtifactWithTimeout(
  src: string, filename: string,
): Promise<ExportArtifact | null> {
  try {
    const blob = await fetchBlobWithTimeout(src);
    return blob ? { filename, blob } : null;
  } catch {
    return null;
  }
}

/**
 * ADR-653 Φ8 — encode ένα offscreen canvas (π.χ. duotone-tinted υλικό) σε PNG raster
 * artifact για bundling. Δίδυμο του `fetchRasterWithTimeout` για πηγές που παράγονται
 * client-side (δεν υπάρχει URL να fetch-άρουμε). `null` σε αποτυχία toBlob/timeout.
 */
export async function canvasToRasterArtifact(
  canvas: HTMLCanvasElement, id: string,
): Promise<{ filename: string; artifact: ExportArtifact } | null> {
  try {
    const blob = await withTimeout(
      new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png')),
      IMAGE_OP_TIMEOUT_MS,
    );
    if (!blob) return null;
    const filename = `images/${sanitizeFilenameId(id)}.png`;
    return { filename, artifact: { filename, blob } };
  } catch {
    return null;
  }
}

/** Filesystem-safe id για όνομα αρχείου μέσα στο zip. */
export function sanitizeFilenameId(id: string): string {
  return id.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'image';
}

/** Επέκταση αρχείου από MIME type (`image/jpeg` → `jpg`). `null` για άγνωστο. */
function extFromMime(mime: string): string | null {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
}

/** Επέκταση από το URL path (`…/albedo.jpg?token` → `jpg`). `null` αν δεν υπάρχει. */
function extFromUrl(src: string): string | null {
  const m = /\.(jpe?g|png|webp)(?:$|[?#])/i.exec(src);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : null;
}

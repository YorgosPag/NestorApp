/**
 * ============================================================================
 * IMAGE-FILL DXF EXPORT — async pre-pass (ADR-643 Φ5b)
 * ============================================================================
 *
 * Το native DXF `HATCH` ΔΕΝ έχει image fill. Απόφαση Giorgio (Q3, ADR-643 §6): ΚΑΙ ΤΑ ΔΥΟ,
 * επιλογή χρήστη τη στιγμή του export:
 *   • 'solid' (default) → υποβάθμιση σε `SOLID` με το **μέσο χρώμα** της εικόνας (reuse
 *     `averageImageColor`) — ασφαλές, πάντα ανοίγει, ελαφρύ single-file.
 *   • 'image'           → **πιστό**: tiled `IMAGE`+`IMAGEDEF` σε πραγματική διάσταση tile,
 *     με το raster bundled σε `.zip` (relative path, AutoCAD eTransmit standard).
 *
 * Αυτό είναι ο **client-side** pre-pass (decode + μέσο χρώμα / tile-grid + fetch raster) που
 * τρέχει ΠΡΙΝ τον pure/sync DXF writer: για κάθε image-fill hatch παράγει είτε ένα solid
 * downgrade entity είτε ένα `dxfImageExport` marker (ίδιο idiom με τα `dxfFaces`/`dxfMlineSource`)
 * + τα raster artifacts για bundling. Ο writer μένει pure — σειριοποιεί ό,τι εδώ προ-υπολογίστηκε.
 *
 * SSoT reuse (μηδέν διπλότυπο, N.12/N.18):
 *   • `averageImageColor`      — offscreen 1×1 μέσο χρώμα (hatch-image-paint).
 *   • `resolveImageFillOrigin` — anchor (phase) του tiling (hatch-image-paint).
 *   • `resolveMaterialImageSrc`— assetId → URL (builtin catalog / user upload).
 *   • `pointInPolygon`         — even-odd PIP culling (polygon-utils, XOR ανά subpath).
 *
 * @module export/core/image-fill-export
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §6
 */

import type { Entity, HatchEntity, HatchImageFill } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { ExportArtifact, DxfImageFillMode } from '../types';
import { averageImageColor, resolveImageFillOrigin } from '../../rendering/entities/shared/hatch-image-paint';
import { resolveMaterialImageSrc } from '../../rendering/entities/shared/material-image-resolver';
import { pointInPolygon } from '../../bim/geometry/shared/polygon-utils';
import { DXF_TIMING } from '../../config/dxf-timing';

/** Μέγιστα `IMAGE` entities ανά hatch (safety)· πάνω από αυτό → solid fallback + warning. */
export const IMAGE_TILE_CAP = 400;
/** Μέγιστα κελιά grid προς σάρωση πριν κηρυχθεί overflow (φθηνό pre-check πριν το PIP loop). */
const IMAGE_GRID_SCAN_CAP = 4000;
/** Fallback συμπαγές χρώμα όταν λείπει άλλη πληροφορία (ουδέτερο γκρι). */
const DEFAULT_SOLID_HEX = '#808080';
/**
 * ADR-643 Φ5b hardening (ADR-644 export-blocker) — μέγιστος χρόνος ανά image op (URL resolve / decode /
 * raster fetch). Ένα ΔΙΑΓΡΑΜΜΕΝΟ υλικό (404) με `crossOrigin='anonymous'` μπορεί να κάνει το
 * `img.decode()` να **μην settle-άρει ποτέ** (γνωστό Chromium gotcha) → πάγωμα ΟΛΟΥ του export. Ο
 * timeout εγγυάται ότι μια εικόνα που λείπει πέφτει στο υπάρχον solid fallback αντί να κολλήσει.
 * SSoT: DXF_TIMING.lifecycle.IMAGE_OP_TIMEOUT (config/dxf-timing.ts, ADR-516 CATEGORY 5).
 */
const IMAGE_OP_TIMEOUT_MS = DXF_TIMING.lifecycle.IMAGE_OP_TIMEOUT;

/**
 * Reject `p` αν δεν settle-άρει εντός `ms`. Το dangling promise (π.χ. ένα `img.decode()` που κρέμεται)
 * αφήνεται — αβλαβές· η επιστροφή απλώς οδηγεί στο solid fallback του καλούντος (try/catch → null).
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('image-fill: op timed out')), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Διαγνωστικοί κωδικοί (ASCII, μη user-facing — δεν περνούν από i18n· surface μόνο για logs). */
export type ImageFillExportWarning =
  | 'image-fill:decode-failed'
  | 'image-fill:raster-fetch-failed'
  | 'image-fill:tile-overflow';

/** Πλέγμα tiles (κάτω-αριστερές γωνίες) που καλύπτουν το boundary + flag overflow. */
export interface ImageTileGrid {
  readonly inserts: Point2D[];
  readonly overflow: boolean;
}

/**
 * Pure: πλέγμα τοποθέτησης tiles σε **πραγματική διάσταση** (Revit/ArchiCAD). Χτίζει local frame
 * στο `origin` (SSoT `resolveImageFillOrigin`) περιστραμμένο κατά `angle`, σαρώνει το bbox του
 * boundary σε δείκτες tile, και κρατά όσα tiles το κέντρο τους είναι ΜΕΣΑ στο boundary (even-odd
 * PIP → νησίδες = τρύπες). Degenerate tile/origin → κενό· grid πάνω από τα caps → `overflow`
 * (ο caller πέφτει σε solid). Χωρίς DOM → unit-testable.
 */
export function buildImageTilePlacements(
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
  imageFill: HatchImageFill,
  cap: number = IMAGE_TILE_CAP,
): ImageTileGrid {
  const tileW = imageFill.tileWidth;
  const tileH = imageFill.tileHeight || imageFill.tileWidth;
  if (!(tileW > 0) || !(tileH > 0)) return { inserts: [], overflow: false };
  const origin = resolveImageFillOrigin(paths, imageFill);
  if (!origin) return { inserts: [], overflow: false };

  const rad = ((imageFill.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const toWorld = (lx: number, ly: number): Point2D => ({
    x: origin.x + lx * cos - ly * sin,
    y: origin.y + lx * sin + ly * cos,
  });

  const range = localTileRange(paths, origin, cos, sin, tileW, tileH);
  if (!range) return { inserts: [], overflow: false };
  const { k0, k1, m0, m1 } = range;
  if ((k1 - k0) * (m1 - m0) > IMAGE_GRID_SCAN_CAP) return { inserts: [], overflow: true };

  const rings = paths.map((p) => p.map((pt) => ({ x: pt.x, y: pt.y, z: 0 })));
  const inside = (w: Point2D): boolean => {
    let c = false;
    for (const r of rings) if (pointInPolygon(w, r)) c = !c;
    return c;
  };

  const inserts: Point2D[] = [];
  for (let k = k0; k < k1; k += 1) {
    for (let m = m0; m < m1; m += 1) {
      if (!inside(toWorld((k + 0.5) * tileW, (m + 0.5) * tileH))) continue;
      inserts.push(toWorld(k * tileW, m * tileH));
      if (inserts.length > cap) return { inserts: [], overflow: true };
    }
  }
  return { inserts, overflow: false };
}

/** Εύρος δεικτών tile (στήλες k, σειρές m) που καλύπτει το boundary στο local (origin+angle) frame. */
function localTileRange(
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
  origin: Point2D, cos: number, sin: number, tileW: number, tileH: number,
): { k0: number; k1: number; m0: number; m1: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of paths) {
    for (const p of path) {
      const dx = p.x - origin.x, dy = p.y - origin.y;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      if (lx < minX) minX = lx;
      if (lx > maxX) maxX = lx;
      if (ly < minY) minY = ly;
      if (ly > maxY) maxY = ly;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return {
    k0: Math.floor(minX / tileW), k1: Math.ceil(maxX / tileW),
    m0: Math.floor(minY / tileH), m1: Math.ceil(maxY / tileH),
  };
}

/** Αποτέλεσμα του async pre-pass: τα (μετασχηματισμένα) entities + raster artifacts + warnings. */
export interface DxfImageFillResolution {
  readonly entities: Entity[];
  readonly rasters: ExportArtifact[];
  readonly warnings: ImageFillExportWarning[];
}

/**
 * Async pre-pass (client): για κάθε `fillType:'image'` hatch παράγει είτε solid downgrade
 * (μέσο χρώμα) είτε `dxfImageExport` marker (image mode) + το raster για bundling. Μη-image
 * entities περνούν αυτούσια. Idempotent-safe: αποτυχία decode/fetch/overflow → ασφαλές solid
 * fallback (πάντα ανοίγει). Τα rasters είναι deduped ανά filename (πολλά hatch ίδιου υλικού
 * μοιράζονται ΕΝΑ αρχείο + ΕΝΑ `IMAGEDEF`).
 */
export async function resolveImageFillsForDxf(
  entities: readonly Entity[],
  mode: DxfImageFillMode,
): Promise<DxfImageFillResolution> {
  const out: Entity[] = [];
  const rasters = new Map<string, ExportArtifact>();
  const warnings: ImageFillExportWarning[] = [];

  for (const e of entities) {
    const hatch = asImageHatch(e);
    if (!hatch) { out.push(e); continue; }
    const fill = hatch.imageFill as HatchImageFill;
    const fallbackHex = hatch.color ?? hatch.fillColor ?? DEFAULT_SOLID_HEX;

    const decoded = await decodeImageForExport(fill.assetId);
    if (!decoded) { out.push(downgradeToSolid(hatch, fallbackHex)); warnings.push('image-fill:decode-failed'); continue; }
    const avgHex = averageImageColorHex(decoded.img) ?? fallbackHex;
    if (mode === 'solid') { out.push(downgradeToSolid(hatch, avgHex)); continue; }

    const grid = buildImageTilePlacements(hatch.boundaryPaths, fill);
    if (grid.overflow || grid.inserts.length === 0) {
      out.push(downgradeToSolid(hatch, avgHex));
      if (grid.overflow) warnings.push('image-fill:tile-overflow');
      continue;
    }
    const raster = await fetchRasterForExport(decoded.src, fill.assetId);
    if (!raster) { out.push(downgradeToSolid(hatch, avgHex)); warnings.push('image-fill:raster-fetch-failed'); continue; }
    if (!rasters.has(raster.filename)) rasters.set(raster.filename, raster.artifact);
    out.push({
      ...hatch,
      dxfImageExport: {
        filename: raster.filename,
        pixelWidth: decoded.img.naturalWidth,
        pixelHeight: decoded.img.naturalHeight,
        tileWorldWidth: fill.tileWidth,
        tileWorldHeight: fill.tileHeight || fill.tileWidth,
        angleDeg: fill.angle ?? 0,
        inserts: grid.inserts,
      },
    } as HatchEntity);
  }

  return { entities: out, rasters: [...rasters.values()], warnings };
}

/** Narrow σε image-fill hatch (fillType==='image' + imageFill)· αλλιώς `null`. */
function asImageHatch(e: Entity): HatchEntity | null {
  if (e.type !== 'hatch') return null;
  const h = e as HatchEntity;
  return h.fillType === 'image' && h.imageFill ? h : null;
}

/** Υποβάθμιση image-fill hatch → συμπαγές (solid) με το δοσμένο hex χρώμα (πάντα ανοίγει). */
function downgradeToSolid(hatch: HatchEntity, hex: string): HatchEntity {
  return { ...hatch, fillType: 'solid', color: hex, fillColor: hex, imageFill: undefined, dxfImageExport: undefined };
}

/** Reuse `averageImageColor` (→ `rgb(r,g,b)`) + μετατροπή σε hex (για το ACI cascade). `null` σε αποτυχία. */
function averageImageColorHex(img: CanvasImageSource): string | null {
  const rgb = averageImageColor(img);
  const m = rgb ? /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb) : null;
  if (!m) return null;
  const toHex = (n: string): string => Number(n).toString(16).padStart(2, '0');
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}

/** One-shot decode για export (crossOrigin ώστε το `averageImageColor`/canvas να μη taint-άρει). `null` σε αποτυχία. */
async function decodeImageForExport(assetId: string): Promise<{ img: HTMLImageElement; src: string } | null> {
  try {
    // ADR-644 export-blocker — timeout κάθε async op· διαγραμμένο υλικό → solid fallback, όχι πάγωμα.
    const src = (await withTimeout(resolveMaterialImageSrc(assetId), IMAGE_OP_TIMEOUT_MS)) ?? assetId;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = src;
    await withTimeout(img.decode(), IMAGE_OP_TIMEOUT_MS);
    return { img, src };
  } catch {
    return null;
  }
}

/** Κατέβασμα raster bytes για bundling. filename = `images/<assetId>.<ext>` (relative στο zip). `null` σε αποτυχία. */
async function fetchRasterForExport(
  src: string, assetId: string,
): Promise<{ filename: string; artifact: ExportArtifact } | null> {
  try {
    // ADR-644 export-blocker — timeout ώστε ένα stalled/missing raster να μην παγώνει το export.
    const res = await withTimeout(fetch(src), IMAGE_OP_TIMEOUT_MS);
    if (!res.ok) return null;
    const blob = await withTimeout(res.blob(), IMAGE_OP_TIMEOUT_MS);
    const ext = extFromMime(blob.type) ?? extFromUrl(src) ?? 'png';
    const filename = `images/${sanitizeAssetId(assetId)}.${ext}`;
    return { filename, artifact: { filename, blob } };
  } catch {
    return null;
  }
}

/** Filesystem-safe asset id για όνομα αρχείου μέσα στο zip. */
function sanitizeAssetId(assetId: string): string {
  return assetId.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'image';
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

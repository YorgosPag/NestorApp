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
// ADR-653 Φ8 — duotone tint + variant key (ίδιος επαναχρωματισμός με την οθόνη → export ταιριάζει).
import { applyDuotoneTint } from '../../rendering/entities/shared/hatch-image-tint';
import { imageFillVariantKey } from '../../rendering/entities/shared/hatch-image-variant-key';
// ADR-653 Φ9 — procedural tile (ίδια γεννήτρια με την οθόνη → πιστό export).
import { renderProceduralTile } from '../../rendering/entities/shared/procedural-tile-render';
import { pointInPolygon } from '../../bim/geometry/shared/polygon-utils';
// ADR-651 Φάση Ε (N.12/N.18) — decode/fetch-with-timeout είναι κοινό με το `image-entity-export.ts`
// pre-pass (ImageEntity)· εξήχθη σε shared module ώστε να μην κλωνοποιηθεί (tile-grid/PIP παραμένουν εδώ).
import { IMAGE_OP_TIMEOUT_MS, withTimeout, decodeImageWithTimeout, fetchRasterWithTimeout, canvasToRasterArtifact } from './image-export-shared';

/** Μέγιστα `IMAGE` entities ανά hatch (safety)· πάνω από αυτό → solid fallback + warning. */
export const IMAGE_TILE_CAP = 400;
/** Μέγιστα κελιά grid προς σάρωση πριν κηρυχθεί overflow (φθηνό pre-check πριν το PIP loop). */
const IMAGE_GRID_SCAN_CAP = 4000;
/** Fallback συμπαγές χρώμα όταν λείπει άλλη πληροφορία (ουδέτερο γκρι). */
const DEFAULT_SOLID_HEX = '#808080';

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

/** Κοινό local frame (origin+angle+toWorld) + tile-index bbox range — SSoT για τα δύο grids. */
interface TileFrame {
  readonly toWorld: (lx: number, ly: number) => Point2D;
  readonly k0: number;
  readonly k1: number;
  readonly m0: number;
  readonly m1: number;
  readonly tileW: number;
  readonly tileH: number;
}

/**
 * Χτίζει το local (rotated) frame στο `origin` (SSoT `resolveImageFillOrigin`) + το tile-index bbox
 * του boundary. `frame:null` σε degenerate tile/origin/range· `overflow` όταν το grid ξεπερνά το scan
 * cap (ο caller πέφτει σε solid). Χωρίς DOM → unit-testable. Κοινό από PIP-culled ΚΑΙ full grid.
 */
function buildTileFrame(
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
  imageFill: HatchImageFill,
): { frame: TileFrame | null; overflow: boolean } {
  const tileW = imageFill.tileWidth;
  const tileH = imageFill.tileHeight || imageFill.tileWidth;
  if (!(tileW > 0) || !(tileH > 0)) return { frame: null, overflow: false };
  const origin = resolveImageFillOrigin(paths, imageFill);
  if (!origin) return { frame: null, overflow: false };

  const rad = ((imageFill.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const toWorld = (lx: number, ly: number): Point2D => ({
    x: origin.x + lx * cos - ly * sin,
    y: origin.y + lx * sin + ly * cos,
  });

  const range = localTileRange(paths, origin, cos, sin, tileW, tileH);
  if (!range) return { frame: null, overflow: false };
  if ((range.k1 - range.k0) * (range.m1 - range.m0) > IMAGE_GRID_SCAN_CAP) {
    return { frame: null, overflow: true };
  }
  return { frame: { toWorld, ...range, tileW, tileH }, overflow: false };
}

/**
 * Σαρώνει το tile-index bbox του `frame`· κρατά όσα tiles `keep(center)` = true (κάτω-αριστερή γωνία
 * ανά κρατημένο). `overflow` όταν ξεπεραστεί το `cap`.
 */
function collectTiles(
  frame: TileFrame, cap: number, keep: (center: Point2D) => boolean,
): ImageTileGrid {
  const { toWorld, k0, k1, m0, m1, tileW, tileH } = frame;
  const inserts: Point2D[] = [];
  for (let k = k0; k < k1; k += 1) {
    for (let m = m0; m < m1; m += 1) {
      if (!keep(toWorld((k + 0.5) * tileW, (m + 0.5) * tileH))) continue;
      inserts.push(toWorld(k * tileW, m * tileH));
      if (inserts.length > cap) return { inserts: [], overflow: true };
    }
  }
  return { inserts, overflow: false };
}

/** Even-odd point-in-polygon predicate πάνω σε ΟΛΑ τα boundary loops (νησίδες = τρύπες). */
function makeInsideBoundary(
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
): (w: Point2D) => boolean {
  const rings = paths.map((p) => p.map((pt) => ({ x: pt.x, y: pt.y, z: 0 })));
  return (w: Point2D): boolean => {
    let c = false;
    for (const r of rings) if (pointInPolygon(w, r)) c = !c;
    return c;
  };
}

/**
 * Pure: πλέγμα τοποθέτησης tiles σε **πραγματική διάσταση** (Revit/ArchiCAD) — κρατά όσα tiles το
 * κέντρο τους είναι ΜΕΣΑ στο boundary (even-odd PIP → νησίδες = τρύπες). Για το **DXF** export, όπου
 * ΔΕΝ υπάρχει clip: τα whole tiles προσεγγίζουν το σχήμα. Degenerate → κενό· grid > cap → `overflow`.
 *
 * ⚠️ **Διβάθμιος φρουρός, ΟΧΙ διπλοτυπία** (ADR-667 Απόφαση 13): `IMAGE_GRID_SCAN_CAP` (4000) =
 * **φθηνό** pre-check στο bbox grid **πριν** το O(n·edges) PIP loop· `cap` (400) = όριο
 * **τοποθετήσεων** **μετά** το culling. Η «ενοποίησή» τους σε έναν cap είναι **DXF regression**
 * (πιστό tiled export → σιωπηλό solid) που τα υπάρχοντα tests **δεν** πιάνουν.
 *
 * ⚠️ **ADR-667 Φ2:** ο τελευταίος καταναλωτής που περνούσε δικό του `cap` (`buildImageTileFullGrid`,
 * για το vector PDF) **έφυγε** — το PDF εκπέμπει πλέον native tiling patterns. Αυτό είναι πλέον
 * **αποκλειστικά DXF** μονοπάτι.
 */
export function buildImageTilePlacements(
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
  imageFill: HatchImageFill,
  cap: number = IMAGE_TILE_CAP,
): ImageTileGrid {
  const { frame, overflow } = buildTileFrame(paths, imageFill);
  if (!frame) return { inserts: [], overflow };
  return collectTiles(frame, cap, makeInsideBoundary(paths));
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

    // ADR-653 — resolve την πηγή εικόνας: procedural (Φ9, γεννημένο canvas) / raster+tint (Φ8) /
    // σκέτο raster (ADR-643). `producedCanvas` ≠ null ⇒ encode το canvas· αλλιώς fetch τα αρχικά bytes.
    const prepared = await prepareExportSource(fill);
    if (!prepared) { out.push(downgradeToSolid(hatch, fallbackHex)); warnings.push('image-fill:decode-failed'); continue; }
    const avgHex = averageImageColorHex(prepared.source) ?? fallbackHex;
    if (mode === 'solid') { out.push(downgradeToSolid(hatch, avgHex)); continue; }

    const grid = buildImageTilePlacements(hatch.boundaryPaths, fill);
    if (grid.overflow || grid.inserts.length === 0) {
      out.push(downgradeToSolid(hatch, avgHex));
      if (grid.overflow) warnings.push('image-fill:tile-overflow');
      continue;
    }
    // Παραγόμενο canvas (procedural/tinted) → encode με variant-keyed filename (μηδέν σύγκρουση
    // με άλλες εκδοχές)· αλλιώς fetch τα raw bytes της αρχικής φωτο (ADR-643 μονοπάτι).
    const raster = prepared.producedCanvas
      ? await canvasToRasterArtifact(prepared.producedCanvas, imageFillVariantKey(fill))
      : await fetchRasterForExport(prepared.originalSrc ?? fill.assetId, fill.assetId);
    if (!raster) { out.push(downgradeToSolid(hatch, avgHex)); warnings.push('image-fill:raster-fetch-failed'); continue; }
    if (!rasters.has(raster.filename)) rasters.set(raster.filename, raster.artifact);
    out.push({
      ...hatch,
      dxfImageExport: {
        filename: raster.filename,
        pixelWidth: prepared.pixelW,
        pixelHeight: prepared.pixelH,
        tileWorldWidth: fill.tileWidth,
        tileWorldHeight: fill.tileHeight || fill.tileWidth,
        angleDeg: fill.angle ?? 0,
        inserts: grid.inserts,
      },
    } as HatchEntity);
  }

  return { entities: out, rasters: [...rasters.values()], warnings };
}

/** Ανάλυση πηγής εικόνας για export: source + intrinsic dims + πώς παίρνουμε το raster. */
export interface PreparedExportSource {
  readonly source: CanvasImageSource;
  readonly pixelW: number;
  readonly pixelH: number;
  /** ≠ null ⇒ encode ΑΥΤΟ το canvas (procedural/tinted)· null ⇒ fetch τα αρχικά bytes. */
  readonly producedCanvas: HTMLCanvasElement | null;
  /** URL της αρχικής φωτο (μόνο raster path)· `null` για procedural. */
  readonly originalSrc: string | null;
}

/**
 * ADR-653 — resolve την πηγή για export: procedural (Φ9, γεννημένο canvas· μηδέν URL/decode),
 * raster+tint (Φ8, duotone canvas) ή σκέτο raster (ADR-643). `null` σε αποτυχία decode/γέννησης
 * (ο caller πέφτει σε solid). Ίδιες γεννήτριες/tint με την οθόνη → πιστό export. Κοινό SSoT με το
 * PDF resolver (`scene-image-resolver.ts`) ώστε DXF & PDF να αποδίδουν το ΙΔΙΟ υλικό (N.18).
 */
export async function prepareExportSource(fill: HatchImageFill): Promise<PreparedExportSource | null> {
  if (fill.procedural) {
    const canvas = renderProceduralTile(fill.procedural, fill.tileWidth, fill.tileHeight || fill.tileWidth);
    if (!canvas) return null;
    return { source: canvas, pixelW: canvas.width, pixelH: canvas.height, producedCanvas: canvas, originalSrc: null };
  }
  const decoded = await decodeImageForExport(fill.assetId);
  if (!decoded) return null;
  const tinted = fill.tint ? applyDuotoneTint(decoded.img, fill.tint) : null;
  return {
    source: tinted ?? decoded.img,
    pixelW: decoded.img.naturalWidth,
    pixelH: decoded.img.naturalHeight,
    producedCanvas: tinted,
    originalSrc: decoded.src,
  };
}

/** Narrow σε image-fill hatch (fillType==='image' + imageFill)· αλλιώς `null`. Κοινό SSoT (N.18). */
export function asImageHatch(e: Entity): HatchEntity | null {
  if (e.type !== 'hatch') return null;
  const h = e as HatchEntity;
  return h.fillType === 'image' && h.imageFill ? h : null;
}

/** Υποβάθμιση image-fill hatch → συμπαγές (solid) με το δοσμένο hex χρώμα (πάντα ανοίγει). */
function downgradeToSolid(hatch: HatchEntity, hex: string): HatchEntity {
  return { ...hatch, fillType: 'solid', color: hex, fillColor: hex, imageFill: undefined, dxfImageExport: undefined };
}

/** Reuse `averageImageColor` (→ `rgb(r,g,b)`) + μετατροπή σε hex (για το ACI cascade). `null` σε αποτυχία. */
export function averageImageColorHex(img: CanvasImageSource): string | null {
  const rgb = averageImageColor(img);
  const m = rgb ? /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb) : null;
  if (!m) return null;
  const toHex = (n: string): string => Number(n).toString(16).padStart(2, '0');
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}

/**
 * One-shot decode για export: πρώτα resolve assetId→URL (asset catalog, hatch-specific), μετά
 * κοινό decode-with-timeout (`image-export-shared`). `null` σε αποτυχία resolve/decode.
 */
async function decodeImageForExport(assetId: string): Promise<{ img: HTMLImageElement; src: string } | null> {
  try {
    // ADR-644 export-blocker — timeout στο resolve· διαγραμμένο υλικό → solid fallback, όχι πάγωμα.
    const src = (await withTimeout(resolveMaterialImageSrc(assetId), IMAGE_OP_TIMEOUT_MS)) ?? assetId;
    const img = await decodeImageWithTimeout(src);
    return img ? { img, src } : null;
  } catch {
    return null;
  }
}

/** Κατέβασμα raster bytes για bundling (κοινό helper — `image-export-shared`). `null` σε αποτυχία. */
async function fetchRasterForExport(
  src: string, assetId: string,
): Promise<{ filename: string; artifact: ExportArtifact } | null> {
  return fetchRasterWithTimeout(src, assetId);
}

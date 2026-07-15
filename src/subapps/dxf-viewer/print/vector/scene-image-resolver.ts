/**
 * ADR-608 (hybrid image compositing) — async image pre-pass για το vector PDF.
 *
 * Ο vector emitter (`scene-vector-emitter.ts`) είναι **σύγχρονος** (draw closure, ADR-040 «βαρύ
 * eager, μόνο jsPDF emission deferred»), ενώ οι εικόνες θέλουν async decode. Αυτός ο pre-pass
 * τρέχει ΠΡΙΝ φτιαχτεί το closure: για κάθε image-fill hatch (`fillType:'image'`) και κάθε
 * `ImageEntity` κατεβάζει/παράγει το raster ΜΙΑ φορά → **PNG data URL** (ο jsPDF `addImage`
 * δέχεται data URL· ίδιο idiom με `decodeStamp`/`capture-2d`) και υπολογίζει τα **world-space
 * placements** (rect κορυφές). Ο sync emitter μετά τα συνθέτει inline (σωστό z-order).
 *
 * Fidelity/SSoT reuse (μηδέν clone, N.12/N.18) — ΙΔΙΕΣ γεννήτριες/tint/tile-grid με την οθόνη:
 *   • `buildImageTilePlacements` — tile-grid + PIP culling (ADR-643, `image-fill-export.ts`).
 *   • `renderProceduralTile` / `applyDuotoneTint` — procedural (Φ9) / duotone (Φ8) υλικά.
 *   • `resolveMaterialImageSrc` + `decodeImageWithTimeout` — assetId→URL + decode-with-timeout.
 *   • `imageFillVariantKey` — dedup alias («τι ζωγραφίζεται», όχι «ποιο αρχείο»).
 *   • `createRectangleVertices` — rotated-rect κορυφές (pivot=corner1, ίδιο με `ImageRenderer`).
 *   • `averageImageColor` — μέσο χρώμα για solid fallback (mirror DXF export).
 *
 * Fallbacks (mirror ADR-643/651 DXF pre-pass): image-fill decode-fail/overflow → **solid
 * downgrade** (μέσο ή hatch χρώμα, ο emitter γεμίζει το boundary)· `ImageEntity` decode-fail →
 * **σιωπηλή παράλειψη** (μια «γυμνή» εικόνα δεν έχει fill-χρώμα να υποβαθμιστεί).
 *
 * @module subapps/dxf-viewer/print/vector/scene-image-resolver
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { Entity, HatchEntity, HatchImageFill } from '../../types/entities';
import type { ImageEntity } from '../../types/image';
import { isImageEntity } from '../../types/image';
import type { Point2D } from '../../rendering/types/Types';
import { buildImageTilePlacements } from '../../export/core/image-fill-export';
import {
  decodeImageWithTimeout, withTimeout, IMAGE_OP_TIMEOUT_MS,
} from '../../export/core/image-export-shared';
import { resolveMaterialImageSrc } from '../../rendering/entities/shared/material-image-resolver';
import { renderProceduralTile } from '../../rendering/entities/shared/procedural-tile-render';
import { applyDuotoneTint } from '../../rendering/entities/shared/hatch-image-tint';
import { imageFillVariantKey } from '../../rendering/entities/shared/hatch-image-variant-key';
import { averageImageColor } from '../../rendering/entities/shared/hatch-image-paint';
import { createRectangleVertices } from '../../rendering/entities/shared/geometry-utils';

/** Ουδέτερο γκρι όταν λείπει κάθε άλλη πληροφορία χρώματος. */
const DEFAULT_SOLID_HEX = '#808080';

/** Ένα rect placement σε **world** συντεταγμένες (ο emitter το mappάρει σε paper mm). */
export interface ResolvedImagePlacement {
  /** Κάτω-αριστερή γωνία (world). */
  readonly bl: Point2D;
  /** Κάτω-δεξιά γωνία (world). */
  readonly br: Point2D;
  /** Πάνω-αριστερή γωνία (world). */
  readonly tl: Point2D;
  /** Πλάτος/ύψος σε world units (τοπικό frame — για το `addImage` w/h μετά το scale). */
  readonly wWorld: number;
  readonly hWorld: number;
}

/** Μία resolved εικόνα: ΕΝΑ data URL + alias (dedup) + Ν placements (tiles ή ένα). */
export interface ResolvedSceneImage {
  readonly dataUrl: string;
  /** Σταθερό κλειδί ώστε ο jsPDF να ενσωματώσει τα bytes ΜΙΑ φορά (N tiles → 1 embed). */
  readonly alias: string;
  readonly placements: readonly ResolvedImagePlacement[];
}

/** Αποτέλεσμα του pre-pass: resolved εικόνες + solid fallbacks (ανά entity id) + warnings. */
export interface SceneImageResolution {
  /** entity id → resolved raster (image-fill hatch tiles ή ImageEntity). */
  readonly images: ReadonlyMap<string, ResolvedSceneImage>;
  /** entity id → hex, για image-fill hatch που υποβαθμίστηκε σε solid (decode-fail/overflow). */
  readonly solidFallbacks: ReadonlyMap<string, string>;
  /** Διαγνωστικοί κωδικοί (ASCII, logs only — δεν περνούν i18n). */
  readonly warnings: string[];
}

/**
 * Async pre-pass: walk τα (flattened) entities και resolve κάθε εικόνα σε data URL + placements.
 * Σειριακό await (mirror DXF pre-pass) — μηδέν παραλληλισμός για απλότητα/σταθερότητα. Μη-image
 * entities αγνοούνται (δεν μπαίνουν σε κανένα map). Idempotent-safe: αποτυχία → solid ή skip.
 */
export async function resolveSceneImages(
  entities: readonly Entity[],
): Promise<SceneImageResolution> {
  const images = new Map<string, ResolvedSceneImage>();
  const solidFallbacks = new Map<string, string>();
  const warnings: string[] = [];

  for (const e of entities) {
    if (isImageEntity(e)) {
      await resolveImageEntity(e, images, warnings);
      continue;
    }
    const hatch = asImageHatch(e);
    if (hatch) await resolveImageFillHatch(hatch, images, solidFallbacks, warnings);
  }

  return { images, solidFallbacks, warnings };
}

// ─── ImageEntity («γυμνή» εικόνα: δέντρα / ταπετσαρίες) ────────────────────────

/** Decode + placement ΕΝΟΣ `ImageEntity` (γεμίζει ΟΛΟ το πλαίσιο — mirror `ImageRenderer`). */
async function resolveImageEntity(
  e: ImageEntity, out: Map<string, ResolvedSceneImage>, warnings: string[],
): Promise<void> {
  if (!(e.width > 0) || !(e.height > 0)) return;
  const img = await decodeImageWithTimeout(e.url);
  if (!img) { warnings.push('image-entity:decode-failed'); return; }
  const dataUrl = sourceToPngDataUrl(img, img.naturalWidth, img.naturalHeight);
  if (!dataUrl) { warnings.push('image-entity:encode-failed'); return; }
  out.set(e.id, {
    dataUrl,
    alias: e.url,
    placements: [rectPlacement(e.position, e.width, e.height, e.rotation ?? 0)],
  });
}

// ─── image-fill hatch (επιφάνειες με γέμισμα «Εικόνα») ─────────────────────────

/** Resolve ΕΝΟΣ image-fill hatch → tiled placements ή solid fallback. */
async function resolveImageFillHatch(
  hatch: HatchEntity,
  out: Map<string, ResolvedSceneImage>,
  solids: Map<string, string>,
  warnings: string[],
): Promise<void> {
  const fill = hatch.imageFill as HatchImageFill;
  const prepared = await prepareFillSource(fill);
  if (!prepared) { solids.set(hatch.id, fallbackHex(hatch)); warnings.push('image-fill:decode-failed'); return; }

  const grid = buildImageTilePlacements(hatch.boundaryPaths, fill);
  if (grid.overflow || grid.inserts.length === 0) {
    solids.set(hatch.id, averageHex(prepared.source) ?? fallbackHex(hatch));
    if (grid.overflow) warnings.push('image-fill:tile-overflow');
    return;
  }

  const dataUrl = sourceToPngDataUrl(prepared.source, prepared.pixelW, prepared.pixelH);
  if (!dataUrl) {
    solids.set(hatch.id, averageHex(prepared.source) ?? fallbackHex(hatch));
    warnings.push('image-fill:encode-failed');
    return;
  }
  const tileW = fill.tileWidth;
  const tileH = fill.tileHeight || fill.tileWidth;
  const angle = fill.angle ?? 0;
  out.set(hatch.id, {
    dataUrl,
    alias: imageFillVariantKey(fill),
    placements: grid.inserts.map((insert) => rectPlacement(insert, tileW, tileH, angle)),
  });
}

/** Πηγή για το tile: procedural (γεννημένο canvas) / duotone-tinted / σκέτο decoded raster. */
async function prepareFillSource(
  fill: HatchImageFill,
): Promise<{ source: CanvasImageSource; pixelW: number; pixelH: number } | null> {
  if (fill.procedural) {
    const c = renderProceduralTile(fill.procedural, fill.tileWidth, fill.tileHeight || fill.tileWidth);
    return c ? { source: c, pixelW: c.width, pixelH: c.height } : null;
  }
  const img = await decodeFillImage(fill.assetId);
  if (!img) return null;
  const tinted = fill.tint ? applyDuotoneTint(img, fill.tint) : null;
  return { source: tinted ?? img, pixelW: img.naturalWidth, pixelH: img.naturalHeight };
}

/** assetId → URL (asset catalog / user upload) → decode-with-timeout. `null` σε αποτυχία. */
async function decodeFillImage(assetId: string): Promise<HTMLImageElement | null> {
  try {
    const src = (await withTimeout(resolveMaterialImageSrc(assetId), IMAGE_OP_TIMEOUT_MS)) ?? assetId;
    return await decodeImageWithTimeout(src);
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rect placement από κάτω-αριστερή γωνία + διαστάσεις + γωνία (pivot=corner1, ίδιο SSoT). */
function rectPlacement(bl: Point2D, w: number, h: number, angleDeg: number): ResolvedImagePlacement {
  const corners = createRectangleVertices(bl, { x: bl.x + w, y: bl.y + h }, angleDeg);
  // createRectangleVertices → [BL, BR, TR, TL]
  return { bl: corners[0], br: corners[1], tl: corners[3], wWorld: w, hWorld: h };
}

/** Narrow σε image-fill hatch (`type:'hatch'` + `fillType:'image'` + `imageFill`)· αλλιώς `null`. */
function asImageHatch(e: Entity): HatchEntity | null {
  if (e.type !== 'hatch') return null;
  const h = e as HatchEntity;
  return h.fillType === 'image' && h.imageFill ? h : null;
}

/** Solid-fallback χρώμα ενός hatch όταν λείπει decoded source (hatch χρώμα ή ουδέτερο). */
function fallbackHex(hatch: HatchEntity): string {
  return hatch.color ?? hatch.fillColor ?? DEFAULT_SOLID_HEX;
}

/** Μέσο χρώμα εικόνας → hex (reuse `averageImageColor` → `rgb(...)`). `null` σε αποτυχία/taint. */
function averageHex(source: CanvasImageSource): string | null {
  const rgb = averageImageColor(source);
  const m = rgb ? /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb) : null;
  if (!m) return null;
  const toHex = (n: string): string => Number(n).toString(16).padStart(2, '0');
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}

/**
 * `CanvasImageSource` → PNG data URL (ο jsPDF `addImage` το ενσωματώνει, με alias μία φορά).
 * Canvas → απευθείας `toDataURL`· `<img>`/bitmap → draw σε offscreen canvas πρώτα. `null` σε
 * cross-origin taint (χωρίς CORS) ή απουσία 2D context — ίδιο μονοπάτι αποτυχίας με `capture-2d`.
 */
function sourceToPngDataUrl(source: CanvasImageSource, w: number, h: number): string | null {
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    try { return source.toDataURL('image/png'); } catch { return null; }
  }
  if (!(w > 0) || !(h > 0)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  try { return canvas.toDataURL('image/png'); } catch { return null; }
}

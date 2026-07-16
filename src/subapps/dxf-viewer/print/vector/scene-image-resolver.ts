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
// SSoT reuse (N.18) — το tile grid, η ανάλυση πηγής (procedural/tint/raster) και το μέσο-χρώμα-hex
// ΕΙΝΑΙ τα ίδια με το DXF image-fill export· τα εισάγουμε αντί να τα κλωνοποιήσουμε.
import {
  buildImageTileFullGrid, prepareExportSource, averageImageColorHex, asImageHatch,
} from '../../export/core/image-fill-export';
import { decodeImageWithTimeout } from '../../export/core/image-export-shared';
import { imageFillVariantKey } from '../../rendering/entities/shared/hatch-image-variant-key';
import { createRectangleVertices } from '../../rendering/entities/shared/geometry-utils';

/** Ουδέτερο γκρι όταν λείπει κάθε άλλη πληροφορία χρώματος. */
const DEFAULT_SOLID_HEX = '#808080';
/**
 * Cap tiles για το clipped PDF full grid. Ψηλότερο από το DXF default (400) γιατί το full grid
 * καλύπτει ΟΛΟ το bbox (και τα οριακά) και το clip τα κόβει — θέλουμε να μη πέφτουμε σε solid για
 * μεγάλες textured επιφάνειες. Φράχτης ώστε το content-stream να μη φουσκώνει ανεξέλεγκτα.
 */
const PDF_TILE_CAP = 4000;

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
  // Κοινή ανάλυση πηγής με το DXF export (procedural/tint/raster) — ίδιο υλικό, ίδια απόδοση.
  const prepared = await prepareExportSource(fill);
  if (!prepared) { solids.set(hatch.id, fallbackHex(hatch)); warnings.push('image-fill:decode-failed'); return; }

  // Full grid (ΧΩΡΙΣ PIP) — το clip στον emitter κόβει τα οριακά tiles στο boundary (μηδέν κενά).
  const grid = buildImageTileFullGrid(hatch.boundaryPaths, fill, PDF_TILE_CAP);
  if (grid.overflow || grid.inserts.length === 0) {
    solids.set(hatch.id, averageImageColorHex(prepared.source) ?? fallbackHex(hatch));
    if (grid.overflow) warnings.push('image-fill:tile-overflow');
    return;
  }

  const dataUrl = sourceToPngDataUrl(prepared.source, prepared.pixelW, prepared.pixelH);
  if (!dataUrl) {
    solids.set(hatch.id, averageImageColorHex(prepared.source) ?? fallbackHex(hatch));
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rect placement από κάτω-αριστερή γωνία + διαστάσεις + γωνία (pivot=corner1, ίδιο SSoT). */
function rectPlacement(bl: Point2D, w: number, h: number, angleDeg: number): ResolvedImagePlacement {
  const corners = createRectangleVertices(bl, { x: bl.x + w, y: bl.y + h }, angleDeg);
  // createRectangleVertices → [BL, BR, TR, TL]
  return { bl: corners[0], br: corners[1], tl: corners[3], wWorld: w, hWorld: h };
}

/** Solid-fallback χρώμα ενός hatch όταν λείπει decoded source (hatch χρώμα ή ουδέτερο). */
function fallbackHex(hatch: HatchEntity): string {
  return hatch.color ?? hatch.fillColor ?? DEFAULT_SOLID_HEX;
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

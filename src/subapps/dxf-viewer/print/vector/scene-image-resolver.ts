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
 * **ADR-667 Φ2 — το «πλακάκι» πέθανε.** Μια γραμμοσκίαση με γέμισμα «Εικόνα»/«Διαδικαστικά» δεν
 * παράγει πλέον **N raster tiles** (που πάνω από cap υποβαθμίζονταν **σιωπηλά** σε συμπαγές γκρι),
 * αλλά **ΕΝΑ κελί** ({@link ResolvedPatternCell}) που ο emitter το εκπέμπει ως **native PDF Tiling
 * Pattern**. Το κόστος γίνεται **σταθερό ως προς το εμβαδόν** ⇒ ο `PDF_TILE_CAP` δεν έχει πια λόγο
 * ύπαρξης. Οι `ImageEntity` («γυμνές» εικόνες) μένουν στο μονοπάτι placement — δεν είναι μοτίβα.
 *
 * Fidelity/SSoT reuse (μηδέν clone, N.12/N.18) — ΙΔΙΕΣ γεννήτριες/tint/anchor με την οθόνη:
 *   • `resolveImageFillOrigin` — anchor (phase) του tiling· **ίδιο SSoT με την οθόνη** (ADR-643).
 *   • `renderProceduralTile` / `applyDuotoneTint` — procedural (Φ9) / duotone (Φ8) υλικά.
 *   • `resolveMaterialImageSrc` + `decodeImageWithTimeout` — assetId→URL + decode-with-timeout.
 *   • `imageFillVariantKey` — ταυτότητα υλικού («τι ζωγραφίζεται», όχι «ποιο αρχείο»).
 *   • `createRectangleVertices` — rotated-rect κορυφές (pivot=corner1, ίδιο με `ImageRenderer`).
 *   • `averageImageColor` — μέσο χρώμα για solid fallback (mirror DXF export).
 *
 * Fallbacks (mirror ADR-643/651 DXF pre-pass): image-fill decode-fail/εκφυλισμένο κελί → **solid
 * downgrade** (μέσο ή hatch χρώμα, ο emitter γεμίζει το boundary) **+ warning** ⇒ ο χρήστης το
 * μαθαίνει (Φ1)· `ImageEntity` decode-fail → **σιωπηλή παράλειψη** (μια «γυμνή» εικόνα δεν έχει
 * fill-χρώμα να υποβαθμιστεί).
 *
 * @module subapps/dxf-viewer/print/vector/scene-image-resolver
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { Entity, HatchEntity, HatchImageFill } from '../../types/entities';
import type { ImageEntity } from '../../types/image';
import { isImageEntity } from '../../types/image';
import type { Point2D } from '../../rendering/types/Types';
// SSoT reuse (N.18) — η ανάλυση πηγής (procedural/tint/raster) και το μέσο-χρώμα-hex ΕΙΝΑΙ τα ίδια
// με το DXF image-fill export· τα εισάγουμε αντί να τα κλωνοποιήσουμε.
import {
  prepareExportSource, averageImageColorHex, asImageHatch,
} from '../../export/core/image-fill-export';
import { decodeImageWithTimeout } from '../../export/core/image-export-shared';
import { imageFillVariantKey } from '../../rendering/entities/shared/hatch-image-variant-key';
// ADR-643 SSoT — το anchor (phase) του tiling ΕΙΝΑΙ αυτό που χρησιμοποιεί η οθόνη· μηδέν δεύτερη math.
import { resolveImageFillOrigin } from '../../rendering/entities/shared/hatch-image-paint';
import { createRectangleVertices } from '../../rendering/entities/shared/geometry-utils';
import { MAX_PDF_PATTERNS_PER_PAGE } from './pdf-tiling-pattern';

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

/** Μία resolved «γυμνή» εικόνα (`ImageEntity`): ΕΝΑ data URL + alias (dedup) + το placement της. */
export interface ResolvedSceneImage {
  readonly dataUrl: string;
  /** Σταθερό κλειδί ώστε ο jsPDF να ενσωματώσει τα bytes ΜΙΑ φορά (N placements → 1 embed). */
  readonly alias: string;
  readonly placements: readonly ResolvedImagePlacement[];
}

/**
 * ADR-667 Φ2 — **ΕΝΑ κελί μοτίβου** για μια γραμμοσκίαση με γέμισμα «Εικόνα»/«Διαδικαστικά».
 * Ο emitter το μεταφράζει σε native PDF Tiling Pattern: το κελί ορίζεται μία φορά και ο viewer
 * το επαναλαμβάνει ⇒ **μηδέν εξάρτηση από το εμβαδόν** (τέλος στο συμπαγές γκρι).
 */
export interface ResolvedPatternCell {
  /** Το raster **ενός** κελιού (PNG data URL). */
  readonly dataUrl: string;
  /** Ταυτότητα υλικού (`imageFillVariantKey`) — `addImage` alias ⇒ τα bytes μπαίνουν ΜΙΑ φορά. */
  readonly alias: string;
  /**
   * Διαστάσεις κελιού σε **μονάδες σχεδίου** (world). Ο emitter τις κλιμακώνει σε paper mm.
   *
   * ⚠️ **Περιορισμός (ρητός, όχι ψημένο αξίωμα):** το `tileWidth/tileHeight` του `HatchImageFill`
   * τεκμηριώνεται ως mm ενώ καταναλώνεται ως **world units** — ισοδύναμα **μόνο** αν
   * 1 world unit == 1 mm. **Η οθόνη έχει την ΙΔΙΑ παραδοχή** (`hatch-image-paint.ts:63-64`)
   * ⇒ preview === commit, **καμία** regression· η άρση της παραδοχής ανήκει στο ADR-643.
   */
  readonly tileWWorld: number;
  readonly tileHWorld: number;
  /** Γωνία μοτίβου, **visual clockwise** — σύμβαση **οθόνης** (ADR-667 Απόφαση 12). */
  readonly angleDeg: number;
  /** Σημείο αγκύρωσης (phase) σε **world** — SSoT `resolveImageFillOrigin`, ίδιο με την οθόνη. */
  readonly anchorWorld: Point2D;
}

/** Αποτέλεσμα του pre-pass: κελιά μοτίβου + resolved εικόνες + solid fallbacks + warnings. */
export interface SceneImageResolution {
  /** entity id → resolved raster. **Μόνο** `ImageEntity` (τα hatch πάνε από `patternCells`). */
  readonly images: ReadonlyMap<string, ResolvedSceneImage>;
  /** hatch id → κελί μοτίβου (ADR-667 Φ2). */
  readonly patternCells: ReadonlyMap<string, ResolvedPatternCell>;
  /** entity id → hex, για image-fill hatch που υποβαθμίστηκε σε solid (decode-fail/cap/εκφυλισμό). */
  readonly solidFallbacks: ReadonlyMap<string, string>;
  /** Διαγνωστικοί κωδικοί (ASCII, logs only — δεν περνούν i18n). */
  readonly warnings: string[];
}

/** Μεταβλητή κατάσταση του pre-pass — ένα αντικείμενο αντί για 4 παράλληλες παραμέτρους. */
interface ResolveSink {
  readonly images: Map<string, ResolvedSceneImage>;
  readonly patternCells: Map<string, ResolvedPatternCell>;
  readonly solidFallbacks: Map<string, string>;
  readonly warnings: string[];
}

/**
 * Async pre-pass: walk τα (flattened) entities και resolve κάθε εικόνα. Σειριακό await (mirror DXF
 * pre-pass) — μηδέν παραλληλισμός για απλότητα/σταθερότητα. Μη-image entities αγνοούνται (δεν
 * μπαίνουν σε κανένα map). Idempotent-safe: αποτυχία → solid ή skip, **πάντα με warning**.
 */
export async function resolveSceneImages(
  entities: readonly Entity[],
): Promise<SceneImageResolution> {
  const sink: ResolveSink = {
    images: new Map(), patternCells: new Map(), solidFallbacks: new Map(), warnings: [],
  };

  for (const e of entities) {
    if (isImageEntity(e)) {
      await resolveImageEntity(e, sink.images, sink.warnings);
      continue;
    }
    const hatch = asImageHatch(e);
    if (hatch) await resolveImageFillHatch(hatch, sink);
  }

  return sink;
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

/**
 * Resolve ΕΝΟΣ image-fill hatch → **κελί μοτίβου** (ADR-667 Φ2) ή solid fallback + warning.
 *
 * ⚠️ **Γιατί ο cap κρίνεται ΕΔΩ και όχι στο `draw`:** το `capture.fidelity` το διαβάζει ο
 * `runPrint` **ΑΦΟΥ** επιστρέψει το capture και **ΠΡΙΝ** τρέξει το `draw` closure ⇒ ό,τι
 * αποφασιστεί μέσα στο `draw` **δεν μπορεί ποτέ να αναφερθεί**. Το pre-pass δεν είναι στυλιστική
 * προτίμηση — είναι η **μόνη** θέση όπου υποβάθμιση **και** ειδοποίηση λειτουργούν μαζί.
 */
async function resolveImageFillHatch(hatch: HatchEntity, sink: ResolveSink): Promise<void> {
  const fill = hatch.imageFill as HatchImageFill;
  // Κοινή ανάλυση πηγής με το DXF export (procedural/tint/raster) — ίδιο υλικό, ίδια απόδοση.
  const prepared = await prepareExportSource(fill);
  if (!prepared) {
    downgrade(sink, hatch, fallbackHex(hatch), 'image-fill:decode-failed');
    return;
  }
  const avgHex = averageImageColorHex(prepared.source) ?? fallbackHex(hatch);

  // Ο cap είναι **φράχτης, όχι λειτουργικό όριο**: η πραγματική περίπτωση είναι 1 pattern. Κάθε
  // hatch γεμίζει ΜΙΑ φορά ⇒ το πλήθος των κελιών φράσσει άνω το πλήθος των patterns της σελίδας.
  if (sink.patternCells.size >= MAX_PDF_PATTERNS_PER_PAGE) {
    downgrade(sink, hatch, avgHex, 'image-fill:pattern-cap');
    return;
  }

  const tileWWorld = fill.tileWidth;
  const tileHWorld = fill.tileHeight || fill.tileWidth;
  const anchorWorld = resolveImageFillOrigin(hatch.boundaryPaths, fill);
  if (!(tileWWorld > 0) || !(tileHWorld > 0) || !anchorWorld) {
    downgrade(sink, hatch, avgHex, 'image-fill:degenerate-cell');
    return;
  }

  const dataUrl = sourceToPngDataUrl(prepared.source, prepared.pixelW, prepared.pixelH);
  if (!dataUrl) {
    downgrade(sink, hatch, avgHex, 'image-fill:encode-failed');
    return;
  }
  sink.patternCells.set(hatch.id, {
    dataUrl,
    alias: imageFillVariantKey(fill),
    tileWWorld,
    tileHWorld,
    angleDeg: fill.angle ?? 0,
    anchorWorld,
  });
}

/** Υποβάθμιση σε συμπαγές + **ορατή** σημείωση (μηδέν σιωπηλή αλλοίωση — ADR-667 Απόφαση 11). */
function downgrade(sink: ResolveSink, hatch: HatchEntity, hex: string, code: string): void {
  sink.solidFallbacks.set(hatch.id, hex);
  sink.warnings.push(code);
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

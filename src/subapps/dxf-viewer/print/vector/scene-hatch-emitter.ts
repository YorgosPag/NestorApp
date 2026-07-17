/**
 * ADR-667 — εκπομπή **γραμμοσκίασης** στο vector PDF (η σειρά dispatch είναι ΝΟΜΟΣ).
 *
 * Αδερφάκι του `scene-image-emitter`: ο `scene-vector-emitter` κάνει dispatch εδώ κάθε
 * `HatchEntity`. Όλη η βαριά **απόφαση** («τι ζωγραφίζεται;») έχει ήδη παρθεί στα async/sync
 * pre-passes (`scene-image-resolver` = raster κελιά · `scene-hatch-line-resolver` = γραμμές
 * μοτίβου, budget-guarded) — εδώ γίνεται **μόνο** σύνθεση, μηδέν υπολογισμός.
 *
 * @module subapps/dxf-viewer/print/vector/scene-hatch-emitter
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 * @see rendering/entities/HatchRenderer.ts — **ο στόχος πιστότητας** (το κάτοπτρο της οθόνης)
 */

import type { jsPDF } from 'jspdf';
import type { HatchEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { parseHex, type Rgb } from '../../config/color-math';
// ADR-667 Απόφαση 5 — dispatch #2. Χειρίζεται `fillType === undefined` μέσω `patternType`/
// `patternName` (οι παραγωγοί `dxfFaces` ΔΕΝ θέτουν `fillType`) → μηδέν δεύτερη «είναι solid;» math.
import { isSolidHatch } from '../../bim/hatch/hatch-properties';
import type { ResolvedPatternCell } from './scene-image-resolver';
import type { ResolvedStripeFill } from './scene-hatch-line-resolver';
// ADR-667 Φ3.1 — η ΙΔΙΑ διαφάνεια tint που χρησιμοποιεί η οθόνη (SSoT). Σκέτο `0.45` εδώ θα
// περνούσε το jscpd πράσινο (N.18: δεν πιάνει σκέτο literal) και θα ξέφευγε τη μέρα που κάποιος
// θα άλλαζε τη μία μόνο πλευρά.
import { HATCH_COLLAPSE_ALPHA } from '../../rendering/entities/shared/hatch-density-lod';
import { resolveHatchFillHex, resolveHatchFillRgb } from './hatch-fill-style';
import {
  createPdfPatternRegistry, type PdfPatternCell, type PdfPatternRegistry,
} from './pdf-tiling-pattern';
import type { SceneVectorEmitParams } from './scene-vector-types';
import { fillPolygon, polylineDeltas, strokePolyline, strokeSegment } from './scene-vector-paths';

const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/**
 * ADR-667 Φ3 — αγκύρωση (φάση) του screen-space ριγέ μοτίβου. **Κάτοπτρο της οθόνης**, που
 * αγκυρώνει στο `worldToScreen({x:0, y:0})` (`HatchRenderer.ts:170`) ⇒ ίδια φάση σε οθόνη & χαρτί.
 */
const STRIPE_ANCHOR_WORLD: Point2D = { x: 0, y: 0 };

/**
 * ADR-667 Απόφαση 10 — **ΟΛΑ** τα κελιά μοτίβου ορίζονται **ΕΔΩ**: ένα `advancedAPI()` block στην
 * **αρχή** του `draw()`, πριν εκπεμφθεί η πρώτη οντότητα. Τα specs είναι **ήδη resolved** από τα
 * pre-passes ⇒ **τίποτα δεν επιβάλλει lazy ορισμό**.
 *
 * 🔴 **Γιατί όχι lazy:** το `beginTilingPattern` κάνει `beginNewRenderTarget`· **μόνο** το
 * `endTilingPattern` κάνει pop. Ορισμός στη μέση της εκπομπής ⇒ αν κάτι σκάσει, το υπόλοιπο
 * περιεχόμενο της σελίδας γράφεται **μέσα στο pattern** ⇒ **λευκή σελίδα, κανένα σφάλμα**.
 */
export function definePatterns(pdf: jsPDF, params: SceneVectorEmitParams): PdfPatternRegistry {
  const registry = createPdfPatternRegistry(pdf);
  // Φ2 — raster κελιά («Εικόνα»/«Διαδικαστικά»).
  for (const cell of params.images.patternCells.values()) {
    registry.register(toPdfPatternCell(cell, params.worldToPaperScale));
  }
  // Φ3 — ριγέ κελιά (`patternSpace:'screen'`). Το registry κάνει dedup ανά χρώμα από μόνο του.
  for (const stripe of params.hatchLines.stripeFills.values()) registry.register(stripe.cell);
  registry.defineAll();
  return registry;
}

/**
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΝΟΜΟΣ, ΟΧΙ ΓΟΥΣΤΟ** (ADR-667 Απόφαση 5). Το `fillType` είναι **optional** και
 * **οι δύο πραγματικοί παραγωγοί `dxfFaces` ΔΕΝ το θέτουν** (`neutral-primitive-factory.ts`,
 * `overlay-dxf-collector.ts` → μόνο `patternType:'solid'`). Ένα `switch (fillType)` θα τα έριχνε
 * στο `default` ⇒ **κάθε structural/poché solid fill θα γινόταν άδειο περίγραμμα**.
 *
 * Το **outline είναι ΔΑΠΕΔΟ, όχι κλάδος** (Απόφαση 8): καμία διαδρομή δεν καταλήγει σε «τίποτα».
 */
export function emitHatch(
  pdf: jsPDF, e: HatchEntity, params: SceneVectorEmitParams, toPaper: (p: Point2D) => Point2D,
  patterns: PdfPatternRegistry,
): void {
  // 1. ADR-505 §C — pre-computed faces (SOLID / poché). **ΚΕΡΔΙΖΕΙ ΤΑ ΠΑΝΤΑ**: είναι η σημερινή
  //    συμπεριφορά και είναι load-bearing.
  const faces = (e as { dxfFaces?: ReadonlyArray<ReadonlyArray<Point2D>> }).dxfFaces;
  if (faces) {
    for (const f of faces) if (f.length >= 3) fillPolygon(pdf, f, toPaper);
    return;
  }
  // 2. Συμπαγής γραμμοσκίαση → γέμισμα. Κάτοπτρο `HatchRenderer.ts:225` (`fillColor ?? color`).
  if (isSolidHatch(e)) {
    fillHatchLoops(pdf, e, resolveHatchFillHex(e, params.colorPolicy), toPaper);
    return;
  }
  // 3. ADR-667 Φ3 — «Background color» (AutoCAD DXF 63): γεμίζει την περιοχή **ΠΙΣΩ** από τις
  //    γραμμές μοτίβου. ΔΕΝ κάνει return — είναι υπόστρωμα, όχι κλάδος.
  emitHatchBackground(pdf, e, toPaper);
  // 4. ADR-667 Φ2 — γέμισμα «Εικόνα»/«Διαδικαστικά» → **native tiling pattern** (μηδέν πλακάκια).
  const cell = params.images.patternCells.get(e.id);
  if (cell && fillHatchWithPattern(pdf, e, cell, params, toPaper, patterns)) return;
  // 4b. Solid downgrade από το pre-pass (decode-fail / cap / εκφυλισμό) — **αναφερμένο**, όχι σιωπηλό.
  const solidHex = params.images.solidFallbacks.get(e.id);
  if (solidHex) { fillHatchLoops(pdf, e, solidHex, toPaper); return; }

  // 5/7. ADR-667 Φ3 — οι γραμμές μοτίβου, **προ-resolved** (budget-guarded) στο pre-pass.
  //      (6. `gradient` → ⏳ Φ4: πέφτει στο ΔΑΠΕΔΟ περίγραμμα, όπως και σήμερα.)
  const stripe = params.hatchLines.stripeFills.get(e.id);
  if (stripe) {
    // 5. `patternSpace:'screen'` — ριγέ tiling pattern. Αστοχία ⇒ μένει το ΔΑΠΕΔΟ (Απόφαση 8).
    fillHatchWithStripe(pdf, e, stripe, toPaper, patterns);
  } else if (params.hatchLines.collapsedFills.has(e.id)) {
    // 6b. ADR-667 Φ3.1 — πολύ πυκνό για το χαρτί → tint. **Κάτοπτρο της οθόνης**: ο density-LOD
    //     κάθεται στην ΙΔΙΑ θέση της αλυσίδας (`HatchRenderer`: μετά το screen-space μοτίβο, πριν
    //     το `drawPatternSegments`) ⇒ ίδια σειρά, ίδιο αποτέλεσμα, δύο κλίμακες.
    fillCollapsedTint(pdf, e, params, toPaper);
  } else {
    // 7. `predefined` / `user-defined` → πραγματικά διανύσματα (ό,τι κάνει το AutoCAD PDF export).
    strokeHatchSegments(pdf, e, params, toPaper);
  }

  // ΔΑΠΕΔΟ — boundary outline. **Πάντα** (Απόφαση 8: καμία διαδρομή δεν καταλήγει σε «τίποτα»),
  // και κάτοπτρο της οθόνης, που ζωγραφίζει το περίγραμμα σε **κάθε** κλάδο (`HatchRenderer.ts:246-250`)
  // ⇒ ένα hatch χωρίς γραμμές (catalog MISS / πάνω από budget / gradient) τυπώνει ό,τι και σήμερα.
  emitBoundaryOutline(pdf, e, toPaper);
}

/**
 * ADR-667 Φ3 — υπόστρωμα «Background color» (κάτοπτρο `HatchRenderer.ts:215-218`). Ο Τέκτων δίνει
 * λευκό `raster_bgcolor` ⇒ λευκό φόντο + πράσινες γραμμές.
 *
 * ⚠️ **ΧΩΡΙΣ `applyPlotColor` — ΣΚΟΠΙΜΟ, όχι παράλειψη.** Το white-safe policy χαρτογραφεί το
 * κοντά-στο-λευκό σε **ΜΑΥΡΟ** (`print-color-policy.ts:88`), γιατί λευκό **μελάνι** είναι αόρατο
 * σε λευκό χαρτί. Ένα **φόντο** όμως δεν είναι μελάνι: το λευκό `raster_bgcolor` του Τέκτονα θα
 * γινόταν **μαύρο ορθογώνιο που κρύβει όλο το σχέδιο**. Το raster μονοπάτι εκπέμπει κι αυτό το
 * `backgroundColor` **αυτούσιο** (το policy εφαρμόζεται μόνο σε `entity.color` —
 * `dxf-renderer-style-resolve.ts:109,147`) ⇒ έτσι vector και raster μένουν ταυτόσημα.
 *
 * Το solid κερδίζει **πριν** φτάσουμε εδώ (κλάδος 2) ⇒ ο έλεγχος `isSolidHatch` της οθόνης
 * περισσεύει· `image`/`gradient` γεμίζουν πλήρως και θα έκρυβαν το υπόστρωμα.
 */
function emitHatchBackground(
  pdf: jsPDF, e: HatchEntity, toPaper: (p: Point2D) => Point2D,
): void {
  if (!e.backgroundColor || e.fillType === 'gradient' || e.fillType === 'image') return;
  fillHatchLoops(pdf, e, e.backgroundColor, toPaper);
}

/**
 * ADR-667 Φ3 — screen-space μοτίβο → **ριγέ tiling pattern**. Το κελί ορίστηκε ήδη στην **αρχή**
 * του `draw` (Απόφαση 10)· εδώ μπαίνει μόνο η **τοποθέτηση**.
 */
function fillHatchWithStripe(
  pdf: jsPDF, e: HatchEntity, stripe: ResolvedStripeFill, toPaper: (p: Point2D) => Point2D,
  patterns: PdfPatternRegistry,
): void {
  if (!buildHatchFillPath(pdf, e, toPaper)) return;
  patterns.fillCurrentPath(stripe.cell, {
    anchorMm: toPaper(STRIPE_ANCHOR_WORLD),
    angleDeg: stripe.angleDeg,
  });
}

/**
 * ADR-667 Φ3.1 — **collapsed tint**: το κάτοπτρο χαρτιού του `fillBoundary(paths, color,
 * HATCH_COLLAPSE_ALPHA)` της οθόνης (`HatchRenderer`). Η **απόφαση** («είναι πολύ πυκνό;») πάρθηκε
 * ήδη στο pre-pass — εδώ γίνεται **μόνο** η σύνθεση.
 *
 * ⚠️ **Το `GState` είναι ΚΑΘΟΛΙΚΗ κατάσταση του PDF, όχι παράμετρος του γεμίσματος.** Χωρίς την
 * επαναφορά στο `finally`, **κάθε επόμενη οντότητα της σελίδας** θα γραφόταν στο 45% — σιωπηλά,
 * χωρίς σφάλμα. Το `finally` είναι **υποχρεωτικό**, όχι ευπρέπεια (ίδιο σκεπτικό με το
 * `endTilingPattern`, Απόφαση 10).
 *
 * Το alpha συνθέτει πάνω σε **ό,τι υπάρχει από κάτω** — ακριβώς όπως το `globalAlpha` της οθόνης
 * συνθέτει πάνω στο `backgroundColor` υπόστρωμα (κλάδος 3, που έχει **ήδη** εκπεμφθεί) ⇒ μηδέν
 * παραδοχή «λευκό χαρτί», μηδέν προ-ανάμειξη χρωμάτων.
 */
function fillCollapsedTint(
  pdf: jsPDF, e: HatchEntity, params: SceneVectorEmitParams, toPaper: (p: Point2D) => Point2D,
): void {
  pdf.setGState(pdf.GState({ opacity: HATCH_COLLAPSE_ALPHA }));
  try {
    fillHatchLoops(pdf, e, resolveHatchFillHex(e, params.colorPolicy), toPaper);
  } finally {
    pdf.setGState(pdf.GState({ opacity: 1 }));
  }
}

/**
 * ADR-667 Φ3 — οι γραμμές μοτίβου ως **πραγματικά διανύσματα** (Απόφαση 7). Οι γραμμές είναι
 * **προ-υπολογισμένες** στο pre-pass: εδώ γίνεται μόνο world→paper + stroke.
 *
 * Το χρώμα είναι της **γραμμοσκίασης** (`fillColor ?? color`), όχι της οντότητας — κάτοπτρο του
 * `drawPatternSegments` της οθόνης. Το πάχος το έχει ήδη θέσει το `applyEntityStyle` από το
 * `lineweightMm` (AutoCAD LWT), όπως και σε κάθε άλλη γραμμή του σχεδίου.
 */
function strokeHatchSegments(
  pdf: jsPDF, e: HatchEntity, params: SceneVectorEmitParams, toPaper: (p: Point2D) => Point2D,
): void {
  const segments = params.hatchLines.segments.get(e.id);
  if (!segments?.length) return;
  const rgb = resolveHatchFillRgb(e, params.colorPolicy);
  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
  for (const seg of segments) strokeSegment(pdf, seg.start, seg.end, toPaper);
}

/**
 * ADR-667 Φ2 — γεμίζει το boundary με **ένα** native PDF Tiling Pattern. `false` ⇒ ο caller πέφτει
 * σε fallback (Απόφαση 8).
 */
function fillHatchWithPattern(
  pdf: jsPDF, e: HatchEntity, cell: ResolvedPatternCell, params: SceneVectorEmitParams,
  toPaper: (p: Point2D) => Point2D, patterns: PdfPatternRegistry,
): boolean {
  if (!buildHatchFillPath(pdf, e, toPaper)) return false;
  return patterns.fillCurrentPath(toPdfPatternCell(cell, params.worldToPaperScale), {
    anchorMm: toPaper(cell.anchorWorld),
    angleDeg: cell.angleDeg,
  });
}

/**
 * Χτίζει το **current path** των boundary loops **χωρίς** να το βάψει, ώστε ένα `fillEvenOdd` να
 * το γεμίσει με μοτίβο (raster **ή** ριγέ — ένας κώδικας, δύο είδη κελιού).
 *
 * Το `style === null` είναι **υποχρεωτικό**: αλλιώς ο jsPDF κάνει stroke το ίδιο το path.
 * Even-odd ⇒ **νησίδες = τρύπες**, ίδια σημασιολογία με τον on-screen `ctx.fill('evenodd')`.
 * Το ίδιο το pattern κόβεται στο path ⇒ **μηδέν clip, μηδέν οδοντωτή σκάλα**.
 */
function buildHatchFillPath(
  pdf: jsPDF, e: HatchEntity, toPaper: (p: Point2D) => Point2D,
): boolean {
  let hasPath = false;
  for (const loop of e.boundaryPaths ?? []) {
    const deltas = loop.length >= 3 ? polylineDeltas(loop, toPaper) : null;
    if (!deltas) continue;
    pdf.lines(deltas.segments, deltas.x0, deltas.y0, [1, 1], null, true);
    hasPath = true;
  }
  return hasPath;
}

/**
 * Κελί σε **world** → κελί σε **paper mm**. Η αναλογία ζει **στο κελί**, το `/Matrix` μένει
 * ομοιόμορφο (Απόφαση 9): ένα scalar `cellPaperMm` θα έριχνε το `tileHeight` ⇒ τούβλο/σανίδα με
 * **λάθος αναλογία**.
 */
function toPdfPatternCell(cell: ResolvedPatternCell, worldToPaperScale: number): PdfPatternCell {
  return {
    kind: 'raster',
    materialKey: cell.alias,
    dataUrl: cell.dataUrl,
    cellWMm: cell.tileWWorld * worldToPaperScale,
    cellHMm: cell.tileHWorld * worldToPaperScale,
  };
}

/** Γεμίζει τα boundary loops με το δοσμένο hex (κάθε loop χωριστά — ίδιο με το σημερινό solid). */
function fillHatchLoops(
  pdf: jsPDF, e: HatchEntity, hex: string, toPaper: (p: Point2D) => Point2D,
): void {
  const rgb = parseHex(hex) ?? BLACK;
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  for (const loop of e.boundaryPaths ?? []) {
    if (loop.length >= 3) fillPolygon(pdf, loop, toPaper);
  }
}

/** ΔΑΠΕΔΟ (Απόφαση 8) — stroke τα boundary loops ώστε καμία γραμμοσκίαση να μη χαθεί εντελώς. */
function emitBoundaryOutline(
  pdf: jsPDF, e: HatchEntity, toPaper: (p: Point2D) => Point2D,
): void {
  for (const loop of e.boundaryPaths ?? []) {
    if (loop.length >= 2) strokePolyline(pdf, loop, true, toPaper);
  }
}

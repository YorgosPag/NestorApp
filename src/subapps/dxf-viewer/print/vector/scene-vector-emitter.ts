/**
 * ADR-608 — Vector-PDF scene emitter (SSoT for print + export vector output).
 *
 * Walks the SAME flattened primitive `Entity[]` the client-side DXF writer consumes
 * (`export/core/bim-to-dxf-primitives.ts flattenSceneEntitiesForDxf` → line/arc/
 * polyline/text/hatch/dimension; BIM already decomposed to `lwpolyline`) and emits
 * NATIVE jsPDF vector primitives instead of `ctx.*` (raster) or DXF group codes.
 * This keeps the DXF and PDF exports in lockstep — one flatten, two backends
 * (Revit "export what you draw").
 *
 * Coordinates: the caller injects a pure `toPaper(worldPoint) → {x,y}` (jsPDF mm,
 * Y-down, already placed inside the printable area) plus `worldToPaperScale`
 * (mm per world unit, for radii / text height). No screen transform is reused
 * (`worldToScreen` bakes in ruler margins + Y-down screen space — wrong for paper).
 *
 * Colour/lineweight reuse the raster path's SSoT (`applyPlotColor`) so vector and
 * raster output are visually identical; lineweight is emitted in mm directly
 * (`pdf.setLineWidth`) → resolution-independent (better than the raster DPI fold).
 *
 * @see export/core/bim-to-dxf-primitives.ts — the shared flatten (input contract)
 * @see export/core/dxf-ascii-writer.ts — the sibling backend (same input, DXF out)
 * @see config/print-color-policy.ts — `applyPlotColor` (white-safe / mono / grayscale)
 * @see rendering/entities/shared/geometry-arc-utils.ts — `tessellateArcDegrees` (arc SSoT)
 * @see systems/dimensions/dim-block-primitives.ts — dimension decomposition SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { jsPDF } from 'jspdf';
import type { Entity, HatchEntity, TextEntity } from '../../types/entities';
import type { VectorTextBaselineHint } from '../../export/core/annotation-to-primitives';
import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import { applyPlotColor, type PrintColorPolicy } from '../../config/print-color-policy';
import { parseHex, type Rgb } from '../../config/color-math';
import { tessellateArcDegrees } from '../../rendering/entities/shared/geometry-arc-utils';
import { rectangleEntityVertices } from '../../rendering/entities/shared/geometry-utils';
import {
  buildDimensionBlockPrimitives,
  type DimBlockPrimitive,
} from '../../systems/dimensions/dim-block-primitives';
import type { DimensionLookup } from '../../systems/dimensions/dim-geometry-builder';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
// ADR-667 Απόφαση 5 — dispatch #2. Χειρίζεται `fillType === undefined` μέσω `patternType`/
// `patternName` (οι παραγωγοί `dxfFaces` ΔΕΝ θέτουν `fillType`) → μηδέν δεύτερη «είναι solid;» math.
import { isSolidHatch } from '../../bim/hatch/hatch-properties';
import type { ResolvedPatternCell, SceneImageResolution } from './scene-image-resolver';
import { emitResolvedImage } from './scene-image-emitter';
import {
  createPdfPatternRegistry, type PdfPatternCell, type PdfPatternRegistry,
} from './pdf-tiling-pattern';

/** mm → typographic points (jsPDF `setFontSize` unit). 1pt = 1/72 in = 25.4/72 mm. */
const PT_PER_MM = 72 / 25.4;
/** One tessellation vertex per this many degrees of arc sweep (mirror DXF writer). */
const ARC_SEGMENT_DEG = 12;
/** Fallback plotted line width (mm) when the entity carries no lineweight. */
const DEFAULT_LINEWIDTH_MM = 0.18;
/** Fallback text height (world units) when a text entity omits its height. */
const DEFAULT_TEXT_HEIGHT_WORLD = 2.5;
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** World→paper projection: `toPaper` maps a world point to placed jsPDF mm (Y-down). */
export interface SceneVectorEmitParams {
  /** Flattened + colour-stamped primitives (output of `flattenSceneEntitiesForDxf`). */
  readonly entities: readonly Entity[];
  /** Pure world→paper-mm mapper (Y-down, already offset into the printable rect). */
  readonly toPaper: (p: Point2D) => Point2D;
  /** Uniform mm-per-world-unit factor (radii + text height). */
  readonly worldToPaperScale: number;
  /** Active plot-style policy (white-safe / mono / grayscale) — same SSoT as raster. */
  readonly colorPolicy: PrintColorPolicy;
  /**
   * ADR-608 hybrid — προ-resolved raster εικόνες (image-fill hatch tiles + `ImageEntity`),
   * κλειδωμένες ανά entity id από το async `scene-image-resolver`. Ο emitter τις συνθέτει
   * inline (array-order → σωστό z-order με τις γραμμές). Κενό map → μόνο vector (ως πριν).
   */
  readonly images: SceneImageResolution;
}

/**
 * Emit every flattened entity into `pdf` as vector primitives. Pure over `pdf`
 * (mutates draw state + appends paths); returns nothing. Unknown types are skipped.
 */
export function emitSceneToPdf(pdf: jsPDF, params: SceneVectorEmitParams): void {
  // Round cap + round join so stroked corners/junctions close cleanly. With the
  // jsPDF defaults (butt cap, miter join) abutting segments leave a triangular
  // notch at every corner, glaring at high zoom (mirrors AutoCAD/Revit PDF export).
  pdf.setLineCap('round');
  pdf.setLineJoin('round');
  const dimLookup = buildDimensionLookup(params.entities);
  const patterns = definePatterns(pdf, params);
  for (const e of params.entities) emitEntity(pdf, e, params, dimLookup, patterns);
}

/**
 * ADR-667 Απόφαση 10 — **ΟΛΑ** τα κελιά μοτίβου ορίζονται **ΕΔΩ**: ένα `advancedAPI()` block στην
 * **αρχή** του `draw()`, πριν εκπεμφθεί η πρώτη οντότητα. Τα specs είναι **ήδη resolved** από το
 * async pre-pass ⇒ **τίποτα δεν επιβάλλει lazy ορισμό**.
 *
 * 🔴 **Γιατί όχι lazy:** το `beginTilingPattern` κάνει `beginNewRenderTarget`· **μόνο** το
 * `endTilingPattern` κάνει pop. Ορισμός στη μέση της εκπομπής ⇒ αν κάτι σκάσει, το υπόλοιπο
 * περιεχόμενο της σελίδας γράφεται **μέσα στο pattern** ⇒ **λευκή σελίδα, κανένα σφάλμα**.
 */
function definePatterns(pdf: jsPDF, params: SceneVectorEmitParams): PdfPatternRegistry {
  const registry = createPdfPatternRegistry(pdf);
  for (const cell of params.images.patternCells.values()) {
    registry.register(toPdfPatternCell(cell, params.worldToPaperScale));
  }
  registry.defineAll();
  return registry;
}

// ─── Per-entity dispatch ──────────────────────────────────────────────────────

function emitEntity(
  pdf: jsPDF, e: Entity, params: SceneVectorEmitParams, dimLookup: DimensionLookup,
  patterns: PdfPatternRegistry,
): void {
  const { toPaper, worldToPaperScale: scale, colorPolicy } = params;
  applyEntityStyle(pdf, e, colorPolicy);

  switch (e.type) {
    case 'line':
      strokeSegment(pdf, e.start, e.end, toPaper);
      return;
    case 'circle': {
      const c = toPaper(e.center);
      pdf.circle(c.x, c.y, e.radius * scale, 'S');
      return;
    }
    case 'arc':
      strokePolyline(pdf, arcVertices(e), false, toPaper);
      return;
    case 'rectangle':
    case 'rect':
      // rotated-rectangle entity-level SSoT: χειρίζεται corner1/corner2 (drawn rects — x/y/w/h undefined)
      // ΚΑΙ x/y/w/h ΚΑΙ rotation (pivot=corner1). Πριν: raw rectVertices(e.x,...) → NaN για drawn + αγνόει rotation.
      strokePolyline(pdf, rectangleEntityVertices(e), true, toPaper);
      return;
    case 'polyline':
    case 'lwpolyline':
      strokePolyline(pdf, e.vertices, e.closed ?? false, toPaper);
      return;
    case 'text':
    case 'mtext':
      emitText(pdf, e, toPaper, scale);
      return;
    case 'hatch':
      emitHatch(pdf, e as HatchEntity, params, toPaper, patterns);
      return;
    case 'image': {
      // ADR-608 hybrid — «γυμνή» εικόνα (δέντρα / ταπετσαρίες): προ-resolved στο pre-pass.
      const resolved = params.images.images.get(e.id);
      if (resolved) emitResolvedImage(pdf, resolved, toPaper);
      return;
    }
    case 'dimension':
      emitDimension(pdf, e as unknown as DimensionEntity, toPaper, scale, dimLookup);
      return;
    default:
      return; // point / spline / xline / ray / unsupported → skip (raster fallback covers)
  }
}

// ─── Style (colour + lineweight) ──────────────────────────────────────────────

function applyEntityStyle(pdf: jsPDF, e: Entity, policy: PrintColorPolicy): void {
  const hex = applyPlotColor(e.color ?? null, e.colorAci ?? null, policy);
  const rgb = parseHex(hex) ?? BLACK;
  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.setLineWidth(resolveLineWidthMm(e));
}

/** Entity lineweight in mm (annotative, resolution-independent) or a thin default. */
function resolveLineWidthMm(e: Entity): number {
  const mm = (e as { lineweightMm?: number }).lineweightMm;
  return mm != null && mm > 0 ? mm : DEFAULT_LINEWIDTH_MM;
}

// ─── Text (native jsPDF, selectable) ──────────────────────────────────────────

function emitText(
  pdf: jsPDF, e: Entity, toPaper: (p: Point2D) => Point2D, scale: number,
): void {
  const t = projectSceneTextToDxf(e as unknown as TextSceneShape, (e as { id?: string }).id ?? '');
  if (!t.text) return;
  const p = toPaper(t.position);
  const heightWorld = t.height || DEFAULT_TEXT_HEIGHT_WORLD;
  pdf.setFontSize(heightWorld * scale * PT_PER_MM);
  // A decomposed annotation label is marked by the `vBaseline` hint and its
  // `position` IS the alignment anchor → honour `alignment` + baseline (centred
  // glyph letters / scale-bar numerals land on their anchor). Scene text carries
  // no hint → keep the exact previous behaviour (left / alphabetic), so imported
  // text whose insertion-point semantics we don't own is never mis-placed.
  const baseline = (e as VectorTextBaselineHint).vBaseline;
  const align = baseline !== undefined ? mapHAlign((e as TextEntity).alignment) : 'left';
  // World rotation is CCW in a Y-up frame; on the Y-down page it reads as CW → negate.
  pdf.text(sanitizeText(t.text), p.x, p.y, {
    align, baseline: baseline ?? 'alphabetic', angle: -(t.rotation ?? 0),
  });
}

/** Horizontal alignment (`TextEntity.alignment`) → jsPDF text align. Default left. */
function mapHAlign(alignment: TextEntity['alignment']): 'left' | 'center' | 'right' {
  return alignment === 'center' ? 'center' : alignment === 'right' ? 'right' : 'left';
}

// ─── Hatch (ADR-667 Απόφαση 5 — η σειρά dispatch είναι ΝΟΜΟΣ) ─────────────────

/**
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΝΟΜΟΣ, ΟΧΙ ΓΟΥΣΤΟ** (ADR-667 Απόφαση 5). Το `fillType` είναι **optional** και
 * **οι δύο πραγματικοί παραγωγοί `dxfFaces` ΔΕΝ το θέτουν** (`neutral-primitive-factory.ts`,
 * `overlay-dxf-collector.ts` → μόνο `patternType:'solid'`). Ένα `switch (fillType)` θα τα έριχνε
 * στο `default` ⇒ **κάθε structural/poché solid fill θα γινόταν άδειο περίγραμμα**.
 *
 * Το **outline είναι ΔΑΠΕΔΟ, όχι κλάδος** (Απόφαση 8): καμία διαδρομή δεν καταλήγει σε «τίποτα».
 */
function emitHatch(
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
  // 3. ADR-667 Φ2 — γέμισμα «Εικόνα»/«Διαδικαστικά» → **native tiling pattern** (μηδέν πλακάκια).
  const cell = params.images.patternCells.get(e.id);
  if (cell && fillHatchWithPattern(pdf, e, cell, params, toPaper, patterns)) return;
  // 4. Solid downgrade από το pre-pass (decode-fail / cap / εκφυλισμό) — **αναφερμένο**, όχι σιωπηλό.
  const solidHex = params.images.solidFallbacks.get(e.id);
  if (solidHex) { fillHatchLoops(pdf, e, solidHex, toPaper); return; }

  // ΔΑΠΕΔΟ — boundary outline. (Γραμμές μοτίβου `predefined`/`user-defined` + `patternSpace:'screen'`
  // + `gradient`: ⏳ Φ3/Φ4. Μέχρι τότε το περίγραμμα είναι ό,τι τυπώνεται ήδη σήμερα.)
  emitBoundaryOutline(pdf, e, toPaper);
}

/**
 * ADR-667 Φ2 — γεμίζει το boundary με **ένα** native PDF Tiling Pattern. `false` ⇒ ο caller πέφτει
 * σε fallback (Απόφαση 8).
 *
 * Το path χτίζεται με `style === null` (**υποχρεωτικό** — αλλιώς ο jsPDF κάνει stroke) και το
 * `fillEvenOdd` το βάφει: even-odd ⇒ **νησίδες = τρύπες**, ίδια σημασιολογία με τον on-screen
 * `ctx.fill('evenodd')`. Το ίδιο το pattern κόβεται στο path ⇒ **μηδέν clip, μηδέν οδοντωτή σκάλα**.
 */
function fillHatchWithPattern(
  pdf: jsPDF, e: HatchEntity, cell: ResolvedPatternCell, params: SceneVectorEmitParams,
  toPaper: (p: Point2D) => Point2D, patterns: PdfPatternRegistry,
): boolean {
  let hasPath = false;
  for (const loop of e.boundaryPaths ?? []) {
    const deltas = loop.length >= 3 ? polylineDeltas(loop, toPaper) : null;
    if (!deltas) continue;
    pdf.lines(deltas.segments, deltas.x0, deltas.y0, [1, 1], null, true);
    hasPath = true;
  }
  if (!hasPath) return false;
  return patterns.fillCurrentPath(toPdfPatternCell(cell, params.worldToPaperScale), {
    anchorMm: toPaper(cell.anchorWorld),
    angleDeg: cell.angleDeg,
  });
}

/**
 * Κελί σε **world** → κελί σε **paper mm**. Η αναλογία ζει **στο κελί**, το `/Matrix` μένει
 * ομοιόμορφο (Απόφαση 9): ένα scalar `cellPaperMm` θα έριχνε το `tileHeight` ⇒ τούβλο/σανίδα με
 * **λάθος αναλογία**.
 */
function toPdfPatternCell(cell: ResolvedPatternCell, worldToPaperScale: number): PdfPatternCell {
  return {
    materialKey: cell.alias,
    dataUrl: cell.dataUrl,
    cellWMm: cell.tileWWorld * worldToPaperScale,
    cellHMm: cell.tileHWorld * worldToPaperScale,
  };
}

/**
 * Χρώμα γεμίσματος γραμμοσκίασης — κάτοπτρο του screen SSoT (`HatchRenderer.ts:203`:
 * `hatch.fillColor ?? entity.color`), περασμένο από το ΙΔΙΟ plot-style policy με τα υπόλοιπα
 * (mono/grayscale/white-safe) ⇒ vector και raster έξοδος μένουν οπτικά ταυτόσημες.
 */
function resolveHatchFillHex(e: HatchEntity, policy: PrintColorPolicy): string {
  return applyPlotColor(e.fillColor ?? e.color ?? null, e.colorAci ?? null, policy);
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

// ─── Dimension (decompose via the on-screen block SSoT) ───────────────────────

function emitDimension(
  pdf: jsPDF, dim: DimensionEntity, toPaper: (p: Point2D) => Point2D, scale: number,
  lookup: DimensionLookup,
): void {
  const style = getDimStyleRegistry().getStyle(dim.styleId);
  if (!style) return;
  let primitives: DimBlockPrimitive[];
  try {
    primitives = buildDimensionBlockPrimitives(dim, style, lookup);
  } catch {
    return; // degenerate / unresolved chain → skip (mirror dxf-ascii-writer)
  }
  for (const prim of primitives) emitDimPrimitive(pdf, prim, toPaper, scale);
}

function emitDimPrimitive(
  pdf: jsPDF, prim: DimBlockPrimitive, toPaper: (p: Point2D) => Point2D, scale: number,
): void {
  switch (prim.kind) {
    case 'line':
      strokeSegment(pdf, prim.a, prim.b, toPaper);
      return;
    case 'arc':
      strokePolyline(pdf, tessellate(prim.center, prim.radius, prim.startDeg, prim.endDeg), false, toPaper);
      return;
    case 'circle': {
      const c = toPaper(prim.center);
      pdf.circle(c.x, c.y, prim.radius * scale, 'S');
      return;
    }
    case 'fill':
      if (prim.points.length >= 3) fillPolygon(pdf, prim.points, toPaper);
      return;
    case 'text': {
      const p = toPaper(prim.position);
      pdf.setFontSize(prim.heightWorld * scale * PT_PER_MM);
      pdf.text(sanitizeText(prim.text), p.x, p.y, {
        align: 'center', baseline: 'middle', angle: -(prim.rotationDeg ?? 0),
      });
      return;
    }
  }
}

// ─── Shared stroke / fill helpers ─────────────────────────────────────────────

function strokeSegment(
  pdf: jsPDF, a: Point2D, b: Point2D, toPaper: (p: Point2D) => Point2D,
): void {
  const pa = toPaper(a);
  const pb = toPaper(b);
  pdf.line(pa.x, pa.y, pb.x, pb.y);
}

/** Stroke a world-space polyline via relative `pdf.lines` deltas (optionally closed). */
function strokePolyline(
  pdf: jsPDF, verts: readonly Point2D[], closed: boolean, toPaper: (p: Point2D) => Point2D,
): void {
  const deltas = polylineDeltas(verts, toPaper);
  if (!deltas) return;
  pdf.lines(deltas.segments, deltas.x0, deltas.y0, [1, 1], 'S', closed);
}

/** Fill a world-space polygon (closed) via `pdf.lines` with the 'F' style. */
function fillPolygon(
  pdf: jsPDF, verts: readonly Point2D[], toPaper: (p: Point2D) => Point2D,
): void {
  const deltas = polylineDeltas(verts, toPaper);
  if (!deltas) return;
  pdf.lines(deltas.segments, deltas.x0, deltas.y0, [1, 1], 'F', true);
}

interface PolylineDeltas {
  readonly x0: number;
  readonly y0: number;
  readonly segments: number[][];
}

/** Map world vertices → paper, then to `pdf.lines` relative segments. `null` if <2 pts. */
function polylineDeltas(
  verts: readonly Point2D[], toPaper: (p: Point2D) => Point2D,
): PolylineDeltas | null {
  if (verts.length < 2) return null;
  const first = toPaper(verts[0]);
  const segments: number[][] = [];
  let prev = first;
  for (let i = 1; i < verts.length; i += 1) {
    const cur = toPaper(verts[i]);
    segments.push([cur.x - prev.x, cur.y - prev.y]);
    prev = cur;
  }
  return { x0: first.x, y0: first.y, segments };
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Arc entity → world-space vertices along its visible sweep (reuse the arc SSoT). */
function arcVertices(e: {
  center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean;
}): Point2D[] {
  return tessellate(e.center, e.radius, e.startAngle, e.endAngle, e.counterclockwise);
}

/** Tessellate an arc (degrees) into `steps+1` points via the `tessellateArcDegrees` SSoT. */
function tessellate(
  center: Point2D, radius: number, startDeg = 0, endDeg = 0, counterclockwise?: boolean,
): Point2D[] {
  let sweep = endDeg - startDeg;
  while (sweep <= 0) sweep += 360;
  const steps = Math.max(2, Math.ceil(sweep / ARC_SEGMENT_DEG));
  return tessellateArcDegrees({ center, radius, startAngle: startDeg, endAngle: endDeg, counterclockwise }, steps);
}

/** Build a `DimensionLookup` over the flattened dimension entities (chain resolution). */
function buildDimensionLookup(entities: readonly Entity[]): DimensionLookup {
  const byId = new Map<string, DimensionEntity>();
  for (const e of entities) {
    if (e.type === 'dimension') byId.set(e.id, e as unknown as DimensionEntity);
  }
  return (id: string) => byId.get(id);
}

/** Collapse newlines so multi-line strings stay on one PDF text run (v1). */
function sanitizeText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}

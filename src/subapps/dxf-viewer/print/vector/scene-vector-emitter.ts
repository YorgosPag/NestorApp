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

import type { jsPDF, Matrix } from 'jspdf';
import type { Entity, HatchEntity, TextEntity } from '../../types/entities';
import type { VectorTextBaselineHint } from '../../export/core/annotation-to-primitives';
import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import { applyPlotColor, type PlotColorRole, type PrintColorPolicy } from '../../config/print-color-policy';
import { parseHex, type Rgb } from '../../config/color-math';
// ADR-739 Φ.Ε/Φ2 βήμα 4 — η ΜΙΑ γωνία κλίσης (ISO 3098), κοινή με το `obliqueAngle` του DXF.
import { TEXT_OBLIQUE_ITALIC_DEG } from '../../config/text-rendering-config';
import { tessellateArcDegrees } from '../../rendering/entities/shared/geometry-arc-utils';
import { rectangleEntityVertices } from '../../rendering/entities/shared/geometry-utils';
import {
  buildDimensionBlockPrimitives,
  type DimBlockPrimitive,
} from '../../systems/dimensions/dim-block-primitives';
import type { DimensionLookup } from '../../systems/dimensions/dim-geometry-builder';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
import { entityAlignmentToAnchor } from '../../text-engine/fonts/text-horizontal-anchor';
import { emitResolvedImage } from './scene-image-emitter';
// ADR-667 — όλη η γραμμοσκίαση (η **κλειδωμένη** σειρά dispatch + ο ορισμός των κελιών μοτίβου)
// ζει στο sibling module, όπως και οι εικόνες στο `scene-image-emitter`.
import { definePatterns, emitHatch } from './scene-hatch-emitter';
import type { PdfPatternRegistry } from './pdf-tiling-pattern';
import type { SceneVectorEmitParams } from './scene-vector-types';
import { fillPolygon, strokePolyline, strokeSegment } from './scene-vector-paths';

export type { SceneVectorEmitParams };

/** mm → typographic points (jsPDF `setFontSize` unit). 1pt = 1/72 in = 25.4/72 mm. */
const PT_PER_MM = 72 / 25.4;
/** One tessellation vertex per this many degrees of arc sweep (mirror DXF writer). */
const ARC_SEGMENT_DEG = 12;
/** Fallback plotted line width (mm) when the entity carries no lineweight. */
const DEFAULT_LINEWIDTH_MM = 0.18;
/** Fallback text height (world units) when a text entity omits its height. */
const DEFAULT_TEXT_HEIGHT_WORLD = 2.5;
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

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

/**
 * 🔴 ADR-739 Φ.Ε/Φ1 — ο ρόλος **`'fill'`** για τη γραμμοσκίαση δεν είναι λεπτομέρεια στιλ.
 *
 * Ο κλάδος 1 του `emitHatch` (προ-υπολογισμένα `dxfFaces` — SOLID / poché / **γέμισμα κελιού
 * πίνακα**) γεμίζει με το χρώμα που θέτει **αυτή εδώ** η συνάρτηση. Με ρόλο `'ink'` το
 * `#EDEDED` μιας γκρίζας γραμμής κεφαλίδας περνούσε το κατώφλι «κοντά στο λευκό» (237 ≥ 234,6)
 * και τυπωνόταν **συμπαγές μαύρο**, καταπίνοντας τα ίδια του τα γράμματα. Δες
 * {@link PlotColorRole}.
 */
function applyEntityStyle(pdf: jsPDF, e: Entity, policy: PrintColorPolicy): void {
  const role: PlotColorRole = e.type === 'hatch' ? 'fill' : 'ink';
  const hex = applyPlotColor(e.color ?? null, e.colorAci ?? null, policy, role);
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

/**
 * 🔴 ADR-739 Φ.Ε/Φ1 — **γιατί ΣΥΝΘΕΤΙΚΟ έντονο και όχι `setFont(…, 'bold')`.**
 *
 * Το `registerGreekFont` (`services/pdf/greek-font-loader.ts`) δηλώνει **και** το `'normal'`
 * **και** το `'bold'` style πάνω στο **ΙΔΙΟ** `Roboto-Regular.ttf` — ρητά, με σχόλιο: η
 * δεύτερη δήλωση υπάρχει μόνο για να μη γυρίσει το `jspdf-autotable` σε Helvetica και
 * αχρηστεύσει το Identity-H (και μαζί τα ελληνικά). Άρα ένα `setFont('Roboto', 'bold')`
 * επιλέγει **το ίδιο αρχείο γραμματοσειράς** και δεν παχαίνει ούτε ένα pixel: το έντονο του
 * πίνακα θα «δούλευε» χωρίς να φαίνεται — η χειρότερη κατηγορία σφάλματος.
 *
 * Οι δύο πραγματικές επιλογές ήταν: (α) ενσωμάτωση του Roboto-Bold — **+~700KB σε κάθε
 * τυπωμένη σελίδα**, για μια γραμμή κεφαλίδας· (β) συνθετικό πάχυνση με περίγραμμα, που
 * είναι ο **καθιερωμένος** μηχανισμός των μηχανών απόδοσης (PDF `Tr 2` = fill-then-stroke·
 * το ίδιο κάνουν οι browsers για synthetic bold). Το (β) δίνει έντονο σε **κάθε**
 * γραμματοσειρά, ελληνική ή λατινική, με μηδέν byte.
 *
 * Ο συντελεστής **3% του ύψους** είναι η συνήθης τιμή για faux-bold: αρκετά για να διαβαστεί
 * ως έντονο, αρκετά λίγο ώστε να μη γεμίσουν τα μετρίως κλειστά γράμματα (α, ε, θ) σε μικρά
 * ύψη κειμένου πίνακα (2,6–3mm).
 */
const SYNTHETIC_BOLD_STROKE_RATIO = 0.03;

/**
 * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **τα πλάγια στο PDF: ίδιο δομικό αδιέξοδο, ίδια θεραπεία.**
 *
 * Ο `registerGreekFont` δηλώνει **όλα** τα ύφη πάνω στο ίδιο `Roboto-Regular.ttf` (ώστε το
 * `jspdf-autotable` να μη γυρίσει σε Helvetica), οπότε ένα `setFont(…, 'italic')` **δεν
 * γέρνει τίποτα** — ακριβώς ό,τι συνέβαινε με το έντονο (§28.9.4). Η θεραπεία είναι επίσης
 * η ίδια: **συνθετική** κλίση, με τον μηχανισμό που χρησιμοποιούν και οι browsers όταν λείπει
 * η πλάγια όψη — **διάτμηση** (shear) του text matrix.
 *
 * Το jsPDF το επιτρέπει ρητά: το `options.angle` δέχεται `number | Matrix`, και όταν είναι
 * `Matrix` το χρησιμοποιεί **αυτούσιο** ως πίνακα μετασχηματισμού κειμένου (`text()`,
 * `angle instanceof Matrix → transformationMatrix = angle`). Άρα δεν παρακάμπτεται τίποτα
 * και δεν γράφεται ωμό PDF operator.
 *
 * ⚠️ **Η γωνία δεν είναι τοπική**: είναι η ίδια `TEXT_OBLIQUE_ITALIC_DEG` (ISO 3098, 15°) που
 * γράφει και το DXF ως `obliqueAngle` για SHX. Δεύτερος αριθμός εδώ θα σήμαινε ότι το ίδιο
 * κελί γέρνει αλλιώς στο χαρτί και αλλιώς στο σχέδιο.
 */
const ITALIC_SHEAR = Math.tan((TEXT_OBLIQUE_ITALIC_DEG * Math.PI) / 180);

/**
 * Ο πίνακας κειμένου για γωνία `rotationDeg` (μοίρες, όπως τα δέχεται το jsPDF) με προαιρετική
 * συνθετική κλίση. Αναπαράγει **ακριβώς** τον πίνακα που χτίζει το ίδιο το jsPDF για αριθμητικό
 * `angle` (`cos, sin, −sin, cos`) — με μηδενική κλίση είναι byte-identical με πριν — και
 * προ-πολλαπλασιάζει τη διάτμηση, ώστε η κλίση να εφαρμόζεται στο **σύστημα του κειμένου** και
 * να στρίβει μαζί του. Ένας πίνακας [a b c d e f] απεικονίζει (x,y) → (a·x + c·y, b·x + d·y).
 */
function italicTextMatrix(pdf: jsPDF, rotationDeg: number): Matrix {
  const a = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return pdf.Matrix(cos, sin, cos * ITALIC_SHEAR - sin, sin * ITALIC_SHEAR + cos, 0, 0);
}

function emitText(
  pdf: jsPDF, e: Entity, toPaper: (p: Point2D) => Point2D, scale: number,
): void {
  const t = projectSceneTextToDxf(e as unknown as TextSceneShape, (e as { id?: string }).id ?? '');
  if (!t.text) return;
  const p = toPaper(t.position);
  const heightWorld = t.height || DEFAULT_TEXT_HEIGHT_WORLD;
  const fontSizePt = heightWorld * scale * PT_PER_MM;
  pdf.setFontSize(fontSizePt);
  // A decomposed annotation label is marked by the `vBaseline` hint and its
  // `position` IS the alignment anchor → honour `alignment` + baseline (centred
  // glyph letters / scale-bar numerals land on their anchor). Scene text carries
  // no hint → keep the exact previous behaviour (left / alphabetic), so imported
  // text whose insertion-point semantics we don't own is never mis-placed.
  const baseline = (e as VectorTextBaselineHint).vBaseline;
  // ADR-753 Φ4 — η ΙΔΙΑ στένωση με το `clip-entity`: το εξαγόμενο PDF και η αποκοπή στην οθόνη
  // δεν επιτρέπεται να διαφωνούν για το από ποια ακμή απλώνεται ένα κείμενο.
  const align = baseline !== undefined ? entityAlignmentToAnchor((e as TextEntity).alignment) : 'left';
  // Το `textStyle.bold` το προβάλλει ΗΔΗ ο `projectSceneTextToDxf` από το πρώτο run του
  // `textNode` — καμία δεύτερη ανάγνωση του AST εδώ (`extractFirstRunStyle` είναι ο SSoT).
  const bold = t.textStyle?.bold === true;
  if (bold) pdf.setLineWidth((fontSizePt / PT_PER_MM) * SYNTHETIC_BOLD_STROKE_RATIO);
  // ADR-739 Φ.Ε/Φ2 βήμα 4 — τα πλάγια έρχονται από το ΙΔΙΟ πρώτο run με το έντονο.
  const italic = t.textStyle?.italic === true;
  // World rotation is CCW in a Y-up frame; on the Y-down page it reads as CW → negate.
  const angleDeg = -(t.rotation ?? 0);
  pdf.text(sanitizeText(t.text), p.x, p.y, {
    align,
    baseline: baseline ?? 'alphabetic',
    // Χωρίς πλάγια περνά ο **αριθμός**, όπως πάντα: το jsPDF χτίζει τότε μόνο του τον ίδιο
    // πίνακα στροφής, και καμία υπάρχουσα σελίδα δεν αλλάζει ούτε κατά byte.
    angle: italic ? italicTextMatrix(pdf, angleDeg) : angleDeg,
    // Το περίγραμμα χρησιμοποιεί το **draw colour**, που το `applyEntityStyle` έχει ήδη θέσει
    // ίσο με το fill colour της ίδιας οντότητας ⇒ το συνθετικό πάχος βγαίνει στο χρώμα του
    // γράμματος, ποτέ σε δεύτερο χρώμα.
    ...(bold ? { renderingMode: 'fillThenStroke' as const } : {}),
  });
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

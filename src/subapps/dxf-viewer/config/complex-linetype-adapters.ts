/**
 * Complex Linetype adapters — ADR-642 §6.2 (backward-compatible bridge).
 *
 * Pure, side-effect-free μετατροπές ανάμεσα στο σημερινό `LinetypeDef.pattern:
 * number[]` (DXF-native: +dash / −gap / 0=dot / []=solid) και το πλήρες μοντέλο
 * `ComplexLinetypeDef`. Κανένα rework των υπαρχόντων ISO/custom linetypes: το
 * `number[]` παραμένει η αποθηκευμένη μορφή για simple τύπους· ο adapter το ανεβάζει
 * on-demand για τον stroker και το κατεβάζει ξανά για DXF export / native fast-path.
 *
 * SSoT για το ερώτημα «είναι αυτός ο τύπος εκφράσιμος ως απλό number[];» →
 * `isSimpleExpressible`. Ο renderer/DXF-writer επιλέγει μονοπάτι ΜΟΝΟ μέσα από εδώ,
 * ώστε το κριτήριο fast-path να ζει σε ένα σημείο (κανένα σκορπισμένο re-check).
 */

import type { LinetypeDef, LinetypeOrigin } from './linetype-iso-catalog';
import type {
  ComplexLinetypeDef,
  DashElement,
  DotElement,
  GapElement,
  LinetypeScaleSpace,
  PatternElement,
  StrokeJoin,
} from './complex-linetype-types';

/** Προεπιλεγμένο scale-space (ADR-642 §9 Q2 — model, AutoCAD-faithful, zero regression). */
export const DEFAULT_SCALE_SPACE: LinetypeScaleSpace = 'model';
/** Προεπιλεγμένη ένωση τμημάτων (SVG/AutoCAD default). */
export const DEFAULT_STROKE_JOIN: StrokeJoin = 'miter';
/** Προεπιλεγμένο miter limit (SVG default). */
export const DEFAULT_MITER_LIMIT = 10;

/**
 * DXF mm pattern (`+dash / −gap / 0=dot`) → λίστα geometry elements. Καθρέφτης του
 * `dashPatternToSegments` (config/line-pattern-segments.ts) στο πλουσιότερο μοντέλο.
 */
export function dashPatternToElements(
  pattern: ReadonlyArray<number>,
): PatternElement[] {
  const out: PatternElement[] = [];
  for (const v of pattern) {
    if (v === 0) {
      out.push({ kind: 'dot' } satisfies DotElement);
    } else if (v < 0) {
      out.push({ kind: 'gap', lengthMm: -v } satisfies GapElement);
    } else {
      out.push({ kind: 'dash', lengthMm: v } satisfies DashElement);
    }
  }
  return out;
}

/**
 * `LinetypeDef` (simple) → `ComplexLinetypeDef` (single layer). Καμία απώλεια: κάθε
 * simple τύπος γίνεται ένα στρώμα από dash/gap/dot elements, με τα defaults του Φ1.
 */
export function patternToComplex(def: LinetypeDef): ComplexLinetypeDef {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    layers: [{ elements: dashPatternToElements(def.pattern) }],
    scaleSpace: DEFAULT_SCALE_SPACE,
    origin: def.origin as LinetypeOrigin,
    sourceFile: def.sourceFile,
  };
}

/**
 * True όταν ο complex τύπος αποδίδεται ΤΑΥΤΟΣΗΜΑ με native `ctx.setLineDash()` —
 * δηλαδή μπορεί να αναχθεί σε `number[]` χωρίς απώλεια. Αυτό είναι το fast-path
 * guard: μηδέν performance regression για τους 99% κοινούς τύπους (ο custom stroker
 * τρέχει ΜΟΝΟ όταν αυτό επιστρέφει false).
 *
 * Simple ⇔ ένα στρώμα, χωρίς offset, μόνο dash/gap/dot elements χωρίς per-element
 * cap/width, και corner policy που το native stroke ήδη σέβεται (`bypass`/απούσα).
 * Text/symbol/compound/caps/variable-width/break-corner → NOT simple (θέλουν stroker).
 */
export function isSimpleExpressible(def: ComplexLinetypeDef): boolean {
  if (def.layers.length !== 1) return false;
  if (def.cornerPolicy != null && def.cornerPolicy !== 'bypass') return false;
  const [layer] = def.layers;
  if (layer.offsetMm) return false;
  if (layer.widthMm != null) return false;
  for (const el of layer.elements) {
    if (el.kind === 'text' || el.kind === 'symbol') return false;
    if (el.kind === 'dash' && (el.cap != null || el.widthMm != null || el.widthProfile != null)) {
      return false;
    }
    if (el.kind === 'dot' && el.cap != null) return false;
  }
  return true;
}

/**
 * `ComplexLinetypeDef` → DXF mm pattern, ή `null` όταν ΔΕΝ είναι simple-expressible
 * (έχει text/symbol/compound/caps/variable-width → δεν εκφράζεται ως `number[]`).
 * Το `null` σηματοδοτεί στον writer/renderer να ακολουθήσει το complex μονοπάτι.
 */
export function complexToPattern(def: ComplexLinetypeDef): number[] | null {
  if (!isSimpleExpressible(def)) return null;
  const [layer] = def.layers;
  const out: number[] = [];
  for (const el of layer.elements) {
    if (el.kind === 'dash') out.push(el.lengthMm);
    else if (el.kind === 'gap') out.push(-el.lengthMm);
    else if (el.kind === 'dot') out.push(0);
  }
  return out;
}

/** Το ενεργό scale-space ενός τύπου (default `'model'`). */
export function effectiveScaleSpace(def: ComplexLinetypeDef): LinetypeScaleSpace {
  return def.scaleSpace ?? DEFAULT_SCALE_SPACE;
}

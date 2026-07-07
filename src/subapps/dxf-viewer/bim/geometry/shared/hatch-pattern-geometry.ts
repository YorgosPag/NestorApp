/**
 * Hatch pattern geometry (SSoT, ADR-507 Φ1a).
 *
 * `buildHatchLines()` παράγει τα παράλληλα ευθύγραμμα τμήματα μιας user-defined
 * γραμμοσκίασης, γεωμετρικά «κομμένα» στα όρια (boundary paths). ΜΙΑ γεωμετρία →
 * τρέφει ΚΑΙ τον `HatchRenderer` (canvas) ΚΑΙ τον `dxf-ascii-writer` σε lines-mode
 * (Τέκτονας — HATCH → exploded LINEs). Έτσι το canvas και το εξαγόμενο DXF δείχνουν
 * ΑΚΡΙΒΩΣ τις ίδιες γραμμές (full SSoT, όπως Revit).
 *
 * Χτίζει πάνω στο υπάρχον axis-aligned hatch SSoT (`polygon-hatch-utils`) — δεν
 * ξαναϋλοποιεί την παραγωγή απείρων γραμμών/clip-σε-bbox (N.12 dedup). Προσθέτει
 * μόνο το επιπλέον βήμα: clip του κάθε bbox-segment στο πραγματικό πολύγωνο, με
 * even-odd island rule.
 *
 * Όλες οι συντεταγμένες σε mm world coords.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 * @see bim/geometry/shared/polygon-hatch-utils.ts (buildAxisAlignedHatch SSoT)
 */

import type { Point3D } from '../../types/bim-base';
import {
  buildAxisAlignedHatch,
  clipLineToBbox,
  perpendicularRangeOverBbox,
  type HatchDirection,
  type HatchLineSegment,
  type HatchPoint2D,
} from './polygon-hatch-utils';
import { polygonBbox, pointInPolygon } from './polygon-utils';
import { translatePoint } from '../../../rendering/entities/shared/geometry-vector-utils';
import { lerpPoint } from '../../../rendering/entities/shared/geometry-utils';
import { degToRad } from '../../../rendering/entities/shared/geometry-angle-utils';
import type { HatchIslandStyle } from '../../hatch/hatch-properties';
import { isSolidHatch } from '../../hatch/hatch-properties';
import { getHatchPattern, resolveEffectiveHatchScale, type HatchPattern, type PatternLine } from '../../../data/hatch-pattern-catalog';
import type { HatchEntity } from '../../../types/entities';

/** Προεπιλεγμένη απόσταση γραμμών (mm) για user-defined hatch χωρίς ρητό spacing. */
export const DEFAULT_HATCH_LINE_SPACING_MM = 100;

export type { HatchLineSegment, HatchPoint2D } from './polygon-hatch-utils';
export type { HatchIslandStyle } from '../../hatch/hatch-properties';

export interface BuildHatchLinesOptions {
  /** Κάθετη απόσταση γραμμών (mm). ≤ 0 → κενό αποτέλεσμα. */
  readonly spacingMm: number;
  /** Γωνία γραμμών σε μοίρες (CCW από +X). Προεπιλογή 0 (οριζόντιες). */
  readonly angleDeg?: number;
  /** Phase origin του μοτίβου. Προεπιλογή world {0,0}. */
  readonly origin?: HatchPoint2D;
  /** Διπλή (σταυρωτή) γραμμοσκίαση → προσθέτει 2ο set στις +90°. */
  readonly double?: boolean;
  /** Island rule. 'ignore' → μόνο το εξωτερικό path[0]· αλλιώς even-odd. */
  readonly islandStyle?: HatchIslandStyle;
}

const EPS = 1e-7;

/** Μοναδιαία κατεύθυνση από γωνία (μοίρες) — reuse degToRad SSoT. */
function unitFromAngle(angleDeg: number): HatchDirection {
  const r = degToRad(angleDeg);
  return { ux: Math.cos(r), uy: Math.sin(r) };
}

/** Σημείο πάνω στο segment σε παράμετρο t — reuse lerpPoint SSoT. */
function segPoint(seg: HatchLineSegment, t: number): HatchPoint2D {
  return lerpPoint(seg.start, seg.end, t);
}

/**
 * Παράμετρος `t ∈ (0,1)` πάνω στο segment `p0→p1` όπου τέμνει την ακμή `a→b`, ή
 * `null` αν δεν τέμνονται μέσα στα δύο τμήματα (ή είναι παράλληλα). Standard 2D
 * segment-segment intersection (Cramer).
 */
function segmentCrossParam(
  p0: HatchPoint2D, p1: HatchPoint2D, a: HatchPoint2D, b: HatchPoint2D,
): number | null {
  const rx = p1.x - p0.x, ry = p1.y - p0.y;
  const sx = b.x - a.x, sy = b.y - a.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < EPS) return null; // παράλληλα / collinear
  const t = ((a.x - p0.x) * sy - (a.y - p0.y) * sx) / denom;
  const u = ((a.x - p0.x) * ry - (a.y - p0.y) * rx) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return t;
}

/**
 * True όταν το point ανήκει στη γεμιζόμενη περιοχή.
 *   - 'ignore' → μόνο μέσα στο εξωτερικό path[0] (αγνοεί νησίδες)
 *   - 'normal'/'outer' → even-odd: μέσα σε μονό πλήθος paths
 */
function insideRegion(
  point: HatchPoint2D, paths: readonly Point3D[][], islandStyle: HatchIslandStyle,
): boolean {
  if (islandStyle === 'ignore') return pointInPolygon(point, paths[0]);
  let count = 0;
  for (const path of paths) if (pointInPolygon(point, path)) count += 1;
  return count % 2 === 1;
}

/** Κόψε ένα bbox-segment στα όρια — επιστρέφει τα υπο-τμήματα εντός περιοχής. */
function clipSegmentToRegion(
  seg: HatchLineSegment, paths: readonly Point3D[][], islandStyle: HatchIslandStyle,
): HatchLineSegment[] {
  const relevant = islandStyle === 'ignore' ? [paths[0]] : paths;
  const ts: number[] = [0, 1];
  for (const path of relevant) {
    const n = path.length;
    for (let i = 0; i < n; i += 1) {
      const a = path[i];
      const b = path[(i + 1) % n];
      const t = segmentCrossParam(seg.start, seg.end, a, b);
      if (t != null && t > EPS && t < 1 - EPS) ts.push(t);
    }
  }
  ts.sort((x, y) => x - y);
  const out: HatchLineSegment[] = [];
  for (let i = 0; i < ts.length - 1; i += 1) {
    const t0 = ts[i];
    const t1 = ts[i + 1];
    if (t1 - t0 < EPS) continue;
    const mid = segPoint(seg, (t0 + t1) / 2);
    if (insideRegion(mid, paths, islandStyle)) {
      out.push({ start: segPoint(seg, t0), end: segPoint(seg, t1) });
    }
  }
  return out;
}

/** Ένα set παράλληλων κομμένων γραμμών σε δεδομένη γωνία. */
function buildClippedSet(
  paths: readonly Point3D[][], spacingMm: number, angleDeg: number, islandStyle: HatchIslandStyle,
): HatchLineSegment[] {
  const allVerts = paths.flat();
  const bbox = polygonBbox(allVerts);
  const full = buildAxisAlignedHatch(bbox, spacingMm, unitFromAngle(angleDeg));
  const out: HatchLineSegment[] = [];
  for (const seg of full) out.push(...clipSegmentToRegion(seg, paths, islandStyle));
  return out;
}

/**
 * Παράγει τα τμήματα μιας user-defined γραμμοσκίασης, κομμένα στα `boundaryPaths`.
 * Phase origin: μεταφέρουμε τα όρια κατά `-origin`, χτίζουμε, ξανα-μεταφέρουμε κατά
 * `+origin` — έτσι οι γραμμές «κουμπώνουν» στο origin (default world 0 = συμβατό με
 * beam/floor-finish hatch). Επιστρέφει κενό για κενά όρια ή `spacing ≤ 0`.
 */
export function buildHatchLines(
  boundaryPaths: ReadonlyArray<ReadonlyArray<HatchPoint2D>>,
  opts: BuildHatchLinesOptions,
): HatchLineSegment[] {
  const { spacingMm, angleDeg = 0, origin = { x: 0, y: 0 }, double = false, islandStyle = 'normal' } = opts;
  if (spacingMm <= 0) return [];
  const usable = boundaryPaths.filter((p) => p.length >= 3);
  if (!usable.length) return [];

  const shifted: Point3D[][] = usable.map((path) =>
    path.map((v) => ({ x: v.x - origin.x, y: v.y - origin.y, z: 0 })),
  );

  const segments = buildClippedSet(shifted, spacingMm, angleDeg, islandStyle);
  if (double) segments.push(...buildClippedSet(shifted, spacingMm, angleDeg + 90, islandStyle));

  return segments.map((s) => ({
    start: translatePoint(s.start, origin),
    end: translatePoint(s.end, origin),
  }));
}

// ─── Predefined PAT patterns (ADR-507 Φ2) ────────────────────────────────────────

/** Μήκος που σχεδιάζεται για μια «κουκκίδα» (dash == 0) — mm, ορατό σημείο. */
const DOT_LENGTH_MM = 0.35;
/** Ασφαλιστικό όριο γραμμών ανά οικογένεια (αποφυγή busy loop σε εκφυλισμένα δεδομένα). */
const MAX_PATTERN_LINES = 4000;

export interface BuildPredefinedHatchOptions {
  /** Συντελεστής κλίμακας μοτίβου (× origin/delta/dashes). Προεπιλογή 1. */
  readonly scale?: number;
  /** Συνολική περιστροφή μοτίβου (μοίρες) — προστίθεται σε κάθε `PatternLine.angle`. */
  readonly angleDeg?: number;
  /** Phase origin ολόκληρου του μοτίβου (world mm). Προεπιλογή {0,0}. */
  readonly origin?: HatchPoint2D;
  /** Island rule (ίδιο με user-defined). */
  readonly islandStyle?: HatchIslandStyle;
}

/** Σημείο πάνω στη γραμμή `angle` με συντεταγμένη `s` κατά μήκος + `k` κάθετα. */
function pointFromLineCoords(s: number, k: number, ux: number, uy: number): HatchPoint2D {
  // u = (ux, uy)· n = (-uy, ux)·  p = s·u + k·n.
  return { x: s * ux - k * uy, y: s * uy + k * ux };
}

/** Σύνολο dash-υπο-τμημάτων μιας γραμμής, ως [s0, s1] κατά μήκος (πριν το clip). */
function dashSpansAlongLine(
  sStart: number, sEnd: number, phase: number, dashes: readonly number[], period: number,
): Array<readonly [number, number]> {
  const spans: Array<readonly [number, number]> = [];
  // Ξεκίνα από τον κύκλο που καλύπτει το sStart (ευθυγραμμισμένος στο phase).
  let cycleStart = Math.floor((sStart - phase) / period) * period + phase;
  let guard = 0;
  while (cycleStart < sEnd && guard < MAX_PATTERN_LINES) {
    guard += 1;
    let cursor = cycleStart;
    for (const d of dashes) {
      const len = Math.abs(d);
      if (d > 0) {
        spans.push([cursor, cursor + len]);
      } else if (d === 0) {
        spans.push([cursor, cursor + DOT_LENGTH_MM]); // κουκκίδα
      }
      cursor += len === 0 ? DOT_LENGTH_MM : len;
    }
    cycleStart += period;
  }
  // Clip στο [sStart, sEnd].
  const out: Array<readonly [number, number]> = [];
  for (const [a, b] of spans) {
    const s0 = Math.max(a, sStart);
    const s1 = Math.min(b, sEnd);
    if (s1 - s0 > EPS) out.push([s0, s1]);
  }
  return out;
}

/** Παράγει τα (μη-clipped στο όριο) τμήματα μιας `PatternLine` πάνω στο bbox. */
function buildPatternLineSegments(
  pl: PatternLine, bbox: ReturnType<typeof polygonBbox>, globalAngleDeg: number,
): HatchLineSegment[] {
  const angle = pl.angle + globalAngleDeg;
  const r = degToRad(angle);
  const ux = Math.cos(r);
  const uy = Math.sin(r);
  const dy = Math.abs(pl.delta[1]);
  if (dy < EPS) return []; // χωρίς κάθετη απόσταση → εκφυλισμένη οικογένεια

  // Perpendicular συντεταγμένη origin: k = -uy·x + ux·y (ίδιο k με clipLineToBbox).
  const [ox, oy] = pl.origin;
  const kOrigin = -uy * ox + ux * oy;
  const sOrigin = ux * ox + uy * oy;            // along-line συντεταγμένη origin
  const dx = pl.delta[0];                        // stagger κατά μήκος ανά γραμμή
  const dashes = pl.dashes;
  const period = dashes.reduce((acc, d) => acc + (Math.abs(d) || DOT_LENGTH_MM), 0);
  const hasDashes = dashes.length > 0 && period > EPS;

  // Εύρος δεικτών γραμμών i ώστε k=kOrigin+i·dy να καλύπτει το bbox (reuse SSoT projection).
  const { kMin, kMax } = perpendicularRangeOverBbox(bbox, { ux, uy });
  const iStart = Math.ceil((kMin - kOrigin) / dy);
  const iEnd = Math.floor((kMax - kOrigin) / dy);

  const out: HatchLineSegment[] = [];
  let steps = 0;
  for (let i = iStart; i <= iEnd; i += 1) {
    if (++steps > MAX_PATTERN_LINES) break;
    const k = kOrigin + i * dy;
    const chord = clipLineToBbox({ ux, uy }, k, bbox);
    if (!chord) continue;
    const sA = chord.start.x * ux + chord.start.y * uy;
    const sB = chord.end.x * ux + chord.end.y * uy;
    const sStart = Math.min(sA, sB);
    const sEnd = Math.max(sA, sB);
    if (!hasDashes) {
      out.push({ start: chord.start, end: chord.end });
      continue;
    }
    const phase = sOrigin + i * dx;
    for (const [s0, s1] of dashSpansAlongLine(sStart, sEnd, phase, dashes, period)) {
      out.push({
        start: pointFromLineCoords(s0, k, ux, uy),
        end: pointFromLineCoords(s1, k, ux, uy),
      });
    }
  }
  return out;
}

/**
 * Παράγει τα τμήματα ενός **predefined** μοτίβου (PAT catalog), κομμένα στα
 * `boundaryPaths`. SSoT: η ΙΔΙΑ έξοδος τροφοδοτεί τον canvas renderer ΚΑΙ τον DXF
 * writer (lines-mode) — μηδέν δεύτερη pattern math.
 *
 * Reuse: `clipLineToBbox` (chord ανά γραμμή) + `clipSegmentToRegion` (boundary clip,
 * even-odd island rule) — μηδέν νέα clip math. Η μόνη νέα λογική είναι η υποδιαίρεση
 * σε dashes/dots κατά μήκος (PAT semantics).
 */
export function buildPredefinedHatchLines(
  boundaryPaths: ReadonlyArray<ReadonlyArray<HatchPoint2D>>,
  pattern: HatchPattern,
  opts: BuildPredefinedHatchOptions = {},
): HatchLineSegment[] {
  const { scale = 1, angleDeg = 0, origin = { x: 0, y: 0 }, islandStyle = 'normal' } = opts;
  if (scale <= 0) return [];
  const usable = boundaryPaths.filter((p) => p.length >= 3);
  if (!usable.length) return [];

  // Phase origin: μετατόπισε τα όρια κατά -origin, χτίσε, ξανα-μετατόπισε (mirror buildHatchLines).
  const shifted: Point3D[][] = usable.map((path) =>
    path.map((v) => ({ x: v.x - origin.x, y: v.y - origin.y, z: 0 })),
  );
  const bbox = polygonBbox(shifted.flat());

  const out: HatchLineSegment[] = [];
  for (const pl of pattern.lines) {
    const scaled: PatternLine = {
      angle: pl.angle,
      origin: [pl.origin[0] * scale, pl.origin[1] * scale],
      delta: [pl.delta[0] * scale, pl.delta[1] * scale],
      dashes: pl.dashes.map((d) => d * scale),
    };
    const raw = buildPatternLineSegments(scaled, bbox, angleDeg);
    for (const seg of raw) out.push(...clipSegmentToRegion(seg, shifted, islandStyle));
  }

  return out.map((s) => ({
    start: translatePoint(s.start, origin),
    end: translatePoint(s.end, origin),
  }));
}

// ─── Entity → segments SSoT resolver (ADR-507) ───────────────────────────────────

/**
 * **SSoT entity→segments mapping.** Μετατρέπει ένα (μη-solid) `HatchEntity` στα
 * pattern τμήματά του, κάνοντας ΜΙΑ φορά το branching predefined↔user-defined + το
 * mapping πεδίων→options. Καταναλώνεται ΚΑΙ από τον `HatchRenderer` (canvas) ΚΑΙ από
 * τον `dxf-ascii-writer` (exploded LINEs) → πλήρες «μία γεωμετρία → canvas + DXF»
 * (όχι μόνο ίδια low-level συνάρτηση, αλλά ίδιο entity-mapping — μηδέν διπλότυπο).
 *
 * Solid hatch → `[]` (ο caller το χειρίζεται με fill / 3DFACE, όχι με γραμμές).
 */
export function buildHatchEntitySegments(
  hatch: Pick<
    HatchEntity,
    'boundaryPaths' | 'fillType' | 'patternType' | 'patternName' | 'patternScale'
    | 'patternAngle' | 'patternOrigin' | 'lineAngle' | 'lineSpacing' | 'doubleCrossHatch'
    | 'islandStyle' | 'inlinePattern'
  >,
): HatchLineSegment[] {
  if (isSolidHatch(hatch)) return [];
  // Gradient = συνεχές γέμισμα (ADR-507 Φ5) — αποδίδεται με CanvasGradient στον
  // renderer, ΟΧΙ με γραμμές μοτίβου.
  if (hatch.fillType === 'gradient') return [];
  const paths = (hatch.boundaryPaths ?? []).filter((p) => p.length >= 3);
  if (!paths.length) return [];
  const islandStyle = hatch.islandStyle ?? 'normal';

  if (hatch.fillType === 'predefined') {
    const pattern = getHatchPattern(hatch.patternName);
    if (pattern) {
      return buildPredefinedHatchLines(paths, pattern, {
        // effective = suggested(ανά μοτίβο) × user multiplier — ορατή πυκνότητα by default.
        scale: resolveEffectiveHatchScale(hatch.patternName, hatch.patternScale),
        angleDeg: hatch.patternAngle ?? 0,
        origin: hatch.patternOrigin,
        islandStyle,
      });
    }
    // Inline (imported) μοτίβο εκτός catalog (ADR-507 Φ6): οι γραμμές είναι ΑΠΟΛΥΤΕΣ
    // (43-49 σε world mm, 53 = τελική γωνία) → render 1:1 (scale=1, angleDeg=0).
    if (hatch.inlinePattern && hatch.inlinePattern.lines.length) {
      return buildPredefinedHatchLines(paths, hatch.inlinePattern, {
        scale: 1,
        angleDeg: 0,
        origin: hatch.patternOrigin,
        islandStyle,
      });
    }
    return [];
  }
  return buildHatchLines(paths, {
    spacingMm: hatch.lineSpacing ?? hatch.patternScale ?? DEFAULT_HATCH_LINE_SPACING_MM,
    angleDeg: hatch.lineAngle ?? hatch.patternAngle ?? 0,
    origin: hatch.patternOrigin,
    double: hatch.doubleCrossHatch ?? false,
    islandStyle,
  });
}

/**
 * Η ΠΥΚΝΟΤΕΡΗ (ελάχιστη) κάθετη απόσταση γραμμών της γραμμοσκίασης σε **world mm**
 * — η μικρότερη `delta-y` (× effective scale) μεταξύ όλων των οικογενειών. Χρησιμεύει
 * για density-LOD: ο renderer τη μετατρέπει σε px (× zoom) και αν είναι sub-pixel
 * αποφεύγει να παράγει/σχεδιάσει χιλιάδες δυσδιάκριτες γραμμές. Solid → 0.
 */
export function hatchMinWorldSpacing(
  hatch: Pick<
    HatchEntity,
    'fillType' | 'patternType' | 'patternName' | 'patternScale' | 'lineSpacing' | 'inlinePattern'
  >,
): number {
  if (isSolidHatch(hatch)) return 0;
  if (hatch.fillType === 'predefined') {
    const pattern = getHatchPattern(hatch.patternName);
    if (pattern && pattern.lines.length) {
      const eff = resolveEffectiveHatchScale(hatch.patternName, hatch.patternScale);
      let min = Number.POSITIVE_INFINITY;
      for (const l of pattern.lines) {
        const dy = Math.abs(l.delta[1]) * eff;
        if (dy > EPS && dy < min) min = dy;
      }
      return Number.isFinite(min) ? min : 0;
    }
    // Inline μοτίβο: οι delta είναι ήδη απόλυτες (scale=1) → καμία × effective.
    if (hatch.inlinePattern && hatch.inlinePattern.lines.length) {
      let min = Number.POSITIVE_INFINITY;
      for (const l of hatch.inlinePattern.lines) {
        const dy = Math.abs(l.delta[1]);
        if (dy > EPS && dy < min) min = dy;
      }
      return Number.isFinite(min) ? min : 0;
    }
    return 0;
  }
  return hatch.lineSpacing ?? hatch.patternScale ?? DEFAULT_HATCH_LINE_SPACING_MM;
}

/**
 * Ο `patternScale` (×) ώστε ένα **predefined** μοτίβο να έχει ορατή απόσταση γραμμών
 * `desiredMm` σε world mm. Big-player παράλληλο: το «έτοιμο μοτίβο» δεν έχει «απόσταση»
 * — μόνο κλίμακα (AutoCAD/Revit)· εδώ αντιστρέφουμε το `hatchMinWorldSpacing` (που είναι
 * γραμμικό στο `patternScale`) ώστε ο χρήστης να δίνει «Απόσταση σε mm» και να μεταφράζεται
 * αυτόματα σε κλίμακα (ADR-507). Reuse του ΙΔΙΟΥ `hatchMinWorldSpacing` — μηδέν νέα pattern math.
 *
 * Επιστρέφει 1 όταν το μοτίβο/απόσταση είναι εκφυλισμένα (δεν υπάρχει έγκυρη πυκνότητα).
 */
export function patternScaleForSpacingMm(
  patternName: string | undefined, desiredMm: number,
): number {
  if (desiredMm <= 0) return 1;
  // world min-spacing σε patternScale=1 → γραμμικός συντελεστής (spacing = unit × scale).
  const unit = hatchMinWorldSpacing({ fillType: 'predefined', patternName, patternScale: 1 });
  if (unit <= EPS) return 1;
  return desiredMm / unit;
}

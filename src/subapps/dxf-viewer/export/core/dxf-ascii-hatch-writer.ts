/**
 * ============================================================================
 * DXF ASCII HATCH WRITER — HATCH entity emission (ADR-507 Φ1a / Φ5)
 * ============================================================================
 *
 * Split out of `dxf-ascii-writer.ts` (N.7.1 file-size SSoT). Owns the three HATCH
 * emitters:
 *   • `emitHatch`            — native `HATCH` (polyline mode) ή exploded `LINE`s
 *                              (Τέκτονας), boundary loops + pattern meta.
 *   • `emitPredefinedPattern`— predefined PAT μοτίβα (group codes 52/41/78 + ανά
 *                              `PatternLine` τα 53/43/44/45/46/79/49, ADR-507 §2.3).
 *   • `emitGradient`         — gradient block (DXF 450-470, ADR-507 Φ5).
 *
 * solid-check + island↔code75 = SSoT `bim/hatch/hatch-properties` (κοινό με
 * renderer + reader, N.12 — μηδέν τοπικό διπλότυπο). `emitLine` περνιέται ως
 * παράμετρος (παραμένει ο ΕΝΑΣ ορισμός στον dxf-ascii-writer).
 */

import type { HatchEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { buildHatchEntitySegments } from '../../bim/geometry/shared/hatch-pattern-geometry';
import { getHatchPattern, resolveEffectiveHatchScale } from '../../data/hatch-pattern-catalog';
import { isSolidHatch, islandStyleToDxf75 } from '../../bim/hatch/hatch-properties';
import { degToRad } from '../../rendering/entities/shared/geometry-angle-utils';
import { hexToTrueColor } from '../../utils/dxf-true-color';
import type { HatchGradient } from '../../bim/hatch/hatch-gradient';

/** Scale-aware group-code sink — `(code, value) => out.push(...)`. */
export type Pair = (code: number, value: string | number) => void;

/** The `emitLine` SSoT (dxf-ascii-writer), injected so HATCH explode reuses it. */
export type EmitLine = (
  a: Point2D, b: Point2D, layer: string, aci: number, s: number, pair: Pair,
) => void;

// ─── HATCH (ADR-507 Φ1a) ──────────────────────────────────────────────────────
// solid-check + island↔code75 = SSoT `bim/hatch/hatch-properties` (κοινό με
// renderer + reader, N.12 — μηδέν τοπικό διπλότυπο).

/**
 * Γράψε μια γραμμοσκίαση. polyline-mode → native `HATCH` (boundary loops + pattern
 * meta)· lines-mode → exploded `LINE`s (boundary outlines + user-defined γραμμές
 * μέσω του `buildHatchEntitySegments` SSoT — ίδια γεωμετρία με τον canvas renderer).
 */
export function emitHatch(
  e: HatchEntity, layer: string, aci: number, s: number, explode: boolean, pair: Pair,
  emitLine: EmitLine,
): void {
  const paths = (e.boundaryPaths ?? []).filter((p) => p.length >= 2);
  if (!paths.length) return; // κενά όρια → τίποτα (κρατά «bare hatch → skip» συμβατό)
  const gradient = e.fillType === 'gradient' && e.gradient ? e.gradient : undefined;
  const solid = isSolidHatch(e);

  if (explode) {
    // Τέκτονας: boundary outlines ως LINEs.
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i += 1) emitLine(path[i], path[i + 1], layer, aci, s, pair);
      if (path.length > 2) emitLine(path[path.length - 1], path[0], layer, aci, s, pair);
    }
    // user-defined / predefined: οι γραμμές μοτίβου ως LINEs (FULL SSoT με canvas).
    if (!solid) {
      const segs = buildHatchEntitySegments(e);
      for (const seg of segs) emitLine(seg.start, seg.end, layer, aci, s, pair);
    }
    return;
  }

  // Native HATCH (AutoCAD R2000+ minimal, polyline boundaries).
  pair(0, 'HATCH');
  pair(8, layer);
  pair(62, aci);
  pair(100, 'AcDbHatch');
  pair(10, 0); pair(20, 0); pair(30, 0);          // elevation point
  pair(210, 0); pair(220, 0); pair(230, 1);       // extrusion normal
  pair(2, solid || gradient ? 'SOLID' : (e.patternName ?? 'USER'));
  pair(70, solid || gradient ? 1 : 0);            // solid fill flag (gradient → solid-type region)
  pair(71, e.associative ? 1 : 0);                // associativity
  pair(91, paths.length);                         // number of boundary paths
  for (let pi = 0; pi < paths.length; pi += 1) {
    const path = paths[pi];
    // boundary path type flag: polyline(2) + external(1) στο πρώτο / outermost(16) στα νησιά.
    const flag = 2 | (pi === 0 ? 1 : 16);
    pair(92, flag);
    pair(72, 0);                                  // has bulge = όχι
    pair(73, 1);                                  // is closed
    pair(93, path.length);                        // number of vertices
    for (const v of path) { pair(10, v.x * s); pair(20, v.y * s); }
    pair(97, 0);                                  // number of source boundary objects
  }
  pair(75, islandStyleToDxf75(e.islandStyle));    // hatch style
  // pattern type: 0=user-defined, 1=predefined. Non-solid χωρίς ρητό fillType →
  // user-defined (οι default γραμμές μοτίβου είναι user-defined). Gradient → solid
  // region + gradient block (κανένα pattern line).
  const predefined = !solid && !gradient && e.fillType === 'predefined';
  const userDefined = !solid && !gradient && !predefined;
  pair(76, userDefined ? 0 : 1);                  // 0=user-defined, 1=predefined
  if (gradient) {
    emitGradient(gradient, pair);
  } else if (predefined) {
    emitPredefinedPattern(e, pair);
  } else if (!solid) {
    const angle = e.lineAngle ?? e.patternAngle ?? 0;
    const spacing = e.lineSpacing ?? e.patternScale ?? 1;
    pair(52, angle);                              // pattern angle
    pair(41, spacing);                            // pattern scale / spacing
    pair(77, e.doubleCrossHatch ? 1 : 0);         // double flag
    pair(78, 1);                                  // number of pattern definition lines
    // ΕΝΑ ορισμός γραμμής μοτίβου → έγκυρο user-defined hatch στο AutoCAD.
    const r = degToRad(angle);
    pair(53, angle);                              // line angle
    pair(43, 0); pair(44, 0);                     // base point
    pair(45, -Math.sin(r) * spacing);             // offset x (κάθετο)
    pair(46, Math.cos(r) * spacing);              // offset y (κάθετο)
    pair(79, 0);                                  // dash items
  }
  pair(47, 0);                                    // pixel size
  const seeds = e.seedPoints ?? [];
  pair(98, seeds.length);                         // number of seed points
  for (const sp of seeds) { pair(10, sp.x * s); pair(20, sp.y * s); }
}

/**
 * Γράφει τα group codes ενός predefined PAT μοτίβου στο native HATCH: 52/41 (γωνία/
 * κλίμακα), 78 (πλήθος γραμμών), και ανά `PatternLine` τα 53/43/44/45/46/79/49
 * (ADR-507 §2.3). Οι τιμές κλιμακώνονται κατά `patternScale` ώστε το εξαγόμενο DXF
 * να ταιριάζει με την οθόνη. Άγνωστο pattern → fallback σε μία γραμμή (valid hatch).
 */
function emitPredefinedPattern(e: HatchEntity, pair: Pair): void {
  const angle = e.patternAngle ?? 0;
  // effective scale (suggested ανά μοτίβο × user) — ίδιο με τον canvas (WYSIWYG).
  const scale = resolveEffectiveHatchScale(e.patternName, e.patternScale);
  pair(52, angle);                                // pattern angle
  pair(41, scale);                                // pattern scale
  pair(77, 0);                                    // double flag (n/a για predefined)
  const pattern = getHatchPattern(e.patternName);
  const lines = pattern?.lines ?? [];
  if (lines.length === 0) {
    // fallback: μία διαγώνια ώστε το hatch να παραμένει έγκυρο.
    pair(78, 1);
    pair(53, angle); pair(43, 0); pair(44, 0);
    pair(45, 0); pair(46, scale || 1); pair(79, 0);
    return;
  }
  pair(78, lines.length);                         // number of pattern definition lines
  for (const pl of lines) {
    pair(53, pl.angle + angle);                   // line angle
    pair(43, pl.origin[0] * scale);               // base point X
    pair(44, pl.origin[1] * scale);               // base point Y
    pair(45, pl.delta[0] * scale);                // offset (delta) X
    pair(46, pl.delta[1] * scale);                // offset (delta) Y
    pair(79, pl.dashes.length);                   // number of dash lengths
    for (const d of pl.dashes) pair(49, d * scale); // dash length
  }
}

/**
 * Γράφει το gradient block ενός HATCH (DXF 450-470, ADR-507 Φ5): flag/single/πλήθος
 * χρωμάτων, γωνία (rad), shift, tint, ανά χρώμα `463`(θέση 0/1)+`421`(RGB int), `470`
 * όνομα. Two-color → 2 χρώματα· single-color → 1 + tint. Mirror του reader (round-trip).
 */
function emitGradient(g: HatchGradient, pair: Pair): void {
  const single = g.singleColor === true || g.color2 === undefined;
  const rgb1 = hexToTrueColor(g.color1);
  pair(450, 1);                                   // gradient flag
  pair(451, 0);                                   // reserved
  pair(452, single ? 1 : 0);                      // 1=single-color, 0=two-color
  pair(453, single ? 1 : 2);                      // number of colors
  pair(460, degToRad(g.angleDeg ?? 0));           // rotation (radians)
  pair(461, g.shift ?? 0);                        // definition / centered shift
  pair(462, g.tint ?? (single ? 0 : 1));          // color tint (single-color)
  pair(463, 0);                                   // color 1 interpolation value
  pair(421, rgb1);                                // color 1 (RGB true color)
  if (!single) {
    pair(463, 1);                                 // color 2 interpolation value
    pair(421, hexToTrueColor(g.color2 ?? g.color1)); // color 2
  }
  pair(470, g.type.toUpperCase());                // gradient name (LINEAR/SPHERICAL/…)
}

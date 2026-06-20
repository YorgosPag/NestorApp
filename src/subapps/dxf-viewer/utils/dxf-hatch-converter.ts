/**
 * 🏢 ENTERPRISE: DXF HATCH Converter (ADR-507 Φ1a)
 *
 * Extracted from `dxf-entity-converters.ts` (N.7.1 500-line cap). Re-exported
 * from there so all existing importers keep working unchanged.
 *
 * Δουλεύει πάνω σε ORDERED pairs (όχι flat `Record`) γιατί τα boundary loops έχουν
 * επαναλαμβανόμενα 10/20 που το flat data χάνει.
 *
 * @see dxf-entity-converters.ts - Master router
 * @see AutoCAD DXF Reference: HATCH entity (boundary path data)
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';
import { dxf75ToIslandStyle } from '../bim/hatch/hatch-properties';
import { extractEntityColor } from './dxf-converter-helpers';
import { dwarn } from '../debug';

type DxfPairs = ReadonlyArray<readonly [string, string]>;

/**
 * Convert HATCH entity (ADR-507 Φ1a).
 *
 * Δουλεύει πάνω σε ORDERED pairs (όχι flat `Record`) γιατί τα boundary loops έχουν
 * επαναλαμβανόμενα 10/20 που το flat data χάνει. State machine: από τον κωδικό 91
 * (πλήθος ορίων) → ανά path διαβάζει 93 (πλήθος κορυφών) + τόσα ζεύγη 10/20. Τα
 * 10/20 του elevation point (πριν το 91) και των seed points (μετά) δεν μπερδεύονται.
 *
 * @see AutoCAD DXF Reference: HATCH entity (boundary path data)
 */
export function convertHatch(
  pairs: DxfPairs,
  layer: string,
  index: number,
): AnySceneEntity | null {
  // ── Scalars (μη-10/20 κωδικοί → μοναδικοί, ασφαλές πρώτο match) ──────────────
  let patternName: string | undefined;
  let solid = false;
  let islandCode = 0;
  let patternTypeCode = 1;
  let angle: number | undefined;
  let scale: number | undefined;
  let colorAci: number | undefined;
  let path91Index = -1;

  for (let i = 0; i < pairs.length; i += 1) {
    const [code, value] = pairs[i];
    switch (code) {
      case '2': if (patternName === undefined) patternName = value; break;
      case '70': solid = value.trim() === '1'; break;
      case '75': islandCode = parseInt(value, 10) || 0; break;
      case '76': patternTypeCode = parseInt(value, 10); break;
      case '52': if (angle === undefined) angle = parseFloat(value); break;
      case '41': if (scale === undefined) scale = parseFloat(value); break;
      case '62': colorAci = parseInt(value, 10); break;
      case '91': if (path91Index < 0) path91Index = i; break;
      default: break;
    }
  }

  if (path91Index < 0) {
    dwarn('EntityConverter', `⚠️ Skipping HATCH ${index}: missing boundary path count (91)`);
    return null;
  }

  // ── Boundary paths (state machine από το 91) ────────────────────────────────
  // ⚠️ `pairs` = array από [code,value] tuples → η τιμή του 91 είναι pairs[idx][1].
  const nPaths = parseInt(pairs[path91Index][1] ?? '0', 10) || 0;
  const boundaryPaths: Point2D[][] = [];
  let k = path91Index + 1;
  for (let p = 0; p < nPaths && k < pairs.length; p += 1) {
    while (k < pairs.length && pairs[k][0] !== '92') k += 1; // βρες αρχή path
    while (k < pairs.length && pairs[k][0] !== '93') k += 1; // βρες πλήθος κορυφών
    if (k >= pairs.length) break;
    const vCount = parseInt(pairs[k][1], 10) || 0;
    k += 1;
    const verts: Point2D[] = [];
    while (verts.length < vCount && k < pairs.length) {
      if (pairs[k][0] === '10') {
        const x = parseFloat(pairs[k][1]);
        const next = pairs[k + 1];
        if (next && next[0] === '20') {
          verts.push({ x, y: parseFloat(next[1]) });
          k += 2;
          continue;
        }
      }
      k += 1;
    }
    if (verts.length >= 3) boundaryPaths.push(verts);
  }

  if (!boundaryPaths.length) {
    dwarn('EntityConverter', `⚠️ Skipping HATCH ${index}: no usable boundary vertices`);
    return null;
  }

  // ── Seed points (98 + ακόλουθα 10/20) ───────────────────────────────────────
  const seedPoints: Point2D[] = [];
  const seed98 = pairs.findIndex(([c]) => c === '98');
  if (seed98 >= 0) {
    const nSeeds = parseInt(pairs[seed98][1] ?? '0', 10) || 0;
    let j = seed98 + 1;
    while (seedPoints.length < nSeeds && j < pairs.length - 1) {
      if (pairs[j][0] === '10' && pairs[j + 1][0] === '20') {
        seedPoints.push({ x: parseFloat(pairs[j][1]), y: parseFloat(pairs[j + 1][1]) });
        j += 2;
      } else j += 1;
    }
  }

  // Reuse SSoT ACI→hex (χειρίζεται ByLayer/ByBlock/invalid → undefined).
  const color = colorAci !== undefined ? extractEntityColor({ '62': String(colorAci) }) : undefined;

  return {
    id: `hatch_${index}`,
    type: 'hatch',
    layerId: layer,
    visible: true,
    boundaryPaths,
    patternName,
    patternType: solid ? 'solid' : 'pattern',
    fillType: solid ? 'solid' : (patternTypeCode === 0 ? 'user-defined' : 'predefined'),
    islandStyle: dxf75ToIslandStyle(islandCode),
    ...(angle !== undefined && !Number.isNaN(angle) && { patternAngle: angle, lineAngle: angle }),
    ...(scale !== undefined && !Number.isNaN(scale) && { patternScale: scale, lineSpacing: scale }),
    ...(seedPoints.length > 0 && { seedPoints }),
    ...(color && { color }),
  };
}

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
import {
  getHatchPattern,
  getSuggestedScale,
  type HatchPattern,
  type PatternLine,
} from '../data/hatch-pattern-catalog';
import { normalizeGradientType, type HatchGradient } from '../bim/hatch/hatch-gradient';
import { trueColorToHex } from './dxf-true-color';
import { radToDeg } from '../rendering/entities/shared/geometry-angle-utils';
import { dwarn } from '../debug';

type DxfPairs = ReadonlyArray<readonly [string, string]>;

/**
 * Normalized inputs for assembling a `type:'hatch'` scene entity, shared by BOTH hatch
 * import paths (ADR-635 Φ C.6):
 *   - `convertHatch` (native HATCH entity — modern DXF, ADR-507)
 *   - `tryConvertInsertHatch` (R12/AC1009 associative-hatch INSERT via `ACAD/HATCH` XDATA)
 *
 * Keeping the fillType resolution + scale-idempotency + entity shape in ONE builder means the
 * two importers can never drift (N.18: no sibling clone of the ~50-line assembly).
 */
export interface HatchAssemblyInput {
  id: string;
  layer: string;
  boundaryPaths: Point2D[][];
  patternName: string | undefined;
  solid: boolean;
  /** DXF group 76 (0 = user-defined line family, else predefined). Default 1 when absent. */
  patternTypeCode: number;
  /** DXF group 75 island style code. */
  islandCode: number;
  /** Pattern angle in DEGREES (undefined ⇒ omit). */
  angle: number | undefined;
  /** EFFECTIVE pattern scale as written in the file (undefined ⇒ omit). */
  scale: number | undefined;
  color: string | undefined;
  seedPoints?: Point2D[];
  gradient?: HatchGradient;
  inlinePattern?: HatchPattern;
}

/**
 * Assemble the final `type:'hatch'` scene entity from normalized inputs (SSoT for both hatch
 * importers). Applies the scale idempotency for catalog patterns: the writer emits the EFFECTIVE
 * scale (= suggested × user) at group 41, so a catalog hit re-derives the user multiplier
 * (`scale / suggested`) to avoid double-scaling at render (ADR-507 Φ6). Gradient/inline patterns
 * and the user-defined line-family fields are optional.
 */
export function buildHatchSceneEntity(input: HatchAssemblyInput): AnySceneEntity {
  const {
    id, layer, boundaryPaths, patternName, solid, patternTypeCode, islandCode,
    angle, scale, color, seedPoints = [], gradient, inlinePattern,
  } = input;

  const fillType = gradient ? 'gradient'
    : solid ? 'solid' : (patternTypeCode === 0 ? 'user-defined' : 'predefined');

  let patternScale = scale;
  if (fillType === 'predefined') {
    const catalogHit = getHatchPattern(patternName);
    if (catalogHit) {
      const suggested = getSuggestedScale(patternName);
      if (scale !== undefined && !Number.isNaN(scale) && suggested > 0) patternScale = scale / suggested;
    }
  }

  const hasAngle = angle !== undefined && !Number.isNaN(angle);
  const hasScale = patternScale !== undefined && !Number.isNaN(patternScale);
  const userDefined = fillType === 'user-defined';

  return {
    id,
    type: 'hatch',
    layerId: layer,
    visible: true,
    boundaryPaths,
    patternName,
    patternType: gradient ? 'gradient' : solid ? 'solid' : 'pattern',
    fillType,
    islandStyle: dxf75ToIslandStyle(islandCode),
    // patternAngle = γενική γωνία· lineAngle/lineSpacing είναι user-defined έννοιες
    // (μην τα γεμίζεις σε predefined — εκεί χρησιμοποιείται patternAngle/patternScale).
    ...(hasAngle && { patternAngle: angle, ...(userDefined && { lineAngle: angle }) }),
    ...(hasScale && { patternScale, ...(userDefined && { lineSpacing: patternScale }) }),
    ...(inlinePattern && { inlinePattern }),
    ...(gradient && { gradient }),
    ...(seedPoints.length > 0 && { seedPoints }),
    ...(color && { color }),
  };
}

/**
 * i18n key (N.11) για inline-imported pattern. ΔΕΝ εμφανίζεται στο UI dropdown (το
 * inlinePattern ζει ανά entity, όχι στο catalog) — απλώς ικανοποιεί τον τύπο
 * `HatchPattern`. Κλειδί, ΟΧΙ hardcoded label.
 */
const INLINE_PATTERN_LABEL_KEY = 'ribbon.commands.hatchEditor.patterns.imported';

/**
 * Διαβάζει τις inline pattern definition lines ενός HATCH (group `78` = πλήθος, ανά
 * γραμμή `53` γωνία / `43,44` origin / `45,46` delta / `79` πλήθος dash / `49×` dash)
 * → `PatternLine[]`. Οι τιμές μένουν **απόλυτες** (όπως γράφτηκαν, σε world mm) ώστε
 * το round-trip να αναπαράγει 1:1 το μοτίβο για third-party DXF εκτός catalog.
 *
 * @see AutoCAD DXF Reference: HATCH pattern data (codes 53/43/44/45/46/79/49)
 */
function parseInlinePatternLines(pairs: DxfPairs, idx78: number): PatternLine[] {
  const n = parseInt(pairs[idx78]?.[1] ?? '0', 10) || 0;
  if (n <= 0) return [];
  const lines: PatternLine[] = [];
  let i = idx78 + 1;
  // Κωδικοί που σηματοδοτούν τέλος του pattern section (pixel size / seeds / επόμενη οντότητα).
  const isSectionEnd = (c: string): boolean => c === '47' || c === '98' || c === '0';

  for (let li = 0; li < n && i < pairs.length; li += 1) {
    while (i < pairs.length && pairs[i][0] !== '53') {
      if (isSectionEnd(pairs[i][0])) return lines;
      i += 1;
    }
    if (i >= pairs.length) break;
    const angle = parseFloat(pairs[i][1]);
    i += 1;
    let ox = 0; let oy = 0; let dx = 0; let dy = 0;
    const dashes: number[] = [];
    while (i < pairs.length && pairs[i][0] !== '53' && !isSectionEnd(pairs[i][0])) {
      const [c, v] = pairs[i];
      switch (c) {
        case '43': ox = parseFloat(v); break;
        case '44': oy = parseFloat(v); break;
        case '45': dx = parseFloat(v); break;
        case '46': dy = parseFloat(v); break;
        case '49': dashes.push(parseFloat(v)); break;
        default: break; // 79 (dash count) → implicit μέσω συλλογής όλων των 49
      }
      i += 1;
    }
    lines.push({ angle, origin: [ox, oy], delta: [dx, dy], dashes });
  }
  return lines;
}

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
  let idx78 = -1;
  // ── Gradient (DXF 450-470, ADR-507 Φ5) ──────────────────────────────────────
  let gradientFlag = 0;            // 450: 1=gradient
  let gradientSingle = 0;          // 452: 1=single-color
  let gradientAngleRad: number | undefined; // 460 (radians)
  let gradientShift: number | undefined;    // 461
  let gradientTint: number | undefined;     // 462
  let gradientName: string | undefined;     // 470
  const gradientTrueColors: number[] = [];  // 421 (RGB int), σε σειρά

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
      case '450': gradientFlag = parseInt(value, 10) || 0; break;
      case '452': gradientSingle = parseInt(value, 10) || 0; break;
      case '460': if (gradientAngleRad === undefined) gradientAngleRad = parseFloat(value); break;
      case '461': if (gradientShift === undefined) gradientShift = parseFloat(value); break;
      case '462': if (gradientTint === undefined) gradientTint = parseFloat(value); break;
      case '470': if (gradientName === undefined) gradientName = value; break;
      case '421': { const n = parseInt(value, 10); if (Number.isFinite(n)) gradientTrueColors.push(n); break; }
      case '78': if (idx78 < 0) idx78 = i; break;
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

  // ── Gradient build (DXF 450-470, ADR-507 Φ5) — υπερισχύει solid/pattern ──────
  let gradient: HatchGradient | undefined;
  if (gradientFlag === 1 && gradientTrueColors.length > 0) {
    const color1 = trueColorToHex(gradientTrueColors[0]);
    const color2 = gradientTrueColors.length > 1 ? trueColorToHex(gradientTrueColors[1]) : undefined;
    const single = gradientSingle === 1;
    gradient = {
      type: normalizeGradientType(gradientName),
      color1,
      ...(color2 !== undefined && !single && { color2 }),
      ...(single && { singleColor: true }),
      ...(gradientTint !== undefined && !Number.isNaN(gradientTint) && { tint: gradientTint }),
      ...(gradientAngleRad !== undefined && !Number.isNaN(gradientAngleRad)
        && { angleDeg: radToDeg(gradientAngleRad) }),
      ...(gradientShift !== undefined && !Number.isNaN(gradientShift) && { shift: gradientShift }),
    };
  }

  // ── Inline pattern (ADR-507 Φ6) — catalog MISS only ─────────────────────────
  // Για άγνωστο όνομα (third-party DXF εκτός catalog) διάβασε τις inline γραμμές → render
  // 1:1 ώστε να ΜΗΝ μένει αόρατη η γραμμοσκίαση. Η scale idempotency για catalog-hit ζει
  // πλέον στον shared `buildHatchSceneEntity` (SSoT — no twin).
  const isPredefined = !gradient && !solid && patternTypeCode !== 0;
  let inlinePattern: HatchPattern | undefined;
  if (isPredefined && !getHatchPattern(patternName) && idx78 >= 0) {
    const lines = parseInlinePatternLines(pairs, idx78);
    if (lines.length > 0) {
      inlinePattern = {
        name: patternName ?? 'IMPORTED',
        labelKey: INLINE_PATTERN_LABEL_KEY,
        category: 'special',
        lines,
      };
    }
  }

  return buildHatchSceneEntity({
    id: `hatch_${index}`,
    layer,
    boundaryPaths,
    patternName,
    solid,
    patternTypeCode,
    islandCode,
    angle,
    scale,
    color,
    seedPoints,
    gradient,
    inlinePattern,
  });
}

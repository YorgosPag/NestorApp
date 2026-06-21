/**
 * Hatch property SSoT (ADR-507).
 *
 * ΕΝΑ σημείο αλήθειας για semantic ιδιότητες της γραμμοσκίασης + το αμφίδρομο
 * mapping islandStyle ↔ DXF code 75. Καταναλωτές: `HatchRenderer` (canvas),
 * `dxf-ascii-writer` (export), `dxf-entity-converters` (import). Έτσι το «είναι
 * solid;» και το «code 75 ↔ island» ορίζονται ΜΙΑ φορά (N.12 — αλλιώς η ίδια
 * λογική τριπλασιάζεται σε render/write/read).
 *
 * Leaf module: type-only import από `types/entities` (μηδέν runtime dep → μηδέν κύκλος).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { HatchEntity, LineweightMm } from '../../types/entities';
import { lineweightToPx, isConcreteLineweight } from '../../config/lineweight-iso-catalog';

/** Island/fill style — παράγεται από τον τύπο (SSoT, μηδέν χειροκίνητο literal). */
export type HatchIslandStyle = NonNullable<HatchEntity['islandStyle']>;

/**
 * Fallback πάχος γραμμών μοτίβου (px) όταν η γραμμοσκίαση δεν έχει concrete
 * `lineweightMm` (ByLayer/default) — η ιστορική προεπιλογή (zero regression).
 */
export const DEFAULT_HATCH_LINE_WIDTH_PX = 0.5;

/**
 * Πάχος γραμμών μοτίβου (px) από το `lineweightMm` (ADR-507 Φ2). **Zoom-independent
 * (AutoCAD LWT)** μέσω του mm→px SSoT `lineweightToPx`· μη-concrete (ByLayer/-2 /
 * undefined) → ιστορικό fallback. Floor στο fallback ώστε λεπτές τιμές να φαίνονται.
 *
 * Leaf-safe: ζει εδώ (όχι στον HatchRenderer) ώστε να είναι unit-testable χωρίς να
 * τραβά το βαρύ render import chain.
 */
export function resolveHatchLineWidthPx(
  lineweightMm: LineweightMm | null | undefined,
): number {
  if (!isConcreteLineweight(lineweightMm)) return DEFAULT_HATCH_LINE_WIDTH_PX;
  return Math.max(DEFAULT_HATCH_LINE_WIDTH_PX, lineweightToPx(lineweightMm));
}

/** Τα μόνα πεδία που χρειάζεται ο solid-έλεγχος (loose ώστε να δέχεται writer carriers). */
type SolidProbe = Pick<HatchEntity, 'fillType' | 'patternType' | 'patternName'>;

/**
 * SSoT: είναι συμπαγής (solid fill) η γραμμοσκίαση; Προτεραιότητα `fillType` →
 * `patternType` → όνομα μοτίβου `SOLID`.
 */
export function isSolidHatch(hatch: SolidProbe): boolean {
  if (hatch.fillType) return hatch.fillType === 'solid';
  if (hatch.patternType) return hatch.patternType === 'solid';
  return (hatch.patternName ?? '').toUpperCase() === 'SOLID';
}

/** SSoT: islandStyle → DXF code 75 (normal=0, outer=1, ignore=2). */
export function islandStyleToDxf75(style: HatchEntity['islandStyle']): number {
  return style === 'outer' ? 1 : style === 'ignore' ? 2 : 0;
}

/** SSoT: DXF code 75 → islandStyle (αντίστροφο του `islandStyleToDxf75`). */
export function dxf75ToIslandStyle(code: number): HatchIslandStyle {
  return code === 1 ? 'outer' : code === 2 ? 'ignore' : 'normal';
}

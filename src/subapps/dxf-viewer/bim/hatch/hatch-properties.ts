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

import type { HatchEntity } from '../../types/entities';

/** Island/fill style — παράγεται από τον τύπο (SSoT, μηδέν χειροκίνητο literal). */
export type HatchIslandStyle = NonNullable<HatchEntity['islandStyle']>;

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

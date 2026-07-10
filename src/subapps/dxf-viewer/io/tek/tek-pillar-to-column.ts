/**
 * ADR-531 Φ5b.5 (Tekton .TEK IMPORT — BIM structural) — mapper `TekPillarRecord` → **native BIM**
 * `ColumnEntity` (κολώνα / τοιχίο). Ο Τέκτων αποθηκεύει κολώνες & τοιχία ως `<pillar>1` records
 * μέσα στο `<wall>` container· εδώ γίνονται δική μας παραμετρική BIM οντότητα (editable/grips/
 * properties/3Δ), ΜΙΑ οντότητα «δύο όψεις» (3Δ όγκος + 2Δ κάτοψη) — ίδιο pattern με τον τοίχο Φ5b.2.
 *
 * Reuse (μηδέν geometry-math / builder duplication — μοτίβο `tek-wall-to-bim` / `tek-plane-to-slab`):
 *   - matrix decode (centered box/circle) → SSoT `decodePillarXMatrix` (`tek-geometry.ts`).
 *   - Y-flip + units → SSoT `tekMetersToScene`.
 *   - column build → `buildDefaultColumnParams` + `buildColumnEntity`.
 *   - **κολώνα↔τοιχίο** ταξινόμηση → SSoT `roundedRectAspect` + `isShearWallAspect`
 *     (EC8 §5.4.2.4 / EC2 §9.6.1: σχέση μεγάλης/μικρής πλευράς > 4 → τοιχίο· απόφαση Giorgio 2026-07-10).
 *   - χρώμα → SSoT `tekColorToHex`.
 *
 * @module io/tek/tek-pillar-to-column
 */

import { type SceneUnits } from '../../utils/scene-units';
import { decodePillarXMatrix, tekMetersToScene } from '../../export/core/tek/tek-geometry';
import { tekColorToHex } from './tek-color';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  type ColumnParamOverrides,
} from '../../hooks/drawing/column-completion';
import { roundedRectAspect, isShearWallAspect } from '../../bim/columns/column-aspect';
import type { ColumnEntity, ColumnKind } from '../../bim/types/column-types';
import type { TekPillarRecord } from './tek-import-types';

/** Αποτέλεσμα mapping ενός `<pillar>`: η BIM κολώνα (ή `null` αν απορριφθεί) + προειδοποιήσεις. */
export interface TekColumnResult {
  readonly column: ColumnEntity | null;
  readonly warnings: readonly string[];
}

/**
 * Επιλέγει `ColumnKind` από το record: `<round>1` → κυκλική· αλλιώς η σχέση πλευρών κρίνει
 * κολώνα (`rectangular`) vs τοιχίο (`shear-wall`) μέσω του SSoT κατωφλιού (EC8 > 4).
 */
function resolvePillarKind(round: boolean, widthMm: number, depthMm: number): ColumnKind {
  if (round) return 'circular';
  return isShearWallAspect(roundedRectAspect(widthMm, depthMm)) ? 'shear-wall' : 'rectangular';
}

/**
 * Map ενός `TekPillarRecord` → BIM `ColumnEntity`. Κέντρο → scene (Y-flip)· width/depth → mm·
 * γωνία u-άξονα → μοίρες CCW (αρνημένη λόγω Y-down)· `height`→mm· `elevation`→`baseOffset` (mm)·
 * χρώμα `tekColorToHex`. `autoSized:false` (ADR-398 §3.17) ⇒ η διατομή μένει ΑΚΡΙΒΩΣ όση εισήχθη
 * (ο auto-sizer δεν τη «φουσκώνει»). Αποτυχία builder → warning + `null`.
 */
export function tekPillarToColumnEntity(
  rec: TekPillarRecord,
  levelId: string,
  sceneUnits: SceneUnits = 'mm',
): TekColumnResult {
  const warnings: string[] = [];
  const { center, widthM, depthM, rotationRad } = decodePillarXMatrix(rec.matrix);
  const centerScene = tekMetersToScene(center.x, center.y, sceneUnits);
  const widthMm = widthM * 1000;
  const depthMm = depthM * 1000;
  // Y-flip: CCW γωνία σε Tekton Y-up → −γωνία σε καμβά Y-down (mirror του tekMetersToScene).
  const rotationDeg = -rotationRad * (180 / Math.PI);
  const kind = resolvePillarKind(rec.round, widthMm, depthMm);

  const overrides: ColumnParamOverrides = {
    kind,
    // Κυκλική: `width` = διάμετρος (Ø)· `depth`/`rotation` αγνοούνται (column-types §circular).
    width: widthMm,
    ...(kind === 'circular' ? {} : { depth: depthMm, rotation: rotationDeg }),
    ...(rec.heightM > 0 ? { height: rec.heightM * 1000 } : {}),
    baseOffset: rec.elevationM * 1000,
    autoSized: false,
  };
  const params = buildDefaultColumnParams(centerScene, kind, overrides, sceneUnits);
  const res = buildColumnEntity(params, levelId, sceneUnits);
  if (!res.ok) {
    warnings.push(`Κολώνα .tek παραλείφθηκε: ${res.hardErrors.join('; ')}`);
    return { column: null, warnings };
  }
  return { column: { ...res.entity, color: tekColorToHex(rec.color) }, warnings };
}

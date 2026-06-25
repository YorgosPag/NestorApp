/**
 * ADR-526 (Tekton .TEK IMPORT) — `TekParseResult` → `SceneModel` (pure).
 *
 * Ο καθρέφτης (read-side) του `DxfSceneBuilder.buildScene`: παίρνει τα parsed Tekton
 * δεδομένα και παράγει ένα `SceneModel` έτοιμο για `setLevelScene`. Φ1 περιλαμβάνει
 * ΜΟΝΟ σκάλες· οι υπόλοιπες κατηγορίες entity (τοίχοι/κολώνες/δοκοί…) προστίθενται
 * σε επόμενες φάσεις πάνω στον ΙΔΙΟ builder.
 *
 * Μονάδες σκηνής: **mm** (ο Τέκτων είναι μετρικός — 1 m = 1000 mm)· τα bounds
 * προκύπτουν από το ΥΠΟΛΟΓΙΣΜΕΝΟ `geometry.bbox` κάθε σκάλας (η πραγματική έκταση
 * σχεδίασης), όχι από τις ακατέργαστες κορυφές.
 */

import type { SceneUnits } from '../../utils/scene-units';
import type { SceneModel, SceneBounds } from '../../types/scene-types';
import type { Entity } from '../../types/entities';
import { calculateBimEntity2DBounds } from '../../bim/utils/bim-bounds';
import { tekStairToEntity } from './tek-stair-to-bim';
import type { TekParseResult } from './tek-import-types';

/** Default bounds όταν δεν υπάρχει καμία σκάλα (κενή σκηνή). */
const EMPTY_BOUNDS: SceneBounds = { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } };

/**
 * Ένωση των 2D bounds όλων των entities → SceneBounds. Το per-entity bbox προβάλλεται
 * μέσω του SSoT `calculateBimEntity2DBounds` (έχει `case 'stair'`) — μηδέν inline bbox read.
 */
function boundsFromEntities(entities: readonly Entity[]): SceneBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entities) {
    const b = calculateBimEntity2DBounds(e);
    if (!b) continue;
    minX = Math.min(minX, b.min.x); minY = Math.min(minY, b.min.y);
    maxX = Math.max(maxX, b.max.x); maxY = Math.max(maxY, b.max.y);
  }
  if (!Number.isFinite(minX)) return EMPTY_BOUNDS;
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

export interface TekSceneBuildResult {
  readonly scene: SceneModel;
  readonly warnings: readonly string[];
}

/**
 * Χτίζει `SceneModel` από parsed Tekton δεδομένα. Κάθε `<stair>` → `StairEntity`
 * μέσω του SSoT mapper. Το `levelId` ανατίθεται σε όλες τις σκάλες του ορόφου-στόχου.
 */
export function buildSceneFromTekStairs(
  parsed: TekParseResult,
  levelId: string,
  units: SceneUnits = 'mm',
): TekSceneBuildResult {
  const entities: Entity[] = parsed.stairs.map((rec) => tekStairToEntity(rec, levelId, units));
  const warnings = [...parsed.warnings];
  if (entities.length === 0) {
    warnings.push('Δεν βρέθηκε καμία σκάλα στο .tek αρχείο.');
  }
  const scene: SceneModel = {
    entities,
    layersById: {},
    bounds: boundsFromEntities(entities),
    units,
    version: parsed.tektonVersion ?? undefined,
  };
  return { scene, warnings };
}

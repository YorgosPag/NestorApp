'use client';

/**
 * ADR-422 L1 — Συλλογή active-floor inputs για τον heat-load engine (SSoT).
 *
 * ΕΝΑ σημείο που μαζεύει ό,τι χρειάζεται ο `deriveSpaceHeatLoads`/engine από το
 * scene + το κτίριο του ενεργού ορόφου:
 *   - θερμικοί χώροι / τοίχοι / κουφώματα (filter BIM entities)
 *   - εξωτερικοί τοίχοι (`computeEnvelopePerimeter` — spec-free· μηδέν εξάρτηση
 *     από εφαρμοσμένο ETICS spec)
 *   - `Te` από `Building.climateZone` (ΤΟΤΕΕ 20701-3· fallback ζώνη Β)
 *   - θέση ορόφου στη στοίβα (δάπεδο ground vs ενδιάμεσο, στέγη vs οροφή)
 *   - `sceneUnits` + ανοχή αντιστοίχισης σε scene units
 *
 * Καταναλώνεται ΚΑΙ από το `HeatLoadOverlay` (όλοι οι χώροι) ΚΑΙ από το contextual
 * tab bridge (επιλεγμένος χώρος) → καμία διπλή λογική. Ο caller δίνει το BIM
 * `SceneModel` (reactivity) + το `active` gate· χωρίς scene/active → `null`.
 *
 * @see ../../bim/thermal/heat-load/derive-space-heat-loads (consumer math)
 * @see ./useSpaceHeatLoads (overlay wrapper) · της ίδιας οικογένειας με useBuildingFloorScenes
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import { useMemo } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { isWallEntity, isOpeningEntity, isThermalSpaceEntity } from '../../types/entities';
import {
  computeEnvelopePerimeter,
  type WallForEnvelope,
} from '../../bim/geometry/envelope-perimeter';
import {
  resolveSceneUnits,
  sceneUnitsToMeters,
  type SceneUnits,
} from '../../utils/scene-units';
import {
  getDesignOutdoorTempC,
  type ClimateZone,
} from '../../bim/thermal/kenak-thermal-config';
import type { StoreyPosition } from '../../bim/thermal/heat-load/space-boundary-resolver';
import type { SpaceHeatLoadDeriveInputs } from '../../bim/thermal/heat-load/derive-space-heat-loads';
import type { ThermalSpaceEntity } from '../../bim/types/thermal-space-types';
import type { SceneModel } from '../../types/scene';

/**
 * Ανοχή αντιστοίχισης ορίου χώρου → όψης τοίχου (m). Καλύπτει το offset μεταξύ
 * footprint (εσωτ. όψη) και όψεων τοίχου + snapping noise — μετατρέπεται σε scene
 * units ανά μονάδα σχεδίου.
 */
const HEAT_LOAD_MATCH_TOL_M = 0.35;

/** Default κλιματική ζώνη όταν το κτίριο δεν έχει ορίσει — Β (ηπειρωτική). */
const FALLBACK_CLIMATE_ZONE: ClimateZone = 'B';

/** Active-floor bundle: τα inputs του engine + οι χώροι (για το overlay). */
export interface HeatLoadInputsBundle extends SpaceHeatLoadDeriveInputs {
  readonly spaces: readonly ThermalSpaceEntity[];
  readonly sceneUnits: SceneUnits;
  /** Κλιματική ζώνη ορόφου (ΤΟΤΕΕ· για ΚΕΝΑΚ έλεγχο κελύφους L6). */
  readonly climateZone: ClimateZone;
}

/** Κλιματική ζώνη του κτιρίου (fallback Β όταν δεν έχει οριστεί). SSoT για Te + U_max. */
function resolveClimateZone(
  buildings: ReadonlyArray<{ id: string; climateZone?: 'A' | 'B' | 'C' | 'D' }>,
  buildingId: string | null,
): ClimateZone {
  const z = buildings.find((b) => b.id === buildingId)?.climateZone;
  return z === 'A' || z === 'B' || z === 'C' || z === 'D' ? z : FALLBACK_CLIMATE_ZONE;
}

/** Θέση ορόφου: floors ταξινομημένα αύξοντα (basement→up) → lowest/highest/middle. */
function resolveStoreyPosition(
  floors: ReadonlyArray<{ id: string }>,
  activeFloorId: string | null,
): StoreyPosition {
  if (!activeFloorId || floors.length <= 1) return 'only';
  if (floors[0].id === activeFloorId) return 'lowest';
  if (floors[floors.length - 1].id === activeFloorId) return 'highest';
  return 'middle';
}

/** Εξωτερικοί τοίχοι = όσοι ανήκουν σε αλυσίδα κελύφους (spec-free perimeter). */
function resolveExteriorWallIds(
  walls: readonly WallForEnvelope[],
  sceneUnits: SceneUnits,
): Set<string> {
  const { chains } = computeEnvelopePerimeter(walls, 0, sceneUnits);
  const set = new Set<string>();
  for (const chain of chains) for (const id of chain.wallIds) set.add(id);
  return set;
}

export function useHeatLoadInputs(
  scene: SceneModel | null | undefined,
  active: boolean,
): HeatLoadInputsBundle | null {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;

  const activeLevel = useMemo(
    () => (active && levels ? levels.find((l) => l.id === currentLevelId) ?? null : null),
    [active, levels, currentLevelId],
  );
  const buildingId = activeLevel?.buildingId ?? null;
  const activeFloorId = activeLevel?.floorId ?? null;

  const { buildings } = useFirestoreBuildings();
  const { floors } = useFloorsByBuilding(buildingId, active);

  return useMemo<HeatLoadInputsBundle | null>(() => {
    if (!active || !scene) return null;
    const entities = scene.entities;
    const spaces = entities.filter(isThermalSpaceEntity);
    if (spaces.length === 0) return null;

    const walls = entities.filter(isWallEntity);
    const openings = entities.filter(isOpeningEntity);
    const sceneUnits = resolveSceneUnits(scene);
    const climateZone = resolveClimateZone(buildings, buildingId);

    return {
      spaces,
      walls,
      openings,
      sceneUnits,
      climateZone,
      exteriorWallIds: resolveExteriorWallIds(walls, sceneUnits),
      outdoorTempC: getDesignOutdoorTempC(climateZone),
      storeyPosition: resolveStoreyPosition(floors, activeFloorId),
      tol: HEAT_LOAD_MATCH_TOL_M / sceneUnitsToMeters(sceneUnits),
    };
  }, [active, scene, buildings, buildingId, floors, activeFloorId]);
}

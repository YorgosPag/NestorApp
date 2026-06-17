'use client';

/**
 * useBuildingOccupancy — ADR-474 (structural occupancy SSoT inheritance).
 *
 * Επιστρέφει τη **structural occupancy** (EN1991-1-1) που κληρονομείται από τη γενική
 * κατηγορία (`Building.category`) του κτιρίου στο οποίο ανήκει ο **ενεργός όροφος**
 * (DXF level → `buildingId` → building doc → category). Έτσι η «χρήση κτιρίου» έχει
 * **μία πηγή** (το building doc)· τα auto area loads (g_k/q_k) παράγονται από εκεί
 * χωρίς ξεχωριστή είσοδο. Per-building override = `structuralSettings.occupancy`
 * (έχει προτεραιότητα — το συνθέτει ο caller takedown hook).
 *
 * Mirror του `useBuildingStoreyCount` (ίδιο active-level → buildingId pattern).
 * Χωρίς ενεργό level / building → `undefined` (πέφτει σε default residential).
 *
 * @see ./useBuildingStoreyCount.ts — το αδελφό building-scoped hook
 * @see ../bim/structural/loads/occupancy-loads.ts — resolveOccupancyFromBuildingCategory
 * @see docs/centralized-systems/reference/adrs/ADR-474-occupancy-driven-auto-loads.md
 */

import { useMemo } from 'react';
import { useLevelsOptional } from '../systems/levels/useLevels';
import { useBuildingById } from './data/useBuildingById';
import {
  resolveOccupancyFromBuildingCategory,
  type OccupancyCategory,
} from '../bim/structural/loads/occupancy-loads';

export function useBuildingOccupancy(): OccupancyCategory | undefined {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;

  const buildingId = useMemo(
    () => levels?.find((l) => l.id === currentLevelId)?.buildingId ?? null,
    [levels, currentLevelId],
  );

  const { building } = useBuildingById(buildingId, buildingId != null);

  return useMemo(
    () => resolveOccupancyFromBuildingCategory(building?.category),
    [building?.category],
  );
}

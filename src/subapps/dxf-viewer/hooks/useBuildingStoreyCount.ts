'use client';

/**
 * useBuildingStoreyCount — ADR-464 Slice 4 (counted-storey SSoT for load takedown).
 *
 * Επιστρέφει το πλήθος των **μετρούμενων ορόφων** (counted storeys) του κτιρίου στο
 * οποίο ανήκει ο **ενεργός όροφος** (DXF level → `buildingId`), εξαιρώντας τα special
 * levels (θεμελίωση/στέγη/απόληξη — ADR-461) μέσω του `countBuildingStoreys` SSoT.
 *
 * Πηγή = `useFloorsByBuilding(activeLevel.buildingId)` — **η ίδια** που χρησιμοποιούν
 * τα storey-aware features (θερμικά/ADR-448), ΟΧΙ το `ProjectHierarchy.selectedBuilding`
 * (που είναι κενό στο standalone DXF route). Memoized number → σταθερό dep για
 * effects που το καταναλώνουν (takedown / footing design checks).
 *
 * Χωρίς ενεργό level / building link → 0 (takedown αδρανές).
 *
 * @see @/utils/floor-naming — countBuildingStoreys
 * @see ./data/useHeatLoadInputs.ts — το ίδιο floors source pattern
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import { useMemo } from 'react';
import { countBuildingStoreys, type FloorKind } from '@/utils/floor-naming';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useLevelsOptional } from '../systems/levels/useLevels';

export function useBuildingStoreyCount(): number {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;

  const buildingId = useMemo(
    () => levels?.find((l) => l.id === currentLevelId)?.buildingId ?? null,
    [levels, currentLevelId],
  );

  const { floors } = useFloorsByBuilding(buildingId, buildingId != null);

  return useMemo(() => {
    if (!Array.isArray(floors)) return 0;
    return countBuildingStoreys(floors as ReadonlyArray<{ kind?: FloorKind }>);
  }, [floors]);
}

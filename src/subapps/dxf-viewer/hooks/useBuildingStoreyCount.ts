'use client';

/**
 * useBuildingStoreyCount — ADR-464 Slice 4 (counted-storey SSoT for load takedown).
 *
 * Επιστρέφει το πλήθος των **μετρούμενων ορόφων** (counted storeys) του ενεργού
 * κτιρίου, εξαιρώντας τα special levels (θεμελίωση/στέγη/απόληξη — ADR-461) μέσω του
 * `countBuildingStoreys` SSoT. Πηγή = `ProjectHierarchyContext.selectedBuilding.floors`
 * (η ίδια λίστα που τροφοδοτεί το «Όροφοι: N»). Memoized number → σταθερό dep για
 * effects που το καταναλώνουν (takedown / footing design checks).
 *
 * Optional context: standalone DXF χωρίς building hierarchy → 0 (takedown αδρανές).
 *
 * @see @/utils/floor-naming — countBuildingStoreys
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import { useMemo } from 'react';
import { countBuildingStoreys, type FloorKind } from '@/utils/floor-naming';
import { useProjectHierarchyOptional } from '../contexts/ProjectHierarchyContext';

export function useBuildingStoreyCount(): number {
  const hierarchy = useProjectHierarchyOptional();
  const floors = hierarchy?.selectedBuilding?.floors;
  return useMemo(() => {
    if (!Array.isArray(floors)) return 0;
    return countBuildingStoreys(floors as ReadonlyArray<{ kind?: FloorKind }>);
  }, [floors]);
}

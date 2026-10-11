'use client';

/**
 * useBuildingFloorLevels — το κτήριο του ανοιχτού επιπέδου, οι όροφοί του και **ένα επίπεδο ανά
 * όροφο** (ADR-914 §2.14).
 *
 * Η κοινή «κεφαλή» των aggregators «όλοι οι όροφοι»: ποιο κτήριο, ποιες υψομετρικές στάθμες
 * (η ίδια συνδρομή `FLOORS` με τις καρτέλες ορόφων — κοινή, με καταμέτρηση αναφορών) και ποιο
 * επίπεδο μιλά για κάθε όροφο (`floorRepresentativeLevels`, ADR-914 §2.10). Ζούσε αντιγραμμένη
 * σε τέσσερα hooks· κάθε ένα κρατά πλέον μόνο τη **δική του** μετατροπή επιπέδου → στόχου.
 *
 * `active === false` ⇒ κανένα κτήριο, καμία συνδρομή, κενή λίστα.
 *
 * @see ../../systems/levels/level-floor-representative — ο κανόνας του εκπροσώπου
 * @see docs/centralized-systems/reference/adrs/ADR-914-open-create-entry.md §2.14
 */

import { useMemo } from 'react';
import { useFloorsByBuilding, type FloorOption } from '@/components/properties/shared/useFloorsByBuilding';
import {
  floorRepresentativeLevels,
  type FloorBoundLevel,
  type FloorKeyedLevel,
} from '../../systems/levels/level-floor-representative';

export interface BuildingFloorLevels<T extends FloorKeyedLevel> {
  /** Το ανοιχτό επίπεδο (`null` όταν ανενεργό ή άγνωστο). */
  readonly currentLevel: T | null;
  readonly buildingId: string | null;
  /** Οι όροφοι του κτηρίου με τις στάθμες τους (μέτρα, ADR-369). */
  readonly buildingFloors: FloorOption[];
  /** Ένα επίπεδο ανά όροφο του κτηρίου — ο εκπρόσωπος. */
  readonly floorLevels: readonly FloorBoundLevel<T>[];
}

const NO_LEVELS: readonly never[] = [];

export function useBuildingFloorLevels<T extends FloorKeyedLevel>(
  levels: readonly T[] | undefined,
  currentLevelId: string | null,
  active: boolean = true,
): BuildingFloorLevels<T> {
  const currentLevel = useMemo(
    () => (active && levels ? levels.find((l) => l.id === currentLevelId) ?? null : null),
    [active, levels, currentLevelId],
  );
  const buildingId = currentLevel?.buildingId ?? null;

  const { floors: buildingFloors } = useFloorsByBuilding(buildingId, Boolean(buildingId));

  const floorLevels = useMemo<readonly FloorBoundLevel<T>[]>(
    () => (levels && buildingId ? floorRepresentativeLevels(levels, buildingId, currentLevelId) : NO_LEVELS),
    [levels, buildingId, currentLevelId],
  );

  return { currentLevel, buildingId, buildingFloors, floorLevels };
}

'use client';

/**
 * ADR-452 — useCutPlaneRange: reactive cut-plane slider range for the currently-open
 * level's building. Datum math lives in the pure `./cut-plane-range` module so it is
 * testable without Firebase; this hook only wires the live floor list + active storey
 * ceiling into it. Returns `null` when there is no building/floor context.
 */

import { useMemo } from 'react';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useActiveStoreyContext } from '../../systems/levels/useActiveStoreySync';
import { computeCutPlaneRange, type CutPlaneRange } from './cut-plane-range';

export type { CutPlaneRange, CutPlaneTick } from './cut-plane-range';

/** Reactive hook: cut-plane range for the active level's building (null = no context). */
export function useCutPlaneRange(): CutPlaneRange | null {
  const ctx = useLevelsOptional();
  const activeLevel = ctx
    ? ctx.levels.find((l) => l.id === ctx.currentLevelId) ?? null
    : null;
  const buildingId = activeLevel?.buildingId ?? null;

  const { floors } = useFloorsByBuilding(buildingId, Boolean(buildingId));
  const storey = useActiveStoreyContext();

  return useMemo(
    () => computeCutPlaneRange(floors, storey?.nextFloorElevationMm ?? null),
    [floors, storey?.nextFloorElevationMm],
  );
}

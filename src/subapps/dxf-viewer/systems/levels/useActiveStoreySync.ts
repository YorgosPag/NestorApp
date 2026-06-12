'use client';

/**
 * useActiveStoreySync — the SOLE writer of {@link useActiveStoreyStore} (ADR-448 Phase 1).
 *
 * Resolves the active level → its building's floor list (`useFloorsByBuilding`, the
 * same canonical FLOORS source the multi-floor aggregator uses) → builds the
 * {@link ActiveStoreyContext} and publishes it to the store. Mounted once, next to
 * `useLevelId3DSync` (which already feeds `activeLevelId` to the 3D store).
 *
 * Readers: `resyncBimScene` (non-React, via `getState()`) and React consumers via
 * {@link useActiveStoreyContext}.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md
 */

import { useEffect, useMemo } from 'react';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useLevelsOptional } from './useLevels';
import { buildActiveStoreyContext, type ActiveStoreyContext } from './active-storey-context';
import { useActiveStoreyStore } from './active-storey-store';

export function useActiveStoreySync(currentLevelId: string | null): void {
  const levels = useLevelsOptional()?.levels;

  const activeLevel = useMemo(
    () => (currentLevelId && levels ? levels.find((l) => l.id === currentLevelId) ?? null : null),
    [levels, currentLevelId],
  );
  const buildingId = activeLevel?.buildingId ?? null;
  const floorId = activeLevel?.floorId ?? null;

  const { floors } = useFloorsByBuilding(buildingId, Boolean(buildingId));

  const context = useMemo(
    () => buildActiveStoreyContext(floors, floorId),
    [floors, floorId],
  );

  useEffect(() => {
    useActiveStoreyStore.getState().setContext(context);
  }, [context]);
}

/** Reactive reader for React consumers (Phase 2 BIM tool defaults). */
export function useActiveStoreyContext(): ActiveStoreyContext | null {
  return useActiveStoreyStore((s) => s.context);
}

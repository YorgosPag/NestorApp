import { useEffect } from 'react';
import { useBim3DEntitiesStore } from '../../bim-3d/stores/Bim3DEntitiesStore';

// ADR-366 Phase 4 — Feed active level ID to 3D entities store.
// Shell WRITES to store (no useSyncExternalStore — ADR-040 CHECK 6C compliant).
export function useLevelId3DSync(currentLevelId: string | null): void {
  useEffect(() => {
    useBim3DEntitiesStore.getState().setActiveLevelId(currentLevelId);
  }, [currentLevelId]);
}

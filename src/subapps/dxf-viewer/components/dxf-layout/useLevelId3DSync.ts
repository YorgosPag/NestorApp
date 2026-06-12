import { useEffect } from 'react';
import { useBim3DEntitiesStore } from '../../bim-3d/stores/Bim3DEntitiesStore';
import { useActiveStoreySync } from '../../systems/levels/useActiveStoreySync';

// ADR-366 Phase 4 — Feed active level ID to 3D entities store.
// Shell WRITES to store (no useSyncExternalStore — ADR-040 CHECK 6C compliant).
// ADR-448 Phase 1 — also derive + publish the Active Storey Context (storey-aware
// datum/height/kind) from the same active level, so the single-floor 3D render
// sits at the real FFL instead of a hardcoded 0.
export function useLevelId3DSync(currentLevelId: string | null): void {
  useEffect(() => {
    useBim3DEntitiesStore.getState().setActiveLevelId(currentLevelId);
  }, [currentLevelId]);

  useActiveStoreySync(currentLevelId);
}

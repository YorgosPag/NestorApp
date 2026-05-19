"use client";

import { useViewMode3DStore, selectIs3D, selectViewMode } from '../stores/ViewMode3DStore';

/**
 * Convenience hook for 2D/3D mode toggle.
 * Used by ribbon button and any mode-aware UI.
 */
export function useViewMode3D() {
  const mode = useViewMode3DStore(selectViewMode);
  const is3D = useViewMode3DStore(selectIs3D);
  const toggle2D3D = useViewMode3DStore((s) => s.toggle2D3D);
  const showAllFloors = useViewMode3DStore((s) => s.showAllFloors);
  const toggleShowAllFloors = useViewMode3DStore((s) => s.toggleShowAllFloors);

  return {
    mode,
    is3D,
    toggle2D3D,
    showAllFloors,
    toggleShowAllFloors,
  };
}

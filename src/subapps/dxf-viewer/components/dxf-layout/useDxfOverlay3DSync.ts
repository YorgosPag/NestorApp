import { useEffect } from 'react';
import { useDxfOverlay3DStore } from '../../bim-3d/stores/DxfOverlay3DStore';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';

// ADR-366 Phase 2 — Feed DXF overlay store whenever dxfScene changes.
// Shell WRITES to store (no useSyncExternalStore — ADR-040 CHECK 6C compliant).
export function useDxfOverlay3DSync(dxfScene: DxfScene | null): void {
  useEffect(() => {
    useDxfOverlay3DStore.getState().setDxfScene(dxfScene);
  }, [dxfScene]);
}

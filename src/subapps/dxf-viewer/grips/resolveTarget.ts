// src/subapps/dxf-viewer/grips/resolveTarget.ts
import { useOverlayStore } from '../overlays/overlay-store';
import type { Point2D } from '../rendering/types/Types';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { DEFAULT_BOUNDS } from '../config/geometry-constants';

export function resolveGripTarget(id: string, type: 'dxf'|'overlay') {
  if (type === 'overlay') {
    // Access overlay store to get overlay data
    // Note: This is a simplified implementation
    // In a real scenario, you'd need to access the store properly

    return {
      id,
      type,
      getVertices: () => {

        return []; // TODO: Get actual vertices from overlay store
      },
      getBBox: () => {
        // 🏢 ADR-118: Use centralized DEFAULT_BOUNDS for mock bbox
        return { ...DEFAULT_BOUNDS }; // TODO: Calculate real bbox
      },
      setVertex: (i: number, p: Point2D) => {

        // TODO: Update vertex in overlay store
      },
    };
  }
  
  // dxf - placeholder for now
  // 🏢 ADR-118: Use centralized DEFAULT_BOUNDS for mock bbox
  return {
    id,
    type,
    getVertices: () => [],
    getBBox: () => ({ ...DEFAULT_BOUNDS }),
    setVertex: (i: number, p: Point2D) => {

    },
  };
}
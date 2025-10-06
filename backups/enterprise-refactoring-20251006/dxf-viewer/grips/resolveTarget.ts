// src/subapps/dxf-viewer/grips/resolveTarget.ts
import { useOverlayStore } from '../overlays/overlay-store';
import type { Point2D } from '../rendering/types/Types';

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

        return { min: {x: 0, y: 0}, max: {x: 100, y: 100} }; // TODO: Calculate real bbox
      },
      setVertex: (i: number, p: Point2D) => {

        // TODO: Update vertex in overlay store
      },
    };
  }
  
  // dxf - placeholder for now

  return {
    id, 
    type,
    getVertices: () => [],
    getBBox: () => ({ min: {x: 0, y: 0}, max: {x: 100, y: 100} }),
    setVertex: (i: number, p: Point2D) => {

    },
  };
}
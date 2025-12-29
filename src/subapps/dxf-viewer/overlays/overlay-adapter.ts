// overlays/overlay-adapter.ts
import type { Point2D } from '../rendering/types/Types';
import type { Region, RegionStatus } from '../types/overlay';
import type { Overlay } from './types';
import { getStatusColors } from '../config/color-mapping';
import { UI_COLORS } from '../config/color-config';

export function overlaysToRegions(overlays: Overlay[]): Region[] {
  return overlays.map((ov) => {
    const status = (ov.status as RegionStatus) ?? 'for-sale';
    
    // Handle both flat [x1,y1,x2,y2...] and nested [[x1,y1],[x2,y2]...] formats
    let vertices: Point2D[];
    if (Array.isArray(ov.polygon) && ov.polygon.length > 0) {
      if (Array.isArray(ov.polygon[0])) {
        // Already nested format: [[x1,y1], [x2,y2], ...]
        vertices = (ov.polygon as [number, number][]).map(([x, y]) => ({ x, y } as Point2D));
      } else {
        // Flat format: [x1, y1, x2, y2, ...]
        const flatArray = ov.polygon as number[];
        vertices = Array.from({ length: flatArray.length / 2 }, (_, i) => ({
          x: flatArray[i * 2],
          y: flatArray[i * 2 + 1]
        } as Point2D));
      }
    } else {
      vertices = []; // Empty polygon
    }
    
    return {
      id: ov.id,
      vertices,
      status,
      layer: 'base',
      // 🔑 ΧΩΡΙΣ ΑΥΤΟ ΔΕΝ ΖΩΓΡΑΦΙΖΕΙ:
      visible: true,
      // Προαιρετικά/αισθητικά:
      opacity: ov.style?.opacity ?? 0.7,
      color: ov.style?.fill ?? getStatusColors(status)?.fill ?? UI_COLORS.INFO,
      levelId: ov.levelId,
      locked: false, // ✅ ENTERPRISE: Default false since locked property doesn't exist in Overlay interface
      metadata: { label: ov.label, kind: ov.kind },
      // Pass through the style from overlay
      style: ov.style
    };
  });
}
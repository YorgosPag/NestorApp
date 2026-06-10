/**
 * drawing-preview-tool-points — reconstructs the `tempPoints` tuple consumed by the
 * rubber-band preview for BIM tools that run their own placement state machine outside
 * `machineContext.points` (stair/wall/slab/roof/beam). Pure: reads each tool's preview
 * SSoT store and returns the point list `generatePreviewEntity` expects.
 *
 * Extracted from `useUnifiedDrawing` (N.7.1 500-line cap). No behavior change.
 */

import type { Point2D } from '../../rendering/types/Types';
// ADR-358 Phase 8 — stair preview SSoT (basePoint+direction).
import { stairPreviewStore } from '../../bim/stairs/stair-preview-store';
// ADR-363 Phase 1C — wall preview SSoT (same single-writer pattern as stair).
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
// ADR-363 Phase 6.5.B — slab preview SSoT.
import { slabPreviewStore } from '../../bim/slabs/slab-preview-store';
// ADR-417 — roof footprint preview SSoT.
import { roofPreviewStore } from '../../bim/roofs/roof-preview-store';
// ADR-419 — floor-finish footprint preview SSoT.
import { floorFinishPreviewStore } from '../../bim/floor-finishes/floor-finish-preview-store';
// ADR-408 Εύρος Β #3 — underfloor heating footprint preview SSoT.
import { mepUnderfloorPreviewStore } from '../../bim/mep-underfloor/mep-underfloor-preview-store';
// ADR-363 Phase 5.5P — beam preview SSoT.
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
// ADR-436 Slice 2 — foundation line preview SSoT (strip / tie-beam).
import { foundationPreviewStore } from '../../bim/foundations/foundation-preview-store';

/**
 * Resolve the preview point tuple for the active tool. Non-BIM tools fall back to the
 * drawing machine's own points (`machinePoints`).
 */
export function resolveBimToolTempPoints(
  activeTool: string,
  machinePoints: readonly Point2D[],
): readonly Point2D[] {
  if (activeTool === 'stair') {
    // Reconstruct the tuple consumed by `generateStairPreview`:
    //   [] → basePoint marker, [base] → ghost direction line, [base, dir] → walkline.
    const previewState = stairPreviewStore.get();
    if (previewState.basePoint && previewState.direction !== null) {
      const rad = previewState.direction * Math.PI / 180;
      return [
        previewState.basePoint,
        { x: previewState.basePoint.x + Math.cos(rad), y: previewState.basePoint.y + Math.sin(rad) },
      ];
    }
    return previewState.basePoint ? [previewState.basePoint] : [];
  }
  if (activeTool === 'wall') {
    // ADR-363 Phase 1C — polyline mode → spine vertices; otherwise straight/curved →
    // start point only (cursor becomes the end during makeWallFootprintGhost).
    const wp = wallPreviewStore.get();
    if (wp.polylineVertices.length > 0) return wp.polylineVertices;
    return wp.startPoint ? [wp.startPoint] : [];
  }
  // ADR-363 Phase 6.5.B — slab footprint vertices.
  if (activeTool === 'slab') return slabPreviewStore.get().vertices;
  // ADR-417 — roof footprint vertices.
  if (activeTool === 'roof') return roofPreviewStore.get().vertices;
  // ADR-419 — floor-finish footprint vertices.
  if (activeTool === 'floor-finish') return floorFinishPreviewStore.get().vertices;
  // ADR-408 Εύρος Β #3 — underfloor heating footprint vertices.
  if (activeTool === 'mep-underfloor') return mepUnderfloorPreviewStore.get().vertices;
  if (activeTool === 'beam') {
    // ADR-363 Phase 5.5P — beam tempPoints from store.
    const bp = beamPreviewStore.get();
    return bp.startPoint && bp.endPoint ? [bp.startPoint, bp.endPoint] : bp.startPoint ? [bp.startPoint] : [];
  }
  if (activeTool === 'foundation-strip' || activeTool === 'foundation-tie-beam') {
    // ADR-436 Slice 2 — foundation line tempPoints from store (mirror beam).
    const fp = foundationPreviewStore.get();
    return fp.startPoint && fp.endPoint ? [fp.startPoint, fp.endPoint] : fp.startPoint ? [fp.startPoint] : [];
  }
  return machinePoints;
}

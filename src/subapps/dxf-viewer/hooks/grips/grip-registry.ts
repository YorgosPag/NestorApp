/**
 * ADR-183: Unified Grip System — Grip Registry
 *
 * Collects ALL grips (DXF + overlay) into a single UnifiedGripInfo[] array.
 * Pure computation — no React state, no side effects.
 *
 * @see unified-grip-types.ts — type definitions
 * @see useDxfGripInteraction.ts — computeDxfEntityGrips (DXF entity → grips)
 * @see entity-conversion.ts — findOverlayEdgeForGrip (overlay edge detection)
 */

import { useMemo } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Overlay } from '../../overlays/types';
import type { GripInfo } from '../useGripMovement';
import { computeDxfEntityGrips } from '../useDxfGripInteraction';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';
import type { UnifiedGripInfo } from './unified-grip-types';

// ============================================================================
// PURE: Wrap DXF GripInfo → UnifiedGripInfo
// ============================================================================

function wrapDxfGrip(grip: GripInfo): UnifiedGripInfo {
  return {
    id: `dxf_${grip.entityId}_${grip.gripIndex}`,
    source: 'dxf',
    entityId: grip.entityId,
    gripIndex: grip.gripIndex,
    type: grip.type === 'corner' || grip.type === 'midpoint' ? 'edge' : grip.type,
    position: grip.position,
    movesEntity: grip.movesEntity,
    edgeVertexIndices: grip.edgeVertexIndices,
  };
}

// ============================================================================
// PURE: Compute overlay grips (vertex + edge midpoints)
// ============================================================================

/**
 * Generate UnifiedGripInfo[] for a single overlay polygon.
 * Vertex grips at each corner, edge midpoints between consecutive vertices.
 */
export function computeOverlayGrips(overlayId: string, polygon: Array<[number, number]>): UnifiedGripInfo[] {
  if (!polygon || polygon.length < 2) return [];

  const grips: UnifiedGripInfo[] = [];

  // Vertex grips
  for (let i = 0; i < polygon.length; i++) {
    grips.push({
      id: `overlay_${overlayId}_v${i}`,
      source: 'overlay',
      overlayId,
      gripIndex: i,
      type: 'vertex',
      position: { x: polygon[i][0], y: polygon[i][1] },
      movesEntity: false,
    });
  }

  // Edge midpoint grips (between consecutive vertices, polygon is closed)
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    const p1: Point2D = { x: polygon[i][0], y: polygon[i][1] };
    const p2: Point2D = { x: polygon[next][0], y: polygon[next][1] };
    const mid = calculateMidpoint(p1, p2);

    grips.push({
      id: `overlay_${overlayId}_e${i}`,
      source: 'overlay',
      overlayId,
      gripIndex: polygon.length + i, // offset past vertex grips
      type: 'edge',
      position: mid,
      movesEntity: false,
      edgeInsertIndex: i + 1, // vertex insertion index
    });
  }

  return grips;
}

// ============================================================================
// HOOK: Memoized collection of all grips
// ============================================================================

interface UseGripRegistryParams {
  /** DXF scene (for entity geometry) */
  dxfScene: DxfScene | null;
  /** Currently selected DXF entity IDs */
  selectedEntityIds: string[];
  /** Currently selected overlay objects */
  selectedOverlays: Overlay[];
}

/**
 * Memoized collection of ALL grips (DXF + overlay) as UnifiedGripInfo[].
 * Recomputes only when selection or scene data changes.
 */
export function useGripRegistry({
  dxfScene,
  selectedEntityIds,
  selectedOverlays,
}: UseGripRegistryParams): UnifiedGripInfo[] {
  return useMemo(() => {
    const result: UnifiedGripInfo[] = [];

    // 1. DXF entity grips
    if (dxfScene && selectedEntityIds.length > 0) {
      const entityMap = new Map<string, DxfEntityUnion>();
      for (const entity of dxfScene.entities) {
        entityMap.set(entity.id, entity);
      }
      for (const entityId of selectedEntityIds) {
        const entity = entityMap.get(entityId);
        if (entity) {
          const dxfGrips = computeDxfEntityGrips(entity);
          for (const grip of dxfGrips) {
            result.push(wrapDxfGrip(grip));
          }
        }
      }
    }

    // 2. Overlay grips
    for (const overlay of selectedOverlays) {
      if (overlay.polygon && overlay.polygon.length >= 2) {
        result.push(...computeOverlayGrips(overlay.id, overlay.polygon));
      }
    }

    return result;
  }, [dxfScene, selectedEntityIds, selectedOverlays]);
}

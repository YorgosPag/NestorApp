/**
 * GRIP → VERTEX REFS — ADR-349 Phase 1c-A (SSoT)
 *
 * Maps a `UnifiedGripInfo` (computed by `grip-computation.ts`) to one or
 * more `VertexRef` records consumed by `StretchEntityCommand` /
 * `stretch-entity-transform.ts`. Pure — no React, no I/O.
 *
 * Rules per entity type:
 *   - LINE     gripIndex 0 → 'line-start'      |  1 → 'line-end'  |  2 (edge) → both
 *   - POLYLINE / LWPOLYLINE vertex grip → 'polyline-vertex' at grip.gripIndex
 *                                  edge grip → both adjacent vertices
 *   - ARC      gripIndex 1 → 'arc-start'       |  2 → 'arc-end'   |  3 (edge) → both
 *   - RECTANGLE corner grip → 'rectangle-corner' at grip.gripIndex
 *                edge grip → both adjacent corners
 *   - CIRCLE / ELLIPSE / TEXT center grip → anchor-translate (caller branches)
 *
 * Returns `[]` when the entity has no addressable vertices for that grip —
 * caller should fall back to anchor-translate via `grip.movesEntity`.
 *
 * @see VertexRef in stretch-vertex-classifier.ts
 */

import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { Entity } from '../../types/entities';
import type { VertexRef } from '../stretch/stretch-vertex-classifier';

function refsForLine(entityId: string, grip: UnifiedGripInfo): VertexRef[] {
  if (grip.gripIndex === 0) return [{ entityId, kind: 'line-start' }];
  if (grip.gripIndex === 1) return [{ entityId, kind: 'line-end' }];
  if (grip.gripIndex === 2) {
    return [
      { entityId, kind: 'line-start' },
      { entityId, kind: 'line-end' },
    ];
  }
  return [];
}

function refsForArc(entityId: string, grip: UnifiedGripInfo): VertexRef[] {
  if (grip.gripIndex === 1) return [{ entityId, kind: 'arc-start' }];
  if (grip.gripIndex === 2) return [{ entityId, kind: 'arc-end' }];
  if (grip.gripIndex === 3) {
    return [
      { entityId, kind: 'arc-start' },
      { entityId, kind: 'arc-end' },
    ];
  }
  return [];
}

function refsForPolyline(entityId: string, grip: UnifiedGripInfo): VertexRef[] {
  if (grip.type === 'vertex') {
    return [{ entityId, kind: 'polyline-vertex', index: grip.gripIndex }];
  }
  if (grip.type === 'edge' && grip.edgeVertexIndices) {
    const [a, b] = grip.edgeVertexIndices;
    return [
      { entityId, kind: 'polyline-vertex', index: a },
      { entityId, kind: 'polyline-vertex', index: b },
    ];
  }
  return [];
}

function refsForRectangle(entityId: string, grip: UnifiedGripInfo): VertexRef[] {
  if (grip.type === 'vertex') {
    return [{ entityId, kind: 'rectangle-corner', index: grip.gripIndex }];
  }
  if (grip.type === 'edge' && grip.edgeVertexIndices) {
    const [a, b] = grip.edgeVertexIndices;
    return [
      { entityId, kind: 'rectangle-corner', index: a },
      { entityId, kind: 'rectangle-corner', index: b },
    ];
  }
  return [];
}

/**
 * Resolve the `VertexRef[]` that a STRETCH command should target for a given
 * grip drag. Returns `[]` for entities that should use anchor-translate
 * (caller falls back via `grip.movesEntity`).
 */
export function gripToVertexRefs(entity: Entity, grip: UnifiedGripInfo): VertexRef[] {
  if (!grip.entityId) return [];
  switch (entity.type) {
    case 'line':       return refsForLine(entity.id, grip);
    case 'arc':        return refsForArc(entity.id, grip);
    case 'polyline':
    case 'lwpolyline': return refsForPolyline(entity.id, grip);
    case 'rectangle':
    case 'rect':       return refsForRectangle(entity.id, grip);
    default:           return [];
  }
}

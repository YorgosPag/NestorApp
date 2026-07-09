/**
 * @module drawing-tool-classification
 * @description Pure module-level helpers for the unified drawing hook: tool
 * classification sets (measurement vs persistent-entity tools), effective
 * level-id resolution, and duplicate end-point cleanup. Extracted from
 * `useUnifiedDrawing` to keep that hook under the 500-line cap (N.7.1) while
 * staying independently unit-testable.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DrawingTool } from './drawing-types';
import { calculateDistance } from '../../rendering/entities/shared';

/** Measurement tools that create overlay entities */
export const MEASUREMENT_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'measure-distance', 'measure-distance-continuous', 'measure-angle', 'measure-area',
  'measure-angle-measuregeom',
]);

/** Drawing tools that create persistent entities */
export const ENTITY_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'line', 'line-perpendicular', 'rectangle', 'circle', 'circle-diameter', 'circle-2p-diameter',
  'circle-3p', 'circle-chord-sagitta', 'circle-2p-radius', 'circle-best-fit',
  'polyline', 'polygon', 'arc-3p', 'arc-cse', 'arc-sce',
  // ADR-507 S2 — γραμμοσκίαση (κλειστό όριο → HatchEntity).
  'hatch',
  // ADR-583 Φ2 — graphic scale-bar (2-click, mirror 'line').
  'scale-bar',
]);

/** Resolves the level ID for entity placement (fallback to "0" for known tools) */
export function getEffectiveLevelId(tool: DrawingTool, currentLevelId: string | null): string | null {
  if (currentLevelId) return currentLevelId;
  return (MEASUREMENT_TOOLS.has(tool) || ENTITY_TOOLS.has(tool)) ? '0' : null;
}

/** Removes the last point if it duplicates the previous one (distance < 1px from double-click) */
export function removeDuplicateEndPoint(points: readonly Point2D[]): Point2D[] {
  const cleaned = [...points];
  if (cleaned.length >= 2) {
    const last = cleaned[cleaned.length - 1];
    const prev = cleaned[cleaned.length - 2];
    if (calculateDistance(last, prev) < 1.0) {
      cleaned.pop();
    }
  }
  return cleaned;
}

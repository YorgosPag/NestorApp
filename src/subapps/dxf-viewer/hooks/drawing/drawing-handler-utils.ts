import type { ToolType } from '../../ui/toolbar/types';
import { toolStateStore } from '../../stores/ToolStateStore';

type Pt = { x: number; y: number };

export function handleToolCompletion(tool: ToolType, forceSelect: boolean = false): void {
  toolStateStore.handleToolCompletion(tool, forceSelect);
}

/**
 * B36 (ADR-189): Measurement tools that support "Create Guides" prompt via
 * the dedicated `onMeasurementComplete` callback (raw point list, no entity).
 * Re-exported so the B39 entity→guide listener can skip these tools and
 * avoid raising a second notification on the same completion.
 */
export const MEASURE_TOOLS_FOR_GUIDES = new Set<string>([
  'measure-distance', 'measure-distance-continuous', 'measure-angle',
]);

/** AutoCAD-style hard ortho: projects point onto H or V axis from referencePoint */
export function hardOrtho(point: Pt, ref: Pt): Pt {
  const dx = point.x - ref.x;
  const dy = point.y - ref.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: point.x, y: ref.y }
    : { x: ref.x, y: point.y };
}

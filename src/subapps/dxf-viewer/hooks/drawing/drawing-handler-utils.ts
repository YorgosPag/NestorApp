import type { ToolType } from '../../ui/toolbar/types';
import { toolStateStore } from '../../stores/ToolStateStore';
import type { Entity } from '../../types/entities';
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import { isDimLineRefPhase } from '../dimensions/dim-skip-snap';

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

/**
 * ADR-362 hotfix (2026-05-19): resolve the snapped point + entity-under-cursor for a
 * dim-tool click. AutoCAD pattern — the dim-line-offset pick (3rd click) skips OSNAP so
 * preview & commit match; otherwise snap normally and read the body via the hit-test SSoT
 * (HoverStore), falling back to snap.entityId when the click landed on an OSNAP point.
 */
export function resolveDimPickContext(
  p: Pt,
  applySnap: (pt: Pt) => Pt,
  findSnapPoint: ((x: number, y: number) => { entityId?: string } | null | undefined) | undefined,
  sceneEntities: ReadonlyArray<Entity> | undefined,
): { snapped: Pt; hoveredEntity: DetectableEntity | undefined } {
  const skipSnap = isDimLineRefPhase();
  const snapped = skipSnap ? p : applySnap(p);
  const snapResult = skipSnap ? undefined : findSnapPoint?.(p.x, p.y);
  const hoveredId = skipSnap ? undefined : (getHoveredEntity() ?? snapResult?.entityId);
  const hoveredEntity: DetectableEntity | undefined = hoveredId
    ? (sceneEntities?.find((e) => e.id === hoveredId) as DetectableEntity | undefined)
    : undefined;
  return { snapped, hoveredEntity };
}

/** AutoCAD-style hard ortho: projects point onto H or V axis from referencePoint */
export function hardOrtho(point: Pt, ref: Pt): Pt {
  const dx = point.x - ref.x;
  const dy = point.y - ref.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: point.x, y: ref.y }
    : { x: ref.x, y: point.y };
}

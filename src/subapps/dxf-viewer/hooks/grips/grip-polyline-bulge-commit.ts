/**
 * POLYLINE BULGE GRIP COMMIT — ADR-510 Φ3c (live arc curvature drag)
 *
 * Commit handler for dragging a polyline ARC-MIDPOINT grip (`polyline-arc-midpoint-N`,
 * positioned at `bulgeApexPoint`). The drag delta moves the apex; the new signed
 * bulge is recovered via `bulgeFromApexPoint` (perpendicular projection — side
 * drag along the chord leaves curvature unchanged). Routes through `SetBulgeCommand`
 * with `isDragging=true` so the per-frame samples coalesce into ONE undo step
 * (mirror of `commitSlabGripDrag`'s merge-window behaviour).
 *
 * Straight-segment + vertex polyline grips do NOT come here — they keep the
 * generic stretch/move path (`commitDxfGripDragViaStretchCommand`).
 *
 * @see grip-commit-adapters — dispatch (branches on `polylineGripKind`)
 * @see geometry-bulge-utils — bulgeFromApexPoint (drag → bulge SSoT, Φ3a)
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { SetBulgeCommand } from '../../core/commands/entity-commands/SetBulgeCommand';
import { bulgeFromApexPoint } from '../../rendering/entities/shared/geometry-bulge-utils';
import { parsePolylineSegIndex } from '../../systems/grip/polyline-grip-ops';
import { createSceneManagerAdapter } from './grip-commit-adapters';

interface PolyShape {
  readonly type?: string;
  readonly vertices?: ReadonlyArray<Point2D>;
  readonly closed?: boolean;
  readonly bulges?: ReadonlyArray<number>;
}

/**
 * ADR-510 Φ3c — commit a polyline arc-apex drag as a bulge change. Idempotent +
 * undo/redo-safe via `SetBulgeCommand`; consecutive drag samples merge.
 */
export function commitPolylineBulgeGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (delta.x === 0 && delta.y === 0) return;
  if (!grip.entityId || !grip.polylineGripKind) return;
  const segIdx = parsePolylineSegIndex(grip.polylineGripKind);
  if (segIdx == null) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const entity = sceneManager.getEntity(grip.entityId) as unknown as PolyShape | undefined;
  if (!entity || (entity.type !== 'polyline' && entity.type !== 'lwpolyline')) return;
  const vertices = entity.vertices;
  if (!Array.isArray(vertices) || vertices.length < 2) return;
  const vLen = vertices.length;
  const next = (segIdx + 1) % vLen;
  if (next === 0 && !entity.closed) return; // open polyline: no wrap segment
  const p0 = vertices[segIdx];
  const p1 = vertices[next];
  // Apex starts at the grip position (= original apex) and follows the drag delta.
  const apex: Point2D = { x: grip.position.x + delta.x, y: grip.position.y + delta.y };
  const newBulge = bulgeFromApexPoint(p0, p1, apex);
  const oldBulge = entity.bulges?.[segIdx] ?? 0;
  if (newBulge === oldBulge) return;
  const command = new SetBulgeCommand(grip.entityId, segIdx, oldBulge, newBulge, sceneManager, true);
  if (command.validate() !== null) return;
  deps.execute(command);
}

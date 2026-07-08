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
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { SetBulgeCommand } from '../../core/commands/entity-commands/SetBulgeCommand';
import { bulgeFromApexPoint } from '../../rendering/entities/shared/geometry-bulge-utils';
import { parsePolylineSegIndex } from '../../systems/grip/polyline-grip-ops';
import { createSceneManagerAdapter } from './grip-commit-adapters';
import { gripKindOf } from '../grip-kinds';
// SSoT polyline shape (same canonical type PolylineVertexCommand uses — no ad-hoc duplicate).
import type { PolylineEntity, LWPolylineEntity } from '../../types/entities';

type PolyReadView = { readonly type?: string } & Pick<
  PolylineEntity | LWPolylineEntity,
  'vertices' | 'closed' | 'bulges'
>;

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
  const polylineKind = gripKindOf(grip, 'polyline');
  if (!grip.entityId || !polylineKind) return;
  const segIdx = parsePolylineSegIndex(polylineKind);
  if (segIdx == null) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const entity = sceneManager.getEntity(grip.entityId) as unknown as PolyReadView | undefined;
  if (!entity || (entity.type !== 'polyline' && entity.type !== 'lwpolyline')) return;
  const vertices = entity.vertices;
  if (!Array.isArray(vertices) || vertices.length < 2) return;
  const vLen = vertices.length;
  const next = (segIdx + 1) % vLen;
  if (next === 0 && !entity.closed) return; // open polyline: no wrap segment
  const p0 = vertices[segIdx];
  const p1 = vertices[next];
  // Apex starts at the grip position (= original apex) and follows the drag delta.
  const apex: Point2D = translatePoint(grip.position, delta);
  const newBulge = bulgeFromApexPoint(p0, p1, apex);
  const oldBulge = entity.bulges?.[segIdx] ?? 0;
  if (newBulge === oldBulge) return;
  const command = new SetBulgeCommand(grip.entityId, segIdx, oldBulge, newBulge, sceneManager, true);
  if (command.validate() !== null) return;
  deps.execute(command);
}

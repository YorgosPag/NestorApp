/**
 * POLYLINE GRIP OPS — ADR-510 Φ3c (multifunctional grip → command, pure SSoT)
 *
 * Maps a polyline grip + menu op to the right undoable command:
 *   - add-vertex      → `PolylineVertexCommand` (insert at segment N+1, chord midpoint).
 *   - remove-vertex   → `PolylineVertexCommand` (remove vertex N).
 *   - convert-to-arc  → `SetBulgeCommand` (segment N → `DEFAULT_ARC_BULGE`).
 *   - convert-to-line → `SetBulgeCommand` (segment N → 0).
 *
 * Pure: returns the command (or null) — the controller owns `history.execute`.
 * Both the menu (here) and the live drag (`commitPolylineBulgeGripDrag`) share
 * the same segment-index parse + default-arc policy, so the math lives once.
 *
 * @see SetBulgeCommand / PolylineVertexCommand — the commands built here
 * @see grip-context-menu-resolver — buildPolylineOpsSection (which ops are offered)
 */

import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import { PolylineVertexCommand } from '../../core/commands/entity-commands/PolylineVertexCommand';
import { SetBulgeCommand } from '../../core/commands/entity-commands/SetBulgeCommand';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';
// SSoT polyline shape (same canonical type PolylineVertexCommand uses — no ad-hoc duplicate).
import type { PolylineEntity, LWPolylineEntity } from '../../types/entities';

/**
 * Default bulge applied by «Convert to Arc» before the user grip-tunes the
 * curvature (Revit/AutoCAD flow: pick convert, then drag the apex). `tan(22.5°)`
 * = a clean quarter-circle (90° included angle), the most "intentional"-looking
 * neutral arc. The user immediately drags the arc-midpoint grip to adjust.
 */
export const DEFAULT_ARC_BULGE = Math.tan(Math.PI / 8); // ≈ 0.41421356

export type PolylineVertexMenuOp =
  | 'add-vertex'
  | 'remove-vertex'
  | 'convert-to-arc'
  | 'convert-to-line';

type PolyReadView = { readonly type?: string } & Pick<
  PolylineEntity | LWPolylineEntity,
  'vertices' | 'closed' | 'bulges'
>;

/**
 * Trailing segment/vertex index of any `polyline-*-N` grip kind. For a vertex
 * grip N is BOTH the vertex index AND its outgoing-segment index (they coincide).
 * Returns null when the kind is absent / malformed.
 */
export function parsePolylineSegIndex(kind: string | undefined): number | null {
  if (!kind) return null;
  const dash = kind.lastIndexOf('-');
  if (dash < 0) return null;
  const n = Number.parseInt(kind.slice(dash + 1), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Build the undoable command for a polyline grip menu op, or null when the grip /
 * entity is not a usable polyline. Pure — the caller runs it through history.
 */
export function buildPolylineVertexOpCommand(
  grip: UnifiedGripInfo,
  op: PolylineVertexMenuOp,
  sceneManager: ISceneManager,
): ICommand | null {
  if (!grip.entityId || !grip.polylineGripKind) return null;
  const entity = sceneManager.getEntity(grip.entityId) as unknown as PolyReadView | undefined;
  if (!entity || (entity.type !== 'polyline' && entity.type !== 'lwpolyline')) return null;
  const vertices = entity.vertices;
  if (!Array.isArray(vertices) || vertices.length < 2) return null;
  const segIdx = parsePolylineSegIndex(grip.polylineGripKind);
  if (segIdx == null) return null;
  const vLen = vertices.length;

  if (op === 'remove-vertex') {
    return new PolylineVertexCommand(
      { entityId: grip.entityId, op: { kind: 'remove', index: segIdx } },
      sceneManager,
    );
  }
  if (op === 'add-vertex') {
    const next = (segIdx + 1) % vLen;
    if (next === 0 && !entity.closed) {
      // Last vertex of an OPEN polyline has no outgoing segment → add on the
      // incoming segment instead (legacy hover-menu parity), if one exists.
      if (segIdx > 0) {
        const incoming = calculateMidpoint(vertices[segIdx - 1], vertices[segIdx]);
        return new PolylineVertexCommand(
          { entityId: grip.entityId, op: { kind: 'add', index: segIdx, position: incoming } },
          sceneManager,
        );
      }
      return null;
    }
    const position = calculateMidpoint(vertices[segIdx], vertices[next]);
    return new PolylineVertexCommand(
      { entityId: grip.entityId, op: { kind: 'add', index: segIdx + 1, position } },
      sceneManager,
    );
  }
  // convert-to-arc / convert-to-line
  const oldBulge = entity.bulges?.[segIdx] ?? 0;
  const newBulge = op === 'convert-to-line' ? 0 : DEFAULT_ARC_BULGE;
  return new SetBulgeCommand(grip.entityId, segIdx, oldBulge, newBulge, sceneManager, false);
}

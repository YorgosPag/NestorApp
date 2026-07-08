/**
 * FOOTPRINT GRIP OPS — ADR-535 Φ4 (footprint vertex add/remove → command, pure SSoT)
 *
 * Maps a footprint grip + a vertex menu op (delete-corner / add-corner) to the right
 * undoable `Update*ParamsCommand`, for ALL four parametric-footprint families:
 *   - slab          → `removeVertexFromSlab` / `applySlabGripDrag` → `UpdateSlabParamsCommand`
 *   - roof          → `removeVertexFromRoof` / `applyRoofGripDrag` → `UpdateRoofParamsCommand`
 *   - floor-finish  → `removeVertexFromFloorFinish` / `applyFloorFinishGripDrag` → `UpdateFloorFinishParamsCommand`
 *   - slab-opening  → `removeVertexFromSlabOpening` / `applySlabOpeningGripDrag` → `UpdateSlabOpeningParamsCommand`
 *
 * The sibling of `polyline-grip-ops.ts` (ADR-510 Φ3c): pure — returns the validated
 * command (or null), the caller owns `history.execute`. ONE home for the "delete a
 * corner / insert a corner at the edge midpoint" policy, shared by BOTH the 2D grip
 * context menu (`useGripContextMenuController.onSlabVertexOp`) and the 3D viewport
 * vertex context menu (ADR-535 Φ4) — no duplicated per-entity branching, no drift.
 *
 * `add-corner` inserts the new vertex at the EXACT edge midpoint (delta 0); the user
 * then drags the fresh vertex grip. `delete-corner` is a no-op (returns null) at the
 * minimum triangle (≤3 vertices) via each family's `removeVertexFrom*` guard.
 *
 * @see polyline-grip-ops — buildPolylineVertexOpCommand (the multifunctional-polyline twin)
 * @see grip-context-menu-resolver — buildVertexOpsSection (which ops are offered)
 */

import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type {
  SlabGripKind, RoofGripKind, FloorFinishGripKind, SlabOpeningGripKind,
} from '../../hooks/grip-types';
import { gripKindOf } from '../../hooks/grip-kinds';
import { removeVertexFromSlab, applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { removeVertexFromRoof, applyRoofGripDrag } from '../../bim/roofs/roof-grips';
import { removeVertexFromFloorFinish, applyFloorFinishGripDrag } from '../../bim/floor-finishes/floor-finish-grips';
import { removeVertexFromSlabOpening, applySlabOpeningGripDrag } from '../../bim/slab-openings/slab-opening-grips';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateRoofParamsCommand } from '../../core/commands/entity-commands/UpdateRoofParamsCommand';
import { UpdateFloorFinishParamsCommand } from '../../core/commands/entity-commands/UpdateFloorFinishParamsCommand';
import { UpdateSlabOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateSlabOpeningParamsCommand';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { RoofEntity } from '../../bim/types/roof-types';
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';

export type FootprintVertexMenuOp = 'delete-corner' | 'add-corner';

const ZERO = { x: 0, y: 0 } as const;

/** Per-family pieces the generic runner needs (one home for the delete/insert policy). */
interface FootprintOpSpec<P> {
  readonly kind: string;
  readonly vertexPrefix: string;
  readonly edgePrefix: string;
  readonly params: P;
  readonly removeVertex: (p: P, index: number) => P;
  readonly insertAtEdge: (kind: string, p: P) => P;
  readonly makeCommand: (next: P, prev: P) => ICommand;
}

/**
 * Apply the op to a family's params and wrap it in its `Update*ParamsCommand`, or null
 * on a no-op (identity params: ≤3-vertex delete guard, zero-length, out-of-range) or a
 * validation reject. The `*GripKind` suffix carries the vertex / edge index, parsed by
 * the underlying `removeVertexFrom*` / `apply*GripDrag` (one parse SSoT per family).
 */
function runFootprintOp<P>(spec: FootprintOpSpec<P>, op: FootprintVertexMenuOp): ICommand | null {
  let next = spec.params;
  if (op === 'delete-corner' && spec.kind.startsWith(spec.vertexPrefix)) {
    const idx = parseInt(spec.kind.slice(spec.vertexPrefix.length), 10);
    if (Number.isFinite(idx)) next = spec.removeVertex(spec.params, idx);
  } else if (op === 'add-corner' && spec.kind.startsWith(spec.edgePrefix)) {
    next = spec.insertAtEdge(spec.kind, spec.params);
  }
  if (next === spec.params) return null;
  const cmd = spec.makeCommand(next, spec.params);
  return (cmd.validate?.() ?? null) === null ? cmd : null;
}

/**
 * Build the undoable command for a footprint grip vertex op, or null when the grip /
 * entity is not a usable parametric footprint. Pure — the caller runs it through
 * history (one undo step). Branches on the grip discriminator so the right family's
 * transform + command runs; the host-relative geometry recompute lives in the command.
 */
export function buildFootprintVertexOpCommand(
  grip: UnifiedGripInfo,
  op: FootprintVertexMenuOp,
  sceneManager: ISceneManager,
): ICommand | null {
  const id = grip.entityId;
  if (!id) return null;
  const raw = sceneManager.getEntity(id);
  if (!raw) return null;

  const slabKind = gripKindOf(grip, 'slab');
  if (slabKind) {
    const e = raw as unknown as Partial<SlabEntity>;
    if (e.type !== 'slab' || !e.params) return null;
    return runFootprintOp({
      kind: slabKind, vertexPrefix: 'slab-vertex-', edgePrefix: 'slab-edge-midpoint-',
      params: e.params, removeVertex: removeVertexFromSlab,
      insertAtEdge: (k, p) => applySlabGripDrag(k as SlabGripKind, { originalParams: p, delta: ZERO }),
      makeCommand: (next, prev) => new UpdateSlabParamsCommand(id, next, prev, sceneManager, false),
    }, op);
  }
  const roofKind = gripKindOf(grip, 'roof');
  if (roofKind) {
    const e = raw as unknown as Partial<RoofEntity>;
    if (e.type !== 'roof' || !e.params) return null;
    return runFootprintOp({
      kind: roofKind, vertexPrefix: 'roof-vertex-', edgePrefix: 'roof-edge-midpoint-',
      params: e.params, removeVertex: removeVertexFromRoof,
      insertAtEdge: (k, p) => applyRoofGripDrag(k as RoofGripKind, { originalParams: p, delta: ZERO }),
      makeCommand: (next, prev) => new UpdateRoofParamsCommand(id, next, prev, sceneManager, false),
    }, op);
  }
  const floorFinishKind = gripKindOf(grip, 'floor-finish');
  if (floorFinishKind) {
    const e = raw as unknown as Partial<FloorFinishEntity>;
    if (e.type !== 'floor-finish' || !e.params) return null;
    return runFootprintOp({
      kind: floorFinishKind, vertexPrefix: 'floor-finish-vertex-', edgePrefix: 'floor-finish-edge-midpoint-',
      params: e.params, removeVertex: removeVertexFromFloorFinish,
      insertAtEdge: (k, p) => applyFloorFinishGripDrag(k as FloorFinishGripKind, { originalParams: p, delta: ZERO }),
      makeCommand: (next, prev) => new UpdateFloorFinishParamsCommand(id, next, prev, sceneManager, false),
    }, op);
  }
  const slabOpeningKind = gripKindOf(grip, 'slab-opening');
  if (slabOpeningKind) {
    const e = raw as unknown as Partial<SlabOpeningEntity>;
    if (e.type !== 'slab-opening' || !e.params) return null;
    return runFootprintOp({
      kind: slabOpeningKind, vertexPrefix: 'slab-opening-vertex-', edgePrefix: 'slab-opening-edge-midpoint-',
      params: e.params, removeVertex: removeVertexFromSlabOpening,
      insertAtEdge: (k, p) => applySlabOpeningGripDrag(k as SlabOpeningGripKind, { originalParams: p, delta: ZERO }),
      makeCommand: (next, prev) => new UpdateSlabOpeningParamsCommand(id, next, prev, sceneManager, false),
    }, op);
  }
  return null;
}

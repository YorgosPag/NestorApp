/**
 * HATCH GRIP OPS — ADR-507 (Giorgio 2026-07-07): hatch boundary vertex add/remove → command, pure SSoT.
 *
 * Maps a hatch boundary grip + a vertex menu op (add-vertex / remove-vertex) to an
 * undoable `UpdateEntityCommand` that patches `boundaryPaths`. The sibling of
 * `footprint-grip-ops.ts` (slab/roof/floor-finish/slab-opening, params-driven) and
 * `polyline-grip-ops.ts` (polyline) — but the hatch is a FLAT, MULTI-RING primitive
 * (`boundaryPaths: Point2D[][]`, no params), so it needs its own tiny builder that
 * reuses the ring-aware `insertHatchVertexOnEdge` / `removeVertexFromHatch` transforms.
 *
 *   - `remove-vertex` (on a `hatch-vertex-*` grip)        → drop that boundary vertex
 *     (no-op at the minimum triangle, guarded by `removeVertexFromHatch`).
 *   - `add-vertex`    (on a `hatch-edge-midpoint-*` grip) → insert a new vertex at the
 *     EXACT edge midpoint (delta 0); the user then drags the fresh vertex grip.
 *
 * Pure — returns the validated command (or null on a no-op / non-hatch grip); the caller
 * owns `history.execute`. Same `UpdateEntityCommand` patch path the hatch ribbon bridge
 * uses → preview ≡ commit, one undo step, `useHatchPersistence` auto-saves boundaryPaths.
 *
 * @see bim/hatch/hatch-grips — insertHatchVertexOnEdge / removeVertexFromHatch (transforms)
 * @see grip-context-menu-resolver — buildHatchOpsSection (which ops are offered)
 * @see footprint-grip-ops / polyline-grip-ops — the sibling builders
 */

import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { HatchEntity } from '../../types/entities';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import {
  decodeHatchVertexGripKind,
  decodeHatchEdgeMidpointGripKind,
  removeVertexFromHatch,
  insertHatchVertexOnEdge,
} from '../../bim/hatch/hatch-grips';

export type HatchVertexMenuOp = 'add-vertex' | 'remove-vertex';

const ZERO = { x: 0, y: 0 } as const;

/**
 * Build the undoable command for a hatch boundary grip vertex op, or null when the grip /
 * entity is not a usable hatch or the op is a no-op (min-triangle guard, out-of-range). The
 * `hatchGripKind` carries BOTH the ring and the vertex/edge index (multi-ring / island safe).
 */
export function buildHatchVertexOpCommand(
  grip: UnifiedGripInfo,
  op: HatchVertexMenuOp,
  sceneManager: ISceneManager,
): ICommand | null {
  const id = grip.entityId;
  if (!id || !grip.hatchGripKind) return null;
  const raw = sceneManager.getEntity(id);
  if (!raw) return null;
  const e = raw as unknown as Partial<HatchEntity>;
  if (e.type !== 'hatch' || !e.boundaryPaths) return null;
  const original = e.boundaryPaths;

  let next: typeof original = original;
  if (op === 'remove-vertex') {
    const decoded = decodeHatchVertexGripKind(grip.hatchGripKind);
    if (!decoded) return null;
    next = removeVertexFromHatch(original, decoded[0], decoded[1]);
  } else {
    const decoded = decodeHatchEdgeMidpointGripKind(grip.hatchGripKind);
    if (!decoded) return null;
    next = insertHatchVertexOnEdge(original, decoded[0], decoded[1], ZERO);
  }
  // Identity return = guarded no-op (min triangle / out of range) → nothing to do.
  if (next === original) return null;
  return new UpdateEntityCommand(id, { boundaryPaths: next }, sceneManager, 'Hatch vertex op');
}

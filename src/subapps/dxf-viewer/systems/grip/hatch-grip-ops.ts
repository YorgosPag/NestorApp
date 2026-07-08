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
import { CompoundCommand } from '../../core/commands';
import type { GripRef } from '../../rendering/grips/grip-temperature';
import { gripKindOf } from '../../hooks/grip-kinds';
import {
  decodeHatchVertexGripKind,
  decodeHatchEdgeMidpointGripKind,
  removeVertexFromHatch,
  removeVerticesFromHatch,
  insertHatchVertexOnEdge,
  getHatchBoundaryGrips,
  type HatchVertexTarget,
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
  const hatchKind = gripKindOf(grip, 'hatch');
  if (!id || !hatchKind) return null;
  const raw = sceneManager.getEntity(id);
  if (!raw) return null;
  const e = raw as unknown as Partial<HatchEntity>;
  if (e.type !== 'hatch' || !e.boundaryPaths) return null;
  const original = e.boundaryPaths;

  let next: typeof original = original;
  if (op === 'remove-vertex') {
    const decoded = decodeHatchVertexGripKind(hatchKind);
    if (!decoded) return null;
    next = removeVertexFromHatch(original, decoded[0], decoded[1]);
  } else {
    const decoded = decodeHatchEdgeMidpointGripKind(hatchKind);
    if (!decoded) return null;
    next = insertHatchVertexOnEdge(original, decoded[0], decoded[1], ZERO);
  }
  // Identity return = guarded no-op (min triangle / out of range) → nothing to do.
  if (next === original) return null;
  return new UpdateEntityCommand(id, { boundaryPaths: next }, sceneManager, 'Hatch vertex op');
}

/**
 * ADR-501 EXT (Giorgio 2026-07-07) — BULK delete of armed/selected hatch boundary vertices.
 * Given the armed grip refs (`GripArmedStore.getRefsSnapshot()`), groups them per hatch entity,
 * maps each armed `gripIndex` back to its (ring, vertex) via the SAME `getHatchBoundaryGrips`
 * order the render/interaction use (vertex grips occupy the first `N` indices; edge-midpoint /
 * gradient grips are past `N` → ignored, not deletable), removes them all at once (per-ring ≥3
 * guard), and wraps every affected hatch in ONE `UpdateEntityCommand` — many hatches → ONE
 * `CompoundCommand` = a single undo. Returns null when no armed grip resolves to a removable
 * hatch vertex (all edge-midpoints, non-hatch entities, or every ring at the minimum triangle).
 */
export function buildArmedHatchVertexDeleteCommand(
  refs: ReadonlyArray<GripRef>,
  sceneManager: ISceneManager,
): ICommand | null {
  const byEntity = new Map<string, number[]>();
  for (const r of refs) {
    const list = byEntity.get(r.entityId) ?? [];
    list.push(r.gripIndex);
    byEntity.set(r.entityId, list);
  }

  const commands: ICommand[] = [];
  for (const [entityId, gripIndices] of byEntity) {
    const raw = sceneManager.getEntity(entityId);
    if (!raw) continue;
    const e = raw as unknown as Partial<HatchEntity>;
    if (e.type !== 'hatch' || !e.boundaryPaths) continue;
    // Vertex grips are the first N entries (path-major) — a gripIndex within [0,N) IS the vertex.
    const vertexGrips = getHatchBoundaryGrips(e.boundaryPaths);
    const targets: HatchVertexTarget[] = gripIndices
      .filter((gi) => gi >= 0 && gi < vertexGrips.length)
      .map((gi) => ({ pathIdx: vertexGrips[gi].pathIdx, vertexIdx: vertexGrips[gi].vertexIdx }));
    if (targets.length === 0) continue;
    const next = removeVerticesFromHatch(e.boundaryPaths, targets);
    if (next === e.boundaryPaths) continue; // all guarded (min triangle) → no-op for this hatch
    commands.push(new UpdateEntityCommand(entityId, { boundaryPaths: next }, sceneManager, 'Delete hatch vertices'));
  }

  if (commands.length === 0) return null;
  return commands.length === 1 ? commands[0] : new CompoundCommand('Delete hatch vertices', commands);
}

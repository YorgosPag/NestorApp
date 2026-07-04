/**
 * ADR-561 — Plain DXF primitive ROTATION grip commits (arc / polyline / rectangle).
 *
 * The arc + polyline rotation handles route through the CANONICAL `RotateEntityCommand`
 * (the same undoable, merge-coalescing command the ROTATE tool + the line rotation
 * handle use) — NO bespoke transform. The hot-grip rotate flow publishes {pivot,anchor}
 * in `BimRotateHotGripStore` before commit (mirror `commitLineGripDrag`); the swept
 * angle = angle(anchor+delta) − angle(anchor) about the pivot. A degenerate / zero
 * sweep is a no-op (cursor on the pivot).
 *
 *   - `arc-rotation`      → rotate the whole arc about its centre (`rotateEntity`
 *                           case 'arc': centre + start/end angle).
 *   - `polyline-rotation` → rotate every vertex about the centroid.
 *   - a scene `rectangle`/`rect` (which shows polyline grips in the DXF pipeline) is
 *     first EXPLODED to a `polyline` with the rotated vertices via the generic
 *     `UpdateEntityCommand`, because the rectangle scene shape carries no working
 *     rotation (its `rotation` field is ignored by the converter / selection / render
 *     — they always derive axis-aligned vertices from `corner1`/`corner2`). Exploding
 *     is semantically exact (a rotated rectangle IS a closed 4-vertex polyline) and
 *     keeps the whole rotation path in ONE canonical place afterwards.
 *
 * Split out of `grip-parametric-commits.ts` (N.7.1 file-size budget); re-exported
 * from there so the commit API stays one import.
 *
 * @see hooks/grips/grip-linear-commits.ts — `commitLineGripDrag` (the mirror this follows)
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { resolveSweptRotationDeg } from './primitive-rotation-drag';
import { rotatePoint } from '../../utils/rotation-math';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { polylineBboxCenter, rectOrPolylineVertices } from '../../systems/polyline/rectangle-detect';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/** Minimal structural view of the primitive scene shapes we read here. */
interface PrimitiveSceneShape {
  type?: string;
  center?: Point2D;
  vertices?: Point2D[];
  closed?: boolean;
}

/** The resolved rotation: pivot + swept angle, or `null` for a degenerate sweep. */
interface RotationResolution {
  readonly pivot: Point2D;
  readonly sweptDeg: number;
}

/**
 * Resolve pivot + swept angle from the hot-grip rotate context (published by the
 * FSM) or fall back to `fallbackPivot` + the grip position (legacy drag). Mirror of
 * the pivot/anchor resolution in `commitLineGripDrag`.
 */
function resolveRotation(
  grip: UnifiedGripInfo,
  delta: Point2D,
  fallbackPivot: Point2D,
): RotationResolution | null {
  const ctx = BimRotateHotGripStore.getSnapshot();
  const useCtx = ctx.pivot !== null && ctx.anchor !== null;
  const pivot = useCtx ? ctx.pivot! : fallbackPivot;
  const anchor = useCtx ? ctx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  // SHARED guarded swept-angle SSoT (commit ↔ preview twin — `primitive-rotation-drag.ts`).
  const sweptDeg = resolveSweptRotationDeg(pivot, anchor, currentPos);
  if (sweptDeg === null) return null;
  return { pivot, sweptDeg };
}

/**
 * ADR-561 — arc rotation commit. Only the `'arc-rotation'` handle routes here (the
 * `'arc-move'` centre falls through to the whole-entity translate path upstream).
 * Rotates the arc about its centre via the canonical `RotateEntityCommand`.
 */
export function commitArcGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.arcGripKind !== 'arc-rotation') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId) as PrimitiveSceneShape | undefined;
  if (!raw || raw.type !== 'arc' || !raw.center) return;
  const res = resolveRotation(grip, delta, raw.center);
  if (!res) return;
  const command = new RotateEntityCommand([grip.entityId], res.pivot, res.sweptDeg, sceneManager);
  if (command.validate() !== null) return;
  deps.execute(command);
}

/**
 * ADR-561 — polyline rotation commit. `polyline`/`lwpolyline` rotate about their
 * bbox centre via `RotateEntityCommand` (rotate every vertex). A scene
 * `rectangle`/`rect` is exploded to a polyline with the rotated vertices via the
 * generic `UpdateEntityCommand` (see file header for the why).
 */
export function commitPolylineRotationGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.polylineGripKind !== 'polyline-rotation') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId) as PrimitiveSceneShape | undefined;
  if (!raw) return;

  const isRect = raw.type === 'rectangle' || raw.type === 'rect';
  const vertices = rectOrPolylineVertices(raw);
  if (!vertices || vertices.length < 2) return;

  const res = resolveRotation(grip, delta, polylineBboxCenter(vertices));
  if (!res) return;

  if (isRect) {
    // Explode → closed polyline with the rotated corners (rotation baked into geometry).
    const rotated = vertices.map((v) => rotatePoint(v, res.pivot, res.sweptDeg));
    const command = new UpdateEntityCommand(
      grip.entityId,
      { type: 'polyline', vertices: rotated, closed: true },
      sceneManager,
      'Rotate rectangle',
    );
    if (command.validate() !== null) return;
    deps.execute(command);
    return;
  }

  const command = new RotateEntityCommand([grip.entityId], res.pivot, res.sweptDeg, sceneManager);
  if (command.validate() !== null) return;
  deps.execute(command);
}

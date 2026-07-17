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
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { resolveSweptRotationDeg } from './primitive-rotation-drag';
import { rotatePoint } from '../../utils/rotation-math';
import { commitGripRotation } from './grip-rotation-commit';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { CreateEntityCommand } from '../../core/commands/entity-commands/CreateEntityCommand';
import type { SceneEntity } from '../../core/commands/interfaces';
import { polylineBboxCenter, rectOrPolylineVertices } from '../../systems/polyline/rectangle-detect';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';
import { gripKindOf } from '../grip-kinds';
// ADR-561 EXT (Ctrl-rotate-copy) — copy intent SSoT (the right-click «Copy» toggle OR live
// Ctrl/⌘), the SAME predicate the move-copy + line rotate-copy commits use.
import { isGripCopyIntent } from '../../systems/grip/grip-copy-intent';

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
 *
 * Exported (ADR-575 §8) so the GROUP gizmo rotation commit (`commitGroupGizmoRotation`)
 * reuses the EXACT same pivot/anchor/swept-angle resolution — the group is just another
 * consumer of the shared rotate flow, no fork.
 */
export function resolveRotation(
  grip: UnifiedGripInfo,
  delta: Point2D,
  fallbackPivot: Point2D,
): RotationResolution | null {
  const ctx = BimRotateHotGripStore.getSnapshot();
  const useCtx = ctx.pivot !== null && ctx.anchor !== null;
  const pivot = useCtx ? ctx.pivot! : fallbackPivot;
  const anchor = useCtx ? ctx.anchor! : grip.position;
  const currentPos: Point2D = translatePoint(anchor, delta);
  // SHARED guarded swept-angle SSoT (commit ↔ preview twin — `primitive-rotation-drag.ts`).
  const sweptDeg = resolveSweptRotationDeg(pivot, anchor, currentPos);
  if (sweptDeg === null) return null;
  return { pivot, sweptDeg };
}

/**
 * ADR-561/583 — SHARED "rotate a single-anchor primitive about a fixed pivot point"
 * commit (arc → centre, annotation symbol → insertion point). Gated by the caller's
 * own `isThisHandle` (its `*-rotation` discriminator) + `expectedType`; the pivot is
 * read from the raw scene shape via `pivotOf`. Rotates through the canonical
 * `createRotateCommand` (Ctrl / «Copy» → rotate a CLONE via `CloneWithTransformCommand`,
 * which owns undo/redo — ADR-507 §8). Extracted so the arc + annotation-symbol commits
 * are ONE source, not sibling twins (N.18 — jscpd caught the copy).
 */
function commitRotationAboutAnchorPoint(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
  isThisHandle: boolean,
  expectedType: string,
  pivotOf: (raw: PrimitiveSceneShape & { position?: Point2D }) => Point2D | undefined,
): void {
  if (!grip.entityId || !isThisHandle) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId) as (PrimitiveSceneShape & { position?: Point2D }) | undefined;
  if (!raw || raw.type !== expectedType) return;
  const pivot = pivotOf(raw);
  if (!pivot) return;
  const res = resolveRotation(grip, delta, pivot);
  if (!res) return;
  commitGripRotation({ entityId: grip.entityId, pivot: res.pivot, angleDeg: res.sweptDeg, sceneManager, execute: deps.execute });
}

/**
 * ADR-561 — arc rotation commit. Only the `'arc-rotation'` handle routes here (the
 * `'arc-move'` centre falls through to the whole-entity translate path upstream).
 * Rotates the arc about its centre via the shared single-anchor rotate SSoT.
 */
export function commitArcGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  commitRotationAboutAnchorPoint(
    grip, delta, deps,
    gripKindOf(grip, 'arc') === 'arc-rotation', 'arc', (raw) => raw.center,
  );
}

/**
 * ADR-583 — annotation symbol (North arrow) rotation commit. Only the
 * `'annotation-symbol-rotation'` handle routes here (the `'annotation-symbol-move'`
 * centre falls through to the whole-entity translate path upstream). Rotates the
 * symbol about its insertion point (`rotateEntity` case 'annotation-symbol':
 * position + accumulated `rotation`) via the shared single-anchor rotate SSoT.
 */
export function commitAnnotationSymbolGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  commitRotationAboutAnchorPoint(
    grip, delta, deps,
    gripKindOf(grip, 'annotation-symbol') === 'annotation-symbol-rotation', 'annotation-symbol', (raw) => raw.position,
  );
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
  if (!grip.entityId || gripKindOf(grip, 'polyline') !== 'polyline-rotation') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId) as PrimitiveSceneShape | undefined;
  if (!raw) return;

  const isRect = raw.type === 'rectangle' || raw.type === 'rect';
  const vertices = rectOrPolylineVertices(raw);
  if (!vertices || vertices.length < 2) return;

  const res = resolveRotation(grip, delta, polylineBboxCenter(vertices));
  if (!res) return;

  const copy = isGripCopyIntent();

  if (isRect) {
    // Explode → closed polyline with the rotated corners (rotation baked into geometry).
    const rotated = vertices.map((v) => rotatePoint(v, res.pivot, res.sweptDeg));
    // ADR-561 EXT — for a COPY the source rect must stay put: create a NEW closed polyline
    // (inheriting the rect's layer/style) with the rotated corners instead of exploding
    // in place. `createRotateCommand({copy:true})` cannot serve here — the scene rect
    // ignores its `rotation` field, so a clone would render axis-aligned (see file header).
    if (copy) {
      const { id: _id, ...style } = raw as unknown as SceneEntity;
      const command = new CreateEntityCommand(
        { ...style, type: 'polyline', vertices: rotated, closed: true } as Omit<SceneEntity, 'id'>,
        sceneManager,
      );
      if (command.validate() !== null) return;
      deps.execute(command);
      return;
    }
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

  // `copy` was already resolved above (the rect-explode branch consumed it) — pass it
  // explicitly rather than re-reading the live intent.
  commitGripRotation({ entityId: grip.entityId, pivot: res.pivot, angleDeg: res.sweptDeg, sceneManager, execute: deps.execute, copy });
}

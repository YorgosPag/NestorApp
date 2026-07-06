/**
 * Linear / non-parametric grip commit handlers (xline / ray / dimension).
 *
 * Extracted from grip-parametric-commits.ts (N.7.1 file-size split). These
 * entities are NOT params-driven: they expose direct geometry fields, so each
 * commit applies the grip drag and patches the scene model directly (no
 * dedicated UpdateXParamsCommand). Re-exported from grip-parametric-commits.ts
 * so the commit API stays one import.
 */
import type { Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { UnifiedGripInfo } from './unified-grip-types';
import type { DxfCommitDeps } from './unified-grip-types';
import type { XLineEntity, RayEntity, DimensionEntity } from '../../types/entities';
import type { DxfDimension, DxfLine } from '../../canvas-v2/dxf-canvas/dxf-types';
import { applyXLineGripDrag } from '../../systems/xline/xline-grips';
import { applyRayGripDrag } from '../../systems/ray/ray-grips';
import { applyDimensionGripDrag, diffDimEntity } from '../dimensions/useDimensionGrips';
import { UpdateDimGripCommand } from '../../core/commands/entity-commands/UpdateDimGripCommand';
import { createSceneManagerAdapter } from './grip-commit-adapters';
// ADR-363 Slice F — line rotation commit reuses the canonical rotate SSoT.
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { sweptAngleDegAboutPivot } from '../../bim/grips/grip-math';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
// ADR-561 EXT (Ctrl-rotate-copy) — copy intent SSoT (the right-click «Copy» toggle OR live
// Ctrl/⌘), the SAME predicate the move-copy + primitive rotate-copy commits use.
import { isGripCopyIntent } from '../../systems/grip/grip-copy-intent';

/**
 * ADR-359 Phase 11 — XLine grip commit via `applyXLineGripDrag` + direct scene
 * patch. Bypasses stretch/move because XLine has no vertex array: only
 * `basePoint` (translate) and `direction` (rotate) fields. Follows the
 * dimension-grip pattern (scene patch without a dedicated command).
 */
export function commitXLineGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.xlineGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as Record<string, unknown>).type !== 'xline') return;
  const entity = raw as unknown as XLineEntity;
  const currentPos: Point2D = translatePoint(grip.position, delta);
  const updates = applyXLineGripDrag(grip.xlineGripKind, { entity, delta, currentPos });
  if (Object.keys(updates).length === 0) return;
  sceneManager.updateEntity(grip.entityId, updates as unknown as Partial<SceneEntity>);
}

/**
 * ADR-359 Phase 11 — Ray grip commit via `applyRayGripDrag` + direct scene
 * patch. Mirrors `commitXLineGripDrag` for semi-infinite lines.
 */
export function commitRayGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.rayGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as Record<string, unknown>).type !== 'ray') return;
  const entity = raw as unknown as RayEntity;
  const currentPos: Point2D = translatePoint(grip.position, delta);
  const updates = applyRayGripDrag(grip.rayGripKind, { entity, delta, currentPos });
  if (Object.keys(updates).length === 0) return;
  sceneManager.updateEntity(grip.entityId, updates as unknown as Partial<SceneEntity>);
}

/**
 * ADR-363 Slice F — plain DXF line rotation commit. The line is a primitive
 * (`start`/`end`, no params), so the rotation routes through the CANONICAL
 * `RotateEntityCommand` (the same undoable, merge-coalescing command the rotate
 * tool uses) — NOT a bespoke transform. The hot-grip flow publishes {pivot,anchor}
 * in `BimRotateHotGripStore` before commit (mirror `commitWallGripDrag`); the
 * swept angle = `angle(anchor+delta) − angle(anchor)` about the pivot. Falls back
 * to the line midpoint + grip position (legacy drag-handle) when no rotate context
 * is published. A degenerate / zero sweep is a no-op (cursor on the pivot).
 */
export function commitLineGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.lineGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as Record<string, unknown>).type !== 'line') return;
  const line = raw as unknown as DxfLine;
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot = rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const pivot: Point2D = useRotatePivot
    ? rotateCtx.pivot!
    : { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 };
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = translatePoint(anchor, delta);
  const sweptDeg = sweptAngleDegAboutPivot(pivot, anchor, currentPos);
  if (sweptDeg === null || sweptDeg === 0) return;
  // ADR-561 EXT — Ctrl (or the right-click «Copy» toggle) held → rotate a CLONE about the
  // pivot (AutoCAD ROTATE-Copy / hinge), leaving the original untouched. Same copy predicate
  // the move-copy uses; `RotateEntityCommand.copyMode` owns the clone + undo/redo (ADR-357 Φ12).
  const command = new RotateEntityCommand([grip.entityId], pivot, sweptDeg, sceneManager, false, isGripCopyIntent());
  if (command.validate() !== null) return;
  deps.execute(command);
}

/** ADR-362 Phase I2 — Dimension grip commit via `applyDimensionGripDrag` + scene patch. */
export function commitDimensionGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.dimGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as Record<string, unknown>).type !== 'dimension') return;
  // SceneModel stores DimensionEntity directly (no DxfDimension wrapper).
  // useDxfSceneConversion wraps it in DxfDimension only for the rendering
  // pipeline — it is NOT persisted back to the scene model.
  // SceneModel stores DimensionEntity directly (no DxfDimension wrapper) — the
  // wrapper is created only for the rendering pipeline, never persisted back.
  const asWrapper = raw as unknown as DxfDimension;
  const dimEntity: DimensionEntity = asWrapper.dimensionEntity ?? (raw as unknown as DimensionEntity);
  const newDimEntity = applyDimensionGripDrag(grip.dimGripKind, dimEntity, delta, grip.position);
  if (newDimEntity === dimEntity) return;
  // ADR-362 Round 22 — undoable + drag-coalescing commit via the MergeableUpdateCommand
  // base (replaces the legacy direct sceneManager.updateEntity, which had NO undo). The
  // minimal symmetric patch is the SSoT diff; an empty patch (zero-delta click) is a no-op.
  const { patch, previous } = diffDimEntity(dimEntity, newDimEntity);
  if (Object.keys(patch).length === 0) return;
  const command = new UpdateDimGripCommand(grip.entityId, patch, previous, sceneManager, false);
  if (command.validate() !== null) return;
  deps.execute(command);
}

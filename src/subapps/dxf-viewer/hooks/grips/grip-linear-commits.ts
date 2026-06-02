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
import type { SceneEntity } from '../../core/commands/interfaces';
import type { UnifiedGripInfo } from './unified-grip-types';
import type { DxfCommitDeps } from './unified-grip-types';
import type { XLineEntity, RayEntity, DimensionEntity } from '../../types/entities';
import type { DxfDimension } from '../../canvas-v2/dxf-canvas/dxf-types';
import { applyXLineGripDrag } from '../../systems/xline/xline-grips';
import { applyRayGripDrag } from '../../systems/ray/ray-grips';
import { applyDimensionGripDrag } from '../dimensions/useDimensionGrips';
import { createSceneManagerAdapter } from './grip-commit-adapters';

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
  const currentPos: Point2D = { x: grip.position.x + delta.x, y: grip.position.y + delta.y };
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
  const currentPos: Point2D = { x: grip.position.x + delta.x, y: grip.position.y + delta.y };
  const updates = applyRayGripDrag(grip.rayGripKind, { entity, delta, currentPos });
  if (Object.keys(updates).length === 0) return;
  sceneManager.updateEntity(grip.entityId, updates as unknown as Partial<SceneEntity>);
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
  const asWrapper = raw as unknown as DxfDimension;
  const dimEntity: DimensionEntity = asWrapper.dimensionEntity ?? (raw as unknown as DimensionEntity);
  const newDimEntity = applyDimensionGripDrag(grip.dimGripKind, dimEntity, delta, grip.position);
  if (newDimEntity === dimEntity) return;
  if (asWrapper.dimensionEntity) {
    // Rare: entity was stored as a DxfDimension wrapper — update nested field.
    sceneManager.updateEntity(grip.entityId, { dimensionEntity: newDimEntity } as unknown as Partial<SceneEntity>);
  } else {
    // Common: entity is a raw DimensionEntity — patch its fields directly.
    sceneManager.updateEntity(grip.entityId, newDimEntity as unknown as Partial<SceneEntity>);
  }
}

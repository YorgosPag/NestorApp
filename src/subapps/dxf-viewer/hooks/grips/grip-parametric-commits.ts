/**
 * Parametric grip commit handlers (stair / wall / opening / slab / dimension).
 *
 * Extracted from grip-commit-adapters.ts (ADR-358 Phase 5b, ADR-363 Phase 1C /
 * 2.5 / 3.5, ADR-362 Phase I2). Each handler bypasses the generic stretch /
 * move path because the underlying entity is parametric: geometry is derived
 * from `params`, so the commit recomputes geometry atomically via a dedicated
 * UpdateXParamsCommand. Merge window (ADR-031) is enabled for wall / opening /
 * slab so a continuous drag collapses into a single undo entry.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo } from './unified-grip-types';
import type { DxfCommitDeps } from './unified-grip-types';
import type { StairEntity } from '../../bim/types/stair-types';
import type { WallEntity, WallKind } from '../../bim/types/wall-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateFoundationParamsCommand } from '../../core/commands/entity-commands/UpdateFoundationParamsCommand';
import { UpdateMepSegmentParamsCommand } from '../../core/commands/entity-commands/UpdateMepSegmentParamsCommand';
import { applyStairGripDrag } from '../../bim/stairs/stair-grips';
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { applyFoundationGripDrag } from '../../bim/foundations/foundation-grips';
import { applyMepSegmentGripDrag } from '../../bim/mep-segments/mep-segment-grips';
import { executeSegmentMoveWithConnectedPipes } from '../../bim/mep-segments/build-connectivity-host-update';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { EventBus } from '../../systems/events/EventBus';
import type { Entity } from '../../types/entities';
import { resolveColumnSectionLock } from '../../bim/structural/sizing/column-size-patch';
import { resolveBeamSectionLock } from '../../bim/structural/sizing/beam-size-patch';
import { buildPadSizingInput, resolvePadSectionLock } from '../../bim/structural/sizing/pad-size-patch';
import {
  resolveActiveColumnDesignMoment,
  resolveActiveBeamSupportType,
  resolveActiveBeamTorsion,
  resolveActiveBeamSpanMm,
  resolveActiveBeamSizingLimits,
} from '../../bim/structural/active-reinforcement';
import { resolveStructuralCode } from '../../bim/structural/codes';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { createSceneManagerAdapter } from './grip-commit-adapters';

// ADR-363 Phase 2.5 / Φ1G.5 — parametric opening grip commits (drag-along-wall +
// Alt-move re-host) live in grip-parametric-opening-commits.ts (N.7.1 file-size
// split). Re-exported here so the commit API stays one import.
export { commitOpeningGripDrag, commitOpeningAltMove } from './grip-parametric-opening-commits';

// ADR-551 — parametric text/mtext grip commit (rect-box parity) lives in
// grip-parametric-text-commits.ts (N.7.1 file-size split). Re-exported here.
export { commitTextGripDrag } from './grip-parametric-text-commits';

// ADR-397 — MOVE→COPY hot-grip handlers live in grip-parametric-copy.ts
// (N.7.1 file-size split). Re-exported here so the commit API stays one import.
export { commitWallCopy, commitBeamCopy, commitColumnCopy, commitMepFixtureCopy, commitElectricalPanelCopy, commitMepManifoldCopy, commitMepRadiatorCopy, commitMepBoilerCopy, commitFurnitureCopy, commitFloorplanSymbolCopy, commitHotGripCopy } from './grip-parametric-copy';

// Linear / non-parametric grip commits (xline / ray / dimension) live in
// grip-linear-commits.ts (N.7.1 file-size split). Re-exported here so the
// commit API stays one import.
export {
  commitXLineGripDrag,
  commitRayGripDrag,
  commitDimensionGripDrag,
} from './grip-linear-commits';

// ADR-406 / ADR-408 Φ3 / ADR-410 — centred-box grip commits (mep-fixture /
// electrical panel / furniture) live in grip-parametric-centred-box-commits.ts
// (N.7.1 file-size split). Re-exported here so the commit API stays one import.
export {
  commitMepFixtureGripDrag,
  commitElectricalPanelGripDrag,
  commitMepManifoldGripDrag,
  commitMepManifoldOutletCountGrip,
  commitFurnitureGripDrag,
  commitFloorplanSymbolGripDrag,
} from './grip-parametric-centred-box-commits';

// ADR-408 Εύρος Β / DHW / Φ-C — heating + DHW point-host centred-box grip commits
// (radiator / boiler / water-heater) live in grip-parametric-heating-host-commits.ts
// (N.7.1 file-size split). Re-exported here so the commit API stays one import.
export {
  commitMepRadiatorGripDrag,
  commitMepBoilerGripDrag,
  commitMepWaterHeaterGripDrag,
} from './grip-parametric-heating-host-commits';

// ADR-408 Εύρος Β #3 — polygon-footprint grip commits (underfloor) live in
// grip-polygon-commits.ts (N.7.1 file-size split). Re-exported here so the
// commit API stays one import.
export { commitMepUnderfloorGripDrag } from './grip-polygon-commits';

// ADR-363 / ADR-417 / ADR-419 — polygon-footprint vertex grip commits (slab /
// roof / slab-opening / floor-finish) live in grip-parametric-footprint-commits.ts
// (N.7.1 file-size split). Re-exported here so the commit API stays one import.
export {
  commitSlabGripDrag,
  commitRoofGripDrag,
  commitSlabOpeningGripDrag,
  commitFloorFinishGripDrag,
  commitHatchGripDrag,
} from './grip-parametric-footprint-commits';

// ADR-510 Φ3c — polyline arc-apex bulge drag lives in grip-polyline-bulge-commit.ts
// (N.7.1 file-size split). Re-exported so the commit API stays one import.
export { commitPolylineBulgeGripDrag } from './grip-polyline-bulge-commit';

/**
 * ADR-358 Phase 5b — Parametric stair grip commit. Bypasses the standard
 * stretch / move / rotate strategies because `StairEntity` is parametric:
 * geometry is fully derived from `params`, so the grip drag transforms params
 * (via `applyStairGripDrag`) and the command (`UpdateStairParamsCommand`)
 * recomputes geometry atomically. Idempotent + undo/redo-safe.
 */
export function commitStairGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.stairGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<StairEntity>;
  if (candidate.type !== 'stair' || !candidate.params) return;
  const stair = candidate as StairEntity;
  const originalParams = stair.params;
  const currentPos: Point2D = { x: grip.position.x + delta.x, y: grip.position.y + delta.y };
  const newParams = applyStairGripDrag(grip.stairGripKind, {
    originalParams,
    delta,
    currentPos,
    // ADR-393 v2 Phase 2 — multi-flight corner transforms read the last flight's
    // direction from the walkline; supply the drag-start geometry as that SSoT.
    geometry: stair.geometry,
  });
  const command = new UpdateStairParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    false,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
}

/**
 * ADR-363 Phase 1C — Parametric wall grip commit. Bypasses the standard
 * stretch / move strategies because `WallEntity` is parametric: geometry is
 * fully derived from `params`, so the grip drag transforms params (via
 * `applyWallGripDrag`) and the command (`UpdateWallParamsCommand`) recomputes
 * geometry + validation atomically. Merge window enabled (isDragging=true) so
 * a continuous drag collapses into a single undo entry (ADR-031).
 */
export function commitWallGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.wallGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<WallEntity>;
  if (candidate.type !== 'wall' || !candidate.params) return;
  const wall = candidate as WallEntity;
  const originalParams = wall.params;
  // ADR-363 Phase 1G — the wall-rotation 3-click hot-grip rotates around a picked
  // centre. The hook publishes {pivot, anchor} in WallRotateHotGripStore; the
  // delta passed here is `cursor − anchor`, so `currentPos = anchor + delta` is
  // the live cursor and `pivot` is the rotation centre. All other wall grips (and
  // the legacy rotation drag) use the grip position as the anchor.
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.wallGripKind === 'wall-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = {
    x: anchor.x + delta.x,
    y: anchor.y + delta.y,
  };
  const newParams = applyWallGripDrag(grip.wallGripKind, {
    originalParams,
    delta,
    currentPos,
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  const kind: WallKind = wall.kind ?? 'straight';
  const wallCmd = new UpdateWallParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
    kind,
  );
  if (wallCmd.validate() !== null) return;
  // ADR-363 §5.4 — hosted-opening cascade now lives inside UpdateWallParamsCommand
  // (covers every param path uniformly, same offsetFromStart). No wrapper needed.
  deps.execute(wallCmd);
  emitBimEntityParamsUpdated('wall', grip.entityId);
}

/**
 * ADR-363 Phase 5.5a — Parametric beam grip commit. Bypasses the standard
 * stretch / move strategies because `BeamEntity` is parametric: geometry is
 * fully derived from `params`, so the grip drag transforms params (via
 * `applyBeamGripDrag`) and the command (`UpdateBeamParamsCommand`) recomputes
 * geometry + validation atomically. Merge window enabled (isDragging=true) so
 * a continuous drag collapses σε ένα undo entry (ADR-031). Emits
 * `bim:beam-params-updated` after dispatch ώστε consumers (auto-save / BOQ
 * feed) να αντιδρούν.
 */
export function commitBeamGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.beamGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<BeamEntity>;
  if (candidate.type !== 'beam' || !candidate.params) return;
  const beam = candidate as BeamEntity;
  const originalParams = beam.params;
  // ADR-363 Phase 5.5d — the `beam-rotation` 6-click hot-grip rotates around a
  // picked centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore;
  // delta is `alignDir − refDir`, so `currentPos = anchor + delta` is the live
  // align point and `pivot` is the rotation centre (mirror commitWallGripDrag /
  // commitColumnGripDrag). All other beam grips use the grip position as anchor.
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.beamGripKind === 'beam-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyBeamGripDrag(grip.beamGripKind, {
    originalParams,
    delta,
    currentPos,
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  // ADR-503 Slice 3 — grip resize ΔΙΑΤΟΜΗΣ (depth/width) = χειροκίνητη διατομή → safety-gated lock
  // (ίδιο SSoT με panel, mirror κολώνας): ≥ επαρκές → lock (`autoSized:false`)· < επαρκές → ΜΠΛΟΚ
  // (clamp στο ελάχιστο επαρκές ύψος, μένει AUTO). Endpoint/rotation grips → δεν αλλάζει διατομή
  // → pass-through (το auto-size μένει ενεργό για re-size on span).
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  const lock = resolveBeamSectionLock(
    provider, beam, originalParams, newParams,
    resolveActiveBeamSupportType(grip.entityId), resolveActiveBeamTorsion(grip.entityId),
    resolveActiveBeamSpanMm(grip.entityId), resolveActiveBeamSizingLimits(grip.entityId),
  );
  const command = new UpdateBeamParamsCommand(
    grip.entityId,
    lock.params,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('beam', grip.entityId);
  if (lock.rejected) {
    EventBus.emit('bim:beam-section-rejected', {
      beamId: grip.entityId, depth: newParams.depth, minDepth: lock.minDepthMm,
    });
  }
}

/**
 * ADR-408 Φ8/Φ15 — MEP segment parametric grip commit (start/end/midpoint
 * translate + section resize + rotation). 1:1 mirror of `commitBeamGripDrag`:
 * routes through `applyMepSegmentGripDrag()` + `UpdateMepSegmentParamsCommand`
 * (geometry recomputed atomically), NOT the generic StretchEntityCommand/move —
 * a segment is params-driven (axis endpoints). A vertical riser exposes only the
 * whole-entity `mep-segment-midpoint` move, so a plan drag translates the stack
 * (both endpoints) keeping the Z-span. Emits `bim:mep-segment-params-updated`
 * after dispatch so consumers (auto-save / fittings / 3D sync) react. Merge
 * window enabled (isDragging=true) collapses a continuous drag into one undo.
 */
export function commitMepSegmentGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.mepSegmentGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepSegmentEntity>;
  if (candidate.type !== 'mep-segment' || !candidate.params) return;
  const segment = candidate as MepSegmentEntity;
  const originalParams = segment.params;
  // `mep-segment-rotation` 6-click hot-grip rotates around a picked centre — the
  // hook publishes {pivot, anchor} in BimRotateHotGripStore (mirror beam). All
  // other segment grips use the grip position as anchor.
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.mepSegmentGripKind === 'mep-segment-rotation' &&
    rotateCtx.pivot !== null &&
    rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyMepSegmentGripDrag(grip.mepSegmentGripKind, {
    originalParams,
    delta,
    currentPos,
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const segmentCommand = new UpdateMepSegmentParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (segmentCommand.validate() !== null) return;
  // ADR-408 Φ-C — connectivity-preserving move: coincident endpoints of neighbouring
  // pipes follow this dragged run (XY + Z) in one undo (Revit "drag pipe drags joins").
  executeSegmentMoveWithConnectedPipes({
    prevSegment: segment,
    nextParams: newParams,
    segmentCommand,
    sceneManager,
    execute: deps.execute,
  });
}

/** ADR-363 Phase 4.5 — parametric column grip commit via UpdateColumnParamsCommand. */
export function commitColumnGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.columnGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<ColumnEntity>;
  if (candidate.type !== 'column' || !candidate.params) return;
  const column = candidate as ColumnEntity;
  const originalParams = column.params;
  // ADR-397 — the column-rotation 6-click hot-grip rotates around a picked
  // centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore; delta
  // is `cursor − anchor`, so `currentPos = anchor + delta` is the live cursor and
  // `pivot` is the rotation centre. Mirror of commitWallGripDrag. All other
  // column grips use the grip position as the anchor.
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.columnGripKind === 'column-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyColumnGripDrag(grip.columnGripKind, {
    originalParams,
    delta,
    currentPos,
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  // ADR-503 Slice 2 — section-resize grip (`column-width`/`column-depth`) = χειροκίνητη
  // διατομή → safety-gated lock (ίδιο SSoT με panel): ≥ επαρκές → lock· < επαρκές → ΜΠΛΟΚ
  // (clamp στο ελάχιστο επαρκές, μένει AUTO). Endpoint/rotation grips → δεν αλλάζει διατομή → pass-through.
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  const lock = resolveColumnSectionLock(provider, originalParams, newParams, resolveActiveColumnDesignMoment(grip.entityId));
  const command = new UpdateColumnParamsCommand(
    grip.entityId,
    lock.params,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('column', grip.entityId);
  if (lock.rejected) {
    EventBus.emit('bim:column-section-rejected', {
      columnId: grip.entityId, w: newParams.width, d: newParams.depth, minW: lock.minWidthMm, minD: lock.minDepthMm,
    });
  }
}

/**
 * ADR-436 Slice 1b — parametric foundation pad grip commit via
 * `UpdateFoundationParamsCommand`. 1:1 mirror of `commitColumnGripDrag`: routes
 * through `applyFoundationGripDrag()` (rotation + width/length resize + Alt-move)
 * — NOT the generic stretch/move — because the pad is params-driven (geometry
 * recomputed atomically). The `foundation-rotation` 6-click hot-grip rotates
 * around a picked centre published in `BimRotateHotGripStore`; all other grips
 * use the grip position as the anchor. Merge window enabled (isDragging=true)
 * collapses a continuous drag into one undo (ADR-031).
 */
export function commitFoundationGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.foundationGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<FoundationEntity>;
  if (candidate.type !== 'foundation' || !candidate.params) return;
  const foundation = candidate as FoundationEntity;
  const originalParams = foundation.params;
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.foundationGripKind === 'foundation-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyFoundationGripDrag(grip.foundationGripKind, {
    originalParams,
    delta,
    currentPos,
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  // ADR-503 Slice 3 — pad width/length resize = χειροκίνητη διάσταση → safety-gated lock (mirror
  // κολώνας/δοκού· lock-flag = `autoDesigned`, ο reconciler ξαναδιαστασιολογεί μόνο autoDesigned).
  // ≥ επαρκές → lock· < επαρκές → ΜΠΛΟΚ (clamp στην ελάχιστη επαρκή). strip/tie-beam → pass-through.
  let finalParams = newParams;
  let padRejection: { w: number; l: number; minW: number; minL: number } | null = null;
  if (newParams.kind === 'pad' && originalParams.kind === 'pad') {
    const input = buildPadSizingInput(
      foundation,
      sceneManager.getEntities() as unknown as readonly Entity[],
      useStructuralSettingsStore.getState().soilBearingCapacityKpa,
    );
    if (input) {
      const lock = resolvePadSectionLock(input, originalParams, newParams);
      finalParams = lock.params;
      if (lock.rejected) {
        padRejection = { w: newParams.width, l: newParams.length, minW: lock.minWidthMm, minL: lock.minLengthMm };
      }
    }
  }
  const command = new UpdateFoundationParamsCommand(
    grip.entityId,
    finalParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('foundation', grip.entityId);
  if (padRejection) {
    EventBus.emit('bim:foundation-section-rejected', { foundationId: grip.entityId, ...padRejection });
  }
}

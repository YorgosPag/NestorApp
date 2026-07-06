'use client';

/**
 * useDimensionModify — ADR-362 Phase K (DIMBREAK + DIMSPACE wiring).
 *
 * Thin shell host (mirror of `useStructuralFootingConnect`): listens to the
 * selection-driven ribbon requests from the DIMENSION contextual tab and runs
 * ONE undoable command per gesture (wrapped in a `CompositeCommand` when it
 * touches several dimensions, so a single Ctrl+Z reverts the whole operation —
 * Revit «transaction group»).
 *
 *   · **DIMSPACE** (`dim:space-requested`): select ≥2 parallel linear/aligned
 *     dims; the first is the base, the rest are evenly re-spaced via
 *     `computeDimSpacing` → `UpdateEntityCommand({ defPoints })`.
 *   · **DIMBREAK** (`dim:break-requested`): per selected dim, compute the
 *     crossing-entity break points ONCE (`computeAutoBreakPoints`) and persist
 *     them as `manualBreaks`; a second invocation on an already-broken dim
 *     clears them (toggle, AutoCAD «remove»). The renderer applies the gaps.
 *
 * Reuses the existing engines (`dim-space-engine`, `dim-break-engine`), the
 * generic `UpdateEntityCommand`, `CompositeCommand`, and the DIMSTYLE resolver
 * — zero new command classes. Mounted ONCE by the viewer shell.
 *
 * @see systems/dimensions/dim-space-engine.ts / dim-break-engine.ts
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md §D12
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { UpdateEntityCommand } from '../core/commands/entity-commands/UpdateEntityCommand';
import { openDimTextOverride } from '../ui/panels/dimensions/DimTextOverrideStore';
// ADR-362 §7 — «Επεξεργασία Στυλ…»: hand the selected dim's styleId to the Style Manager.
import { requestEditDimStyle } from '../ui/panels/dimensions/DimStyleEditorStore';
import { CompositeCommand } from '../core/commands/CompositeCommand';
import type { ICommand, ISceneManager } from '../core/commands/interfaces';
import { getDimStyleRegistry } from '../systems/dimensions/dim-style-registry';
import { resolveDimStyle } from '../systems/dimensions/dim-style-resolver';
import { buildDimensionGeometry } from '../systems/dimensions/dim-geometry-builder';
import { computeDimSpacing } from '../systems/dimensions/dim-space-engine';
import { computeAutoBreakPoints } from '../systems/dimensions/dim-break-engine';
// ADR-362 — «Επιλογή σειράς»: row detection + selection replacement SSoT.
import { collectDimensionRow } from '../systems/dimensions/dim-row-detect';
import { SelectedEntitiesStore } from '../systems/selection/SelectedEntitiesStore';
// 2026-07-04 — «Διαγραφή» reuses the canonical delete core (undoable + cascades),
// the SAME SSoT the ribbon (`useRibbonEntityDelete`) + keyboard (`useSmartDelete`) use.
import { deleteEntitiesById } from './canvas/delete-entities-core';
// ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών»: row group-move commit reuses the
// canonical dim-grip transform + undoable command (no new command class).
import { UpdateDimGripCommand } from '../core/commands/entity-commands/UpdateDimGripCommand';
import { applyDimensionGripDrag, diffDimEntity } from './dimensions/useDimensionGrips';
import type { Point2D } from '../rendering/types/Types';
import type { DimensionEntity, DimensionManualBreaks } from '../types/dimension';
import { isDimensionEntity, type Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

interface ModifyContext {
  readonly entities: readonly Entity[];
  readonly sm: ISceneManager;
}

/** True when any segment carries at least one break point. */
function hasAnyBreak(b: DimensionManualBreaks): boolean {
  return Boolean(
    b.dimLinePoints?.length ||
    b.extLine1Points?.length ||
    b.extLine2Points?.length ||
    b.leaderPoints?.length,
  );
}

/** Execute one command, or wrap many in a single atomic-undo CompositeCommand. */
function runAtomic(commands: readonly ICommand[], execute: (c: ICommand) => void): void {
  if (commands.length === 0) return;
  execute(commands.length === 1 ? commands[0] : new CompositeCommand(commands));
}

/** DIMBREAK — per dim, toggle persisted `manualBreaks` (compute once / clear). */
export function buildBreakCommands(
  dims: readonly DimensionEntity[],
  ctx: ModifyContext,
): ICommand[] {
  const lookup = (id: string): DimensionEntity | undefined =>
    ctx.entities.find((e) => e.id === id && isDimensionEntity(e)) as DimensionEntity | undefined;
  const crossings = ctx.entities.filter((e) => !isDimensionEntity(e));
  const registry = getDimStyleRegistry();
  const commands: ICommand[] = [];

  for (const dim of dims) {
    if (dim.manualBreaks) {
      // Toggle off — clear the persisted breaks (AutoCAD «remove»).
      commands.push(new UpdateEntityCommand(dim.id, { manualBreaks: undefined }, ctx.sm, 'DIMBREAK remove'));
      continue;
    }
    let geometry;
    try {
      geometry = buildDimensionGeometry(dim, resolveDimStyle(dim, registry), lookup);
    } catch {
      continue; // degenerate / unresolved geometry — skip this dim
    }
    const breaks = computeAutoBreakPoints(geometry, crossings);
    if (hasAnyBreak(breaks)) {
      commands.push(new UpdateEntityCommand(dim.id, { manualBreaks: breaks }, ctx.sm, 'DIMBREAK'));
    }
  }
  return commands;
}

/** DIMSPACE — even-space the selected linear/aligned dims around the first. */
export function buildSpaceCommands(
  dims: readonly DimensionEntity[],
  ctx: ModifyContext,
): ICommand[] {
  const spaceable = dims.filter(
    (d) => d.dimensionType === 'linear' || d.dimensionType === 'aligned',
  );
  if (spaceable.length < 2) return [];

  const [base, ...targets] = spaceable;
  const style = resolveDimStyle(base, getDimStyleRegistry());
  const result = computeDimSpacing(base, targets, style, 'auto');

  const commands: ICommand[] = [];
  for (const [id, patch] of result) {
    commands.push(new UpdateEntityCommand(id, { defPoints: patch.defPoints }, ctx.sm, 'DIMSPACE'));
  }
  return commands;
}

/**
 * ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών»: offset every dim of a row by the
 * SAME perpendicular `delta` (already projected + step-snapped by the overlay).
 * Reuses the canonical `applyDimensionGripDrag('dim-line-ref')` (patches defPoints[2]
 * only — never the ext-line origins, so the measured value is preserved) + the
 * undoable `UpdateDimGripCommand`. The caller wraps the list in a `CompositeCommand`
 * so one Ctrl+Z reverts the whole row move.
 */
export function buildRowMoveCommands(
  dims: readonly DimensionEntity[],
  delta: Point2D,
  ctx: ModifyContext,
): ICommand[] {
  const commands: ICommand[] = [];
  for (const dim of dims) {
    const anchor = dim.defPoints[2] ?? { x: 0, y: 0 };
    const moved = applyDimensionGripDrag('dim-line-ref', dim, delta, anchor);
    const { patch, previous } = diffDimEntity(dim, moved);
    if (Object.keys(patch).length === 0) continue;
    commands.push(new UpdateDimGripCommand(dim.id, patch, previous, ctx.sm, false));
  }
  return commands;
}

/** «Εφαρμογή Στυλ» — set every selected dim's `styleId` to `styleId` (undoable). */
export function buildApplyStyleCommands(
  dims: readonly DimensionEntity[],
  styleId: string,
  ctx: ModifyContext,
): ICommand[] {
  const commands: ICommand[] = [];
  for (const dim of dims) {
    if (dim.styleId !== styleId) {
      commands.push(new UpdateEntityCommand(dim.id, { styleId }, ctx.sm, 'Apply DIMSTYLE'));
    }
  }
  return commands;
}

/**
 * ADR-362 §7 — «Επαναφορά Παρακάμψεων»: clear every selected dim's per-entity
 * `overrides` so it resolves back to its pure DIMSTYLE (AutoCAD «reset to style»).
 * Skips dims that carry no overrides (no-op → no undo entry). Mirrors
 * `buildApplyStyleCommands`: the generic `UpdateEntityCommand`, zero new classes.
 */
export function buildResetOverridesCommands(
  dims: readonly DimensionEntity[],
  ctx: ModifyContext,
): ICommand[] {
  const commands: ICommand[] = [];
  for (const dim of dims) {
    if (dim.overrides && Object.keys(dim.overrides).length > 0) {
      commands.push(new UpdateEntityCommand(dim.id, { overrides: undefined }, ctx.sm, 'Reset dimension overrides'));
    }
  }
  return commands;
}

/**
 * ADR-362 §7 — «Επαναφορά Θέσης»: clear the manual `textMidpoint` on every selected
 * dim so the geometry builder recomputes the default text placement (AutoCAD
 * DIMTEDIT «Home»). Skips dims whose text is already at the default (no `textMidpoint`).
 */
export function buildResetTextPositionCommands(
  dims: readonly DimensionEntity[],
  ctx: ModifyContext,
): ICommand[] {
  const commands: ICommand[] = [];
  for (const dim of dims) {
    if (dim.textMidpoint) {
      commands.push(new UpdateEntityCommand(dim.id, { textMidpoint: undefined }, ctx.sm, 'Reset dimension text position'));
    }
  }
  return commands;
}

export function useDimensionModify(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const resolve = (entityIds: readonly string[]): { ctx: ModifyContext; dims: DimensionEntity[] } | null => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return null;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return null;
      const sm = createLevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelId);
      const entities = scene.entities as unknown as readonly Entity[];
      const selected = new Set(entityIds);
      const dims = entities.filter((e): e is DimensionEntity => selected.has(e.id) && isDimensionEntity(e));
      if (dims.length === 0) return null;
      return { ctx: { entities, sm }, dims };
    };

    const unsubBreak = EventBus.on('dim:break-requested', ({ entityIds }) => {
      const r = resolve(entityIds);
      if (!r) return;
      runAtomic(buildBreakCommands(r.dims, r.ctx), execute);
    });

    const unsubSpace = EventBus.on('dim:space-requested', ({ entityIds }) => {
      const r = resolve(entityIds);
      if (!r) return;
      runAtomic(buildSpaceCommands(r.dims, r.ctx), execute);
    });

    const unsubApplyStyle = EventBus.on('dim:apply-style-requested', ({ entityIds }) => {
      const r = resolve(entityIds);
      if (!r) return;
      // Source = the primary selected dim (entityIds[0], selection order).
      const source = r.dims.find((d) => d.id === entityIds[0]) ?? r.dims[0];
      runAtomic(buildApplyStyleCommands(r.dims, source.styleId, r.ctx), execute);
    });

    // ADR-362 — «Επιλογή σειράς»: expand the primary selected dim to its whole
    // collinear row, then replace the selection with the row (so DIMSPACE / drag
    // act on the entire band). Reads ALL scene dims (not just the current
    // selection) so a single-dim pick can grow to the full row.
    const unsubSelectRow = EventBus.on('dim:select-row-requested', ({ entityIds }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const allEntities = scene.entities as unknown as readonly Entity[];
      const allDims = allEntities.filter(isDimensionEntity);
      const primary = allDims.find((d) => d.id === entityIds[0]);
      if (!primary) return;
      const row = collectDimensionRow(primary, allDims);
      SelectedEntitiesStore.selectEntities(
        row.map((d) => ({ id: d.id, type: 'dxf-entity' as const })),
      );
    });

    // ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών»: the overlay emits the row's
    // dim ids + the projected perpendicular delta on handle release; offset the
    // whole row's dim lines as ONE atomic-undo command.
    const unsubRowMove = EventBus.on('dim:row-move-requested', ({ entityIds, delta }) => {
      const r = resolve(entityIds);
      if (!r) return;
      runAtomic(buildRowMoveCommands(r.dims, delta, r.ctx), execute);
    });

    // 2026-07-04 — «Διαγραφή»: delete the selected dimension(s) through the
    // canonical `deleteEntitiesById` core (undoable + cascades), then clear the
    // dxf-entity selection so the contextual tab closes (mirror of the keyboard /
    // `useRibbonEntityDelete` paths). Confirm already happened in special-actions.
    // Builds the adapter directly (proper `LevelSceneManagerAdapter` type) instead
    // of reusing `resolve()`'s widened `ISceneManager`.
    const unsubDelete = EventBus.on('dim:delete-requested', ({ entityIds }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const adapter = createLevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelId);
      const entities = scene.entities as unknown as readonly Entity[];
      const selected = new Set(entityIds);
      const dimIds = entities
        .filter((e): e is DimensionEntity => selected.has(e.id) && isDimensionEntity(e))
        .map((d) => d.id);
      if (dimIds.length === 0) return;
      void deleteEntitiesById(dimIds, { adapter, sceneEntities: entities, executeCommand: execute })
        .then((ok) => { if (ok) SelectedEntitiesStore.clearByType('dxf-entity'); });
    });

    // ADR-362 Phase G1 (2026-07-06 fix) — «Παράκαμψη Κειμένου». Open: read the dim's
    // current `userText` from the level-scene SSoT and open the dialog pre-filled (so it
    // no longer depends on the dead module `SceneUpdateManager` singleton). Apply: run an
    // undoable `UpdateEntityCommand` that patches `userText` on the level scene.
    const unsubTextOverrideOpen = EventBus.on('dim:text-override-open-requested', ({ entityId }) => {
      const r = resolve([entityId]);
      if (!r) return;
      const dim = r.dims.find((d) => d.id === entityId);
      if (!dim) return;
      openDimTextOverride(entityId, dim.userText);
    });

    const unsubTextOverrideApply = EventBus.on('dim:text-override-apply-requested', ({ entityId, userText }) => {
      const r = resolve([entityId]);
      if (!r) return;
      runAtomic(
        [new UpdateEntityCommand(entityId, { userText }, r.ctx.sm, 'Dimension text override')],
        execute,
      );
    });

    // ADR-362 §7 — «Επαναφορά Παρακάμψεων»: clear every selected dim's `overrides`
    // (back to pure DIMSTYLE) as ONE atomic-undo command.
    const unsubResetOverrides = EventBus.on('dim:reset-overrides-requested', ({ entityIds }) => {
      const r = resolve(entityIds);
      if (!r) return;
      runAtomic(buildResetOverridesCommands(r.dims, r.ctx), execute);
    });

    // ADR-362 §7 — «Επαναφορά Θέσης»: clear the manual `textMidpoint` on every
    // selected dim so the builder recomputes the default text placement.
    const unsubResetTextPosition = EventBus.on('dim:reset-text-position-requested', ({ entityIds }) => {
      const r = resolve(entityIds);
      if (!r) return;
      runAtomic(buildResetTextPositionCommands(r.dims, r.ctx), execute);
    });

    // ADR-362 §7 — «Επεξεργασία Στυλ…»: resolve the primary selected dim's `styleId`
    // (level-scene SSoT) and hand it to the Style Manager store (no command — opens UI).
    const unsubEditStyle = EventBus.on('dim:edit-style-requested', ({ entityId }) => {
      const r = resolve([entityId]);
      if (!r) return;
      const dim = r.dims.find((d) => d.id === entityId) ?? r.dims[0];
      requestEditDimStyle(dim.styleId);
    });

    return () => {
      unsubBreak();
      unsubSpace();
      unsubApplyStyle();
      unsubSelectRow();
      unsubRowMove();
      unsubDelete();
      unsubTextOverrideOpen();
      unsubTextOverrideApply();
      unsubResetOverrides();
      unsubResetTextPosition();
      unsubEditStyle();
    };
  }, [levelManager, execute]);
}

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
import { CompositeCommand } from '../core/commands/CompositeCommand';
import type { ICommand, ISceneManager } from '../core/commands/interfaces';
import { getDimStyleRegistry } from '../systems/dimensions/dim-style-registry';
import { resolveDimStyle } from '../systems/dimensions/dim-style-resolver';
import { buildDimensionGeometry } from '../systems/dimensions/dim-geometry-builder';
import { computeDimSpacing } from '../systems/dimensions/dim-space-engine';
import { computeAutoBreakPoints } from '../systems/dimensions/dim-break-engine';
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

    return () => {
      unsubBreak();
      unsubSpace();
    };
  }, [levelManager, execute]);
}

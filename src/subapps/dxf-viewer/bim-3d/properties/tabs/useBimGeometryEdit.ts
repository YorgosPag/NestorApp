"use client";

/**
 * useBimGeometryEdit — dispatch BIM param edits from the 3D properties panel.
 *
 * ADR-402 Phase 1. The 3D geometry tab uses this to commit numeric-field edits
 * through the EXACT same view-agnostic commands as the 2D ribbon/panels
 * (`UpdateWallParamsCommand` etc.) via `createSceneManagerAdapter`. The 3D scene
 * then re-syncs automatically (command → setLevelScene → persistence host →
 * Bim3DEntitiesStore → BimViewport3D resync). No 3D-specific math.
 *
 * Returns `null` when there is no editable level context (e.g. the ADR-371
 * read-only Properties pipeline where `useLevelsOptional()` is null) — callers
 * fall back to read-only display.
 */

import { useCallback, useMemo } from 'react';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useCommandHistory } from '../../../core/commands';
import { createSceneManagerAdapter } from '../../../hooks/grips/grip-commit-adapters';
import type { DxfCommitDeps } from '../../../hooks/grips/unified-grip-types';
import type { ISceneManager } from '../../../core/commands/interfaces';
import { UpdateWallParamsCommand } from '../../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateColumnParamsCommand } from '../../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateBeamParamsCommand } from '../../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateSlabParamsCommand } from '../../../core/commands/entity-commands/UpdateSlabParamsCommand';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { BeamEntity, BeamParams } from '../../../bim/types/beam-types';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';

export interface BimGeometryEditApi {
  patchWall: (id: string, patch: Partial<WallParams>) => void;
  patchColumn: (id: string, patch: Partial<ColumnParams>) => void;
  patchBeam: (id: string, patch: Partial<BeamParams>) => void;
  patchSlab: (id: string, patch: Partial<SlabParams>) => void;
}

export function useBimGeometryEdit(): BimGeometryEditApi | null {
  const levels = useLevelsOptional();
  const { execute } = useCommandHistory();

  const buildAdapter = useCallback((): ISceneManager | null => {
    if (!levels?.currentLevelId) return null;
    const deps: DxfCommitDeps = {
      currentLevelId: levels.currentLevelId,
      getLevelScene: levels.getLevelScene,
      setLevelScene: levels.setLevelScene,
      execute,
      moveEntities: () => {},
      onToolChange: () => {},
    };
    return createSceneManagerAdapter(deps);
  }, [levels, execute]);

  const api = useMemo<BimGeometryEditApi>(() => ({
    patchWall: (id, patch) => {
      const sm = buildAdapter();
      const e = sm?.getEntity(id) as unknown as WallEntity | undefined;
      if (!sm || !e) return;
      execute(new UpdateWallParamsCommand(id, { ...e.params, ...patch }, e.params, sm, false, e.kind));
    },
    patchColumn: (id, patch) => {
      const sm = buildAdapter();
      const e = sm?.getEntity(id) as unknown as ColumnEntity | undefined;
      if (!sm || !e) return;
      execute(new UpdateColumnParamsCommand(id, { ...e.params, ...patch }, e.params, sm));
    },
    patchBeam: (id, patch) => {
      const sm = buildAdapter();
      const e = sm?.getEntity(id) as unknown as BeamEntity | undefined;
      if (!sm || !e) return;
      execute(new UpdateBeamParamsCommand(id, { ...e.params, ...patch }, e.params, sm));
    },
    patchSlab: (id, patch) => {
      const sm = buildAdapter();
      const e = sm?.getEntity(id) as unknown as SlabEntity | undefined;
      if (!sm || !e) return;
      execute(new UpdateSlabParamsCommand(id, { ...e.params, ...patch }, e.params, sm));
    },
  }), [buildAdapter, execute]);

  if (!levels) return null;
  return api;
}

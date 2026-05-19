'use client';

/**
 * ADR-358 Phase 7.5 — React adapter for `StairPresetsService` (G26, Q32).
 *
 * Owns:
 *   - Service instance lifecycle (memoized per `companyId|userId|projectId`).
 *   - Reactive presets list (refetched on save/delete via service cache invalidation).
 *   - `loadPreset` apply pipeline: full replace (Q32 industry convergence
 *     Revit/ArchiCAD/Vectorworks/AutoCAD/BricsCAD 5/5 → full replace).
 *     `basePoint` and `direction` are preserved from the live stair; everything
 *     else is overwritten by `preset.params`.
 *
 * Errors from service surface via `error` state — caller renders user-facing
 * message from i18n key matching the error code.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.3 #7, §6.6
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createStairPresetsService,
  type SavePresetInput,
} from '../../../bim/stairs/stair-presets-service';
import { UpdateStairParamsCommand } from '../../../core/commands/entity-commands/UpdateStairParamsCommand';
import { useCommandHistory } from '../../../core/commands';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { StairEntity } from '../../../types/entities';
import type { StairParams, StairPresetDoc } from '../../../types/stair';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseStairPresetsProps {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
  readonly levelManager: LevelManagerLike;
}

export interface UseStairPresetsResult {
  readonly presets: readonly StairPresetDoc[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly savePreset: (input: SavePresetInput) => Promise<void>;
  readonly deletePreset: (presetId: string) => Promise<void>;
  readonly loadPreset: (stair: StairEntity, preset: StairPresetDoc) => void;
  readonly refresh: () => Promise<void>;
}

export function useStairPresets(props: UseStairPresetsProps): UseStairPresetsResult {
  const { companyId, userId, projectId, levelManager } = props;
  const { execute: executeCommand } = useCommandHistory();

  const service = useMemo(
    () => createStairPresetsService({ companyId, userId, projectId }),
    [companyId, userId, projectId],
  );

  const [presets, setPresets] = useState<readonly StairPresetDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await service.listPresets();
      setPresets(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STAIR_PRESET_LIST_FAILED');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePreset = useCallback(
    async (input: SavePresetInput) => {
      setError(null);
      try {
        await service.savePreset(input);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'STAIR_PRESET_SAVE_FAILED');
        throw err;
      }
    },
    [service, refresh],
  );

  const deletePreset = useCallback(
    async (presetId: string) => {
      setError(null);
      try {
        await service.deletePreset(presetId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'STAIR_PRESET_DELETE_FAILED');
        throw err;
      }
    },
    [service, refresh],
  );

  const loadPreset = useCallback(
    (stair: StairEntity, preset: StairPresetDoc) => {
      if (!levelManager.currentLevelId) return;
      // Q32 — full replace: preset.params overrides everything except
      // basePoint/direction (those come from the live stair placement).
      const next: StairParams = {
        ...preset.params,
        basePoint: stair.params.basePoint,
        direction: stair.params.direction,
      };
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateStairParamsCommand(stair.id, next, stair.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );

  return {
    presets,
    loading,
    error,
    savePreset,
    deletePreset,
    loadPreset,
    refresh,
  };
}

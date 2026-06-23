'use client';

/**
 * ADR-511 — Bridge μεταξύ contextual Wall Covering ribbon tab και active
 * `WallCoveringEntity` params. Mirror του `useRibbonFloorFinishBridge`.
 *
 * Κάθε mutation περνά από `UpdateWallCoveringParamsCommand` (undoable + geometry recompute).
 * `useWallCoveringPersistence` πιάνει το patched entity μέσω debounced auto-save.
 *
 * Edit model (Slice B): body finish picker + surface paint picker ανασυνθέτουν το compound
 * assembly· faceSide toggle (inner/outer)· height. Full per-layer editor = follow-up.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isWallCoveringEntity } from '../../../types/entities';
import type {
  WallCoveringEntity,
  WallCoveringFaceSide,
  WallCoveringLayer,
  WallCoveringMaterialId,
  WallCoveringParams,
} from '../../../bim/types/wall-covering-types';
import {
  findBodyLayer,
  findSurfaceLayer,
  makeWallCoveringLayer,
} from '../../../bim/wall-coverings/wall-covering-layers';
import { useCommandHistory } from '../../../core/commands';
import { UpdateWallCoveringParamsCommand } from '../../../core/commands/entity-commands/UpdateWallCoveringParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  WALL_COVERING_RIBBON_KEYS,
  isWallCoveringRibbonNumberKey,
  isWallCoveringRibbonStringKey,
  isWallCoveringRibbonActionKey,
} from './bridge/wall-covering-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<ReturnType<typeof useUniversalSelection>, 'getPrimaryId'>;

export interface UseRibbonWallCoveringBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonWallCoveringBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onAction: (action: string) => void;
}

// ─── Assembly reconstruction (body finish + surface coat) — reuse layers SSoT ──

/** Ανασύνθεση assembly με νέο body (κρατά surface coat αν υπάρχει). */
function withBodyMaterial(params: WallCoveringParams, materialId: WallCoveringMaterialId): WallCoveringLayer[] {
  const surface = findSurfaceLayer(params.layers);
  const body = makeWallCoveringLayer(materialId);
  return surface ? [body, surface] : [body];
}

/** Ανασύνθεση assembly με νέο surface coat (κρατά body). */
function withSurfaceMaterial(params: WallCoveringParams, materialId: WallCoveringMaterialId): WallCoveringLayer[] {
  const body = findBodyLayer(params.layers);
  const surface: WallCoveringLayer = { materialId, thicknessMm: 0, function: 'surface' };
  return body ? [body, surface] : [surface];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRibbonWallCoveringBridge(
  props: UseRibbonWallCoveringBridgeProps,
): RibbonWallCoveringBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveWallCovering = useCallback((): WallCoveringEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isWallCoveringEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const dispatchParams = useCallback(
    (wc: WallCoveringEntity, nextParams: WallCoveringParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(new UpdateWallCoveringParamsCommand(wc.id, nextParams, wc.params, sm, false));
      EventBus.emit('bim:wall-covering-params-updated', { wallCoveringId: wc.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const wc = resolveWallCovering();
      if (!wc) return null;
      if (isWallCoveringRibbonStringKey(commandKey)) {
        if (commandKey === WALL_COVERING_RIBBON_KEYS.stringParams.faceSide) {
          return { value: wc.params.faceSide, options: [] };
        }
        if (commandKey === WALL_COVERING_RIBBON_KEYS.stringParams.surfaceMaterialId) {
          return { value: findSurfaceLayer(wc.params.layers)?.materialId ?? '', options: [] };
        }
        return { value: findBodyLayer(wc.params.layers)?.materialId ?? '', options: [] };
      }
      if (isWallCoveringRibbonNumberKey(commandKey)) {
        return { value: String(Math.round(wc.params.heightTopMm)), options: [] };
      }
      return null;
    },
    [resolveWallCovering],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const wc = resolveWallCovering();
      if (!wc) return;

      if (isWallCoveringRibbonStringKey(commandKey)) {
        if (commandKey === WALL_COVERING_RIBBON_KEYS.stringParams.faceSide) {
          if (value !== 'inner' && value !== 'outer') return;
          dispatchParams(wc, { ...wc.params, faceSide: value as WallCoveringFaceSide });
          return;
        }
        if (commandKey === WALL_COVERING_RIBBON_KEYS.stringParams.surfaceMaterialId) {
          dispatchParams(wc, { ...wc.params, layers: withSurfaceMaterial(wc.params, value as WallCoveringMaterialId) });
          return;
        }
        dispatchParams(wc, { ...wc.params, layers: withBodyMaterial(wc.params, value as WallCoveringMaterialId) });
        return;
      }

      if (isWallCoveringRibbonNumberKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric) || numeric <= wc.params.heightBottomMm) return;
        dispatchParams(wc, { ...wc.params, heightTopMm: numeric });
      }
    },
    [resolveWallCovering, dispatchParams],
  );

  const onAction = useCallback(
    (action: string): void => {
      if (!isWallCoveringRibbonActionKey(action)) return;
      if (action === WALL_COVERING_RIBBON_KEYS.actions.delete) {
        const wc = resolveWallCovering();
        if (!wc) return;
        const confirmed = window.confirm(t('ribbon.commands.wallCoveringEditor.deleteConfirm'));
        if (!confirmed) return;
        EventBus.emit('bim:wall-covering-delete-requested', { id: wc.id });
        return;
      }
      // ADR-363 — «Κλείσιμο» handled centrally in `routeRibbonAction`
      // (uniform deselect for every contextual tab). No per-bridge branch.
    },
    [resolveWallCovering, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onAction }),
    [onComboboxChange, getComboboxState, onAction],
  );
}

/** Type guard — exposed so `useRibbonCommands` can route wall-covering action keys. */
export function isWallCoveringActionKey(action: string): boolean {
  return isWallCoveringRibbonActionKey(action);
}

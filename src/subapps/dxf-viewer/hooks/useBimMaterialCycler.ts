'use client';

/**
 * ADR-363 Phase 4.5e+ — Tab/Shift+Tab material cycling for selected BIM entities.
 *
 * Revit-style enum cycle: while a wall / slab / beam / column entity is selected
 * and the select tool is active, Tab advances to the next material option in the
 * picker list; Shift+Tab reverses. Mirrors Revit "Tab to cycle type" UX.
 *
 * Guard sequence (any failing guard = no-op):
 *   1. Key is 'Tab' with no Ctrl/Meta/Alt modifier
 *   2. Active tool is 'select' (drawing-tool Tab handlers take priority)
 *   3. No input/textarea/contenteditable is focused
 *   4. Primary selected entity is a BIM type with a material picker
 *
 * Material options mirror the combobox options in each contextual ribbon tab
 * (SSoT: the order here = the Tab cycle order the user sees in the picker).
 *
 * Each cycle dispatches the appropriate UpdateXParamsCommand so the change is
 * undoable (Ctrl+Z restores the previous material). `isDragging=false` ensures
 * every Tab press is a discrete undo step.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5 Phase 4.5e+
 */

import { useEffect } from 'react';
import { useCommandHistory } from '../core/commands';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { toolStateStore } from '../stores/ToolStateStore';
import {
  isWallEntity,
  isSlabEntity,
  isBeamEntity,
  isColumnEntity,
} from '../types/entities';
import { UpdateWallParamsCommand } from '../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateSlabParamsCommand } from '../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateBeamParamsCommand } from '../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateColumnParamsCommand } from '../core/commands/entity-commands/UpdateColumnParamsCommand';
import type { useLevels } from '../systems/levels';
import type { useUniversalSelection } from '../systems/selection';

// ─── Material option lists (mirrors contextual ribbon tab order) ──────────────

/** Tab cycle order per entity type. Must match the combobox options in each contextual tab. */
const WALL_MATERIALS   = ['rc', 'masonry', 'aerated-concrete', 'gypsum'] as const;
const SLAB_MATERIALS   = ['rc', 'composite', 'wood'] as const;
const BEAM_MATERIALS   = ['rc', 'steel', 'glulam'] as const;
const COLUMN_MATERIALS = ['rc', 'steel', 'masonry', 'wood'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseBimMaterialCyclerProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

// ─── Pure helper ─────────────────────────────────────────────────────────────

/**
 * Return the next material in `options` from `current`, wrapping at boundaries.
 * When `current` is undefined or not in the list, treats the first option as the
 * implicit current (matches the ribbon combobox fallback of `options[0] = 'rc'`).
 */
function cycleMaterialValue(
  current: string | undefined,
  options: readonly string[],
  dir: 1 | -1,
): string {
  const effective = current ?? options[0];
  const idx = options.indexOf(effective);
  const base = idx < 0 ? 0 : idx;
  return options[(base + dir + options.length) % options.length];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBimMaterialCycler({
  levelManager,
  universalSelection,
}: UseBimMaterialCyclerProps): void {
  const { execute: executeCommand } = useCommandHistory();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Only cycle when in select mode — drawing-tool Tab handlers (e.g. column
      // anchor cycling) take precedence when their own tool is active.
      if (toolStateStore.get().activeTool !== 'select') return;

      // Do not intercept Tab while the user is typing in a form field.
      const focused = document.activeElement;
      if (
        focused &&
        (focused.tagName === 'INPUT' ||
          focused.tagName === 'TEXTAREA' ||
          focused.getAttribute('contenteditable') === 'true')
      ) return;

      const id = universalSelection.getPrimaryId();
      if (!id || !levelManager.currentLevelId) return;

      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;

      const entity = scene.entities.find((x) => x.id === id);
      if (!entity) return;

      const dir: 1 | -1 = e.shiftKey ? -1 : 1;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );

      if (isWallEntity(entity)) {
        const nextMaterial = cycleMaterialValue(entity.params.material, WALL_MATERIALS, dir);
        executeCommand(
          new UpdateWallParamsCommand(
            entity.id,
            { ...entity.params, material: nextMaterial },
            entity.params,
            sm,
            false,
            entity.kind,
          ),
        );
        e.preventDefault();
        return;
      }

      if (isSlabEntity(entity)) {
        const nextMaterial = cycleMaterialValue(entity.params.material, SLAB_MATERIALS, dir);
        executeCommand(
          new UpdateSlabParamsCommand(
            entity.id,
            { ...entity.params, material: nextMaterial },
            entity.params,
            sm,
            false,
          ),
        );
        e.preventDefault();
        return;
      }

      if (isBeamEntity(entity)) {
        const nextMaterial = cycleMaterialValue(entity.params.material, BEAM_MATERIALS, dir);
        executeCommand(
          new UpdateBeamParamsCommand(
            entity.id,
            { ...entity.params, material: nextMaterial },
            entity.params,
            sm,
            false,
          ),
        );
        e.preventDefault();
        return;
      }

      if (isColumnEntity(entity)) {
        const nextMaterial = cycleMaterialValue(entity.params.material, COLUMN_MATERIALS, dir);
        executeCommand(
          new UpdateColumnParamsCommand(
            entity.id,
            { ...entity.params, material: nextMaterial },
            entity.params,
            sm,
            false,
          ),
        );
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [executeCommand, levelManager, universalSelection]);
}

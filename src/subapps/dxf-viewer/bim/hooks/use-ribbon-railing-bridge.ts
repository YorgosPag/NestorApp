'use client';

/**
 * ADR-407 Φ9 — Bridge between the contextual Railing ribbon tab and the
 * active `RailingEntity` params.
 *
 * Mirror of `use-ribbon-stair-bridge.ts` (ADR-358 Phase 7a), but simpler:
 * `RailingParams` already stores plain millimetres (no scene-units scale —
 * unlike `StairParams.rise/tread/width`), so there is no `getSceneUnitsScale`
 * multiply/divide step here. Read/write both go straight through the ONE
 * shared SSoT (`bim/railings/railing-param-{keys,access}.ts`), which is also
 * consumed by the left Properties palette — read and write can never drift.
 *
 * Every write dispatches `UpdateRailingParamsCommand` with `isDragging=false`
 * (commit-on-select, each combobox change is a discrete undo step).
 *
 * No badge, no panel visibility, no custom actions — every railing field is
 * always relevant and «Κλείσιμο» is handled centrally (ADR-363
 * `routeRibbonAction`). `useInertBridgeExtras()` supplies the inert
 * toggle/action/visibility tail shared by every bridge in that shape.
 *
 * @see ./bridge? — n/a: no per-bridge command-key file needed, the SSoT
 *      already lives in `bim/railings/railing-param-keys.ts` (ADR-407 Φ9).
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import { useCallback } from 'react';
import { useCommandHistory } from '../../core/commands';
import { UpdateRailingParamsCommand } from '../../core/commands/entity-commands/UpdateRailingParamsCommand';
import { isRailingEntity } from '../../types/entities';
import {
  isRailingRibbonKey,
  isRailingRibbonStringKey,
} from '../railings/railing-param-keys';
import { readRailingField, patchRailingField } from '../railings/railing-param-access';
import type { RibbonComboboxState } from '../../ui/ribbon/context/RibbonCommandContext';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../systems/selection';
import {
  useResolveSelectedEntity,
  useActiveSceneManager,
  useInertBridgeExtras,
  useStableBridge,
  type RibbonEntityBridgeCore,
} from '../../ui/ribbon/hooks/ribbon-entity-bridge-shared';

type LevelManagerLike = Pick<LevelSceneWriter, 'currentLevelId' | 'getLevelScene' | 'setLevelScene'>;

type UniversalSelectionLike = Pick<ReturnType<typeof useUniversalSelection>, 'getPrimaryId'>;

export interface UseRibbonRailingBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export type RibbonRailingBridge = RibbonEntityBridgeCore;

export function useRibbonRailingBridge(
  props: UseRibbonRailingBridgeProps,
): RibbonRailingBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  const resolveRailing = useResolveSelectedEntity(levelManager, universalSelection, isRailingEntity);
  const buildSceneManager = useActiveSceneManager(levelManager);

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isRailingRibbonKey(commandKey) && !isRailingRibbonStringKey(commandKey)) return null;
      const railing = resolveRailing();
      if (!railing) return null;
      const value = readRailingField(commandKey, railing.params);
      return value === null ? null : { value, options: [] };
    },
    [resolveRailing],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isRailingRibbonKey(commandKey) && !isRailingRibbonStringKey(commandKey)) return;
      const railing = resolveRailing();
      if (!railing) return;
      const sm = buildSceneManager();
      if (!sm) return;
      const next = patchRailingField(commandKey, railing.params, value);
      executeCommand(
        new UpdateRailingParamsCommand(railing.id, next, railing.params, sm, false),
      );
    },
    [resolveRailing, buildSceneManager, executeCommand],
  );

  // ADR-407 Φ9 — no toggles/actions/badge/visibility: every field is a
  // combobox and «Κλείσιμο» routes centrally (ADR-363). Shared inert tail.
  const { onToggle, getToggleState, onAction, getPanelVisibility } = useInertBridgeExtras();

  // ADR-040 Phase XIX — memoize return so RibbonCommandProvider deps stay stable.
  return useStableBridge({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility });
}

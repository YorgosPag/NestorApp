'use client';

/**
 * ADR-683 Φ3.1β/γ (B2) — Bridge between the contextual «Εισαγόμενο Πλέγμα» ribbon tab and the
 * active `ImportedMeshEntity` params.
 *
 * Mirror of `use-ribbon-railing-bridge.ts` (ADR-407 Φ9): read/write both go straight through the
 * ONE shared SSoT (`bim/entities/imported-mesh/imported-mesh-param-{keys,access}.ts`, ADR-683 Φ3.1γ
 * A1), which is also the read path a future Properties-palette row would use — read and write can
 * never drift.
 *
 * ## Asymmetry vs the railing bridge (by design, see the SSoT's own header)
 *
 * Railing's "string keys" are writable enums; here `IMPORTED_MESH_READONLY_KEYS` are ALL read-only
 * (no editable string/enum field exists on `ImportedMeshParams`). `getComboboxState` therefore
 * resolves BOTH key families (mirrors railing's dual gate) so a future read-only readout row is
 * already wired, but `onComboboxChange` only ever produces a command for the four numeric keys —
 * `patchImportedMeshField` is a documented no-op (same object reference) for a read-only key, and
 * this bridge skips the dispatch entirely on a no-op patch so «Κλείσιμο» / a stray read-only write
 * attempt never pushes an empty undo step.
 *
 * Every real write dispatches `UpdateImportedMeshParamsCommand` with `isDragging=false`
 * (commit-on-select, each combobox change is a discrete undo step) — the SAME command
 * `imported-mesh-grips.ts` uses for MOVE/ROTATE, so the ribbon and the grips can never desync.
 *
 * No badge, no panel visibility, no custom actions — `useInertBridgeExtras()` supplies the inert
 * toggle/action/visibility tail shared by every bridge in this shape.
 *
 * @see ../entities/imported-mesh/imported-mesh-param-keys.ts — the `commandKey` SSoT + guards
 * @see ../entities/imported-mesh/imported-mesh-param-access.ts — `readImportedMeshField` / `patchImportedMeshField`
 * @see ../../core/commands/entity-commands/UpdateImportedMeshParamsCommand.ts — the ONE command
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §3, §10.1
 */

import { useCallback } from 'react';
import { useCommandHistory } from '../../core/commands';
import { UpdateImportedMeshParamsCommand } from '../../core/commands/entity-commands/UpdateImportedMeshParamsCommand';
import { isImportedMeshEntity } from '../../types/entities';
import {
  isImportedMeshRibbonKey,
  isImportedMeshRibbonStringKey,
} from '../entities/imported-mesh/imported-mesh-param-keys';
import { readImportedMeshField, patchImportedMeshField } from '../entities/imported-mesh/imported-mesh-param-access';
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

export interface UseRibbonImportedMeshBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export type RibbonImportedMeshBridge = RibbonEntityBridgeCore;

export function useRibbonImportedMeshBridge(
  props: UseRibbonImportedMeshBridgeProps,
): RibbonImportedMeshBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  const resolveImportedMesh = useResolveSelectedEntity(levelManager, universalSelection, isImportedMeshEntity);
  const buildSceneManager = useActiveSceneManager(levelManager);

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isImportedMeshRibbonKey(commandKey) && !isImportedMeshRibbonStringKey(commandKey)) return null;
      const mesh = resolveImportedMesh();
      if (!mesh) return null;
      const value = readImportedMeshField(commandKey, mesh.params);
      return value === null ? null : { value, options: [] };
    },
    [resolveImportedMesh],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isImportedMeshRibbonKey(commandKey)) return;
      const mesh = resolveImportedMesh();
      if (!mesh) return;
      const next = patchImportedMeshField(commandKey, mesh.params, value);
      // Read-only keys / non-finite input resolve to the SAME reference (documented no-op in
      // `patchImportedMeshField`) — skip the dispatch so no empty undo step is pushed.
      if (next === mesh.params) return;
      const sm = buildSceneManager();
      if (!sm) return;
      executeCommand(
        new UpdateImportedMeshParamsCommand(mesh.id, next, mesh.params, sm, false),
      );
    },
    [resolveImportedMesh, buildSceneManager, executeCommand],
  );

  // ADR-683 Φ3.1β — no toggles/actions/badge/visibility: every field is a combobox and
  // «Κλείσιμο» routes centrally (ADR-363). Shared inert tail.
  const { onToggle, getToggleState, onAction, getPanelVisibility } = useInertBridgeExtras();

  // ADR-040 Phase XIX — memoize return so RibbonCommandProvider deps stay stable.
  return useStableBridge({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility });
}

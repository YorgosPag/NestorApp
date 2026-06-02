'use client';

/**
 * ADR-408 Φ5 — Bridge between the MEP circuit contextual ribbon tab and the
 * current selection.
 *
 * The action-only tab surfaces «Δημιουργία κυκλώματος»: it resolves the source
 * panel + member fixtures from the selection (`resolveCircuitFromSelection`,
 * pure SSoT), mints an enterprise id, picks a deterministic palette colour, and
 * dispatches a `CreateMepSystemCommand`. When a fixture is already wired to
 * another circuit it is *moved* (Revit single-circuit rule) — the reassign
 * removals are bundled with the create into one `CompoundCommand` for a single
 * undo. Feedback is decoupled via EventBus → `useDxfViewerNotifications`.
 *
 * No-ops for action keys it does not own, so it composes with the other bridges
 * in `useRibbonCommands`.
 *
 * @see ../../../bim/mep-systems/mep-circuit-from-selection.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useMemo } from 'react';

import type { Entity } from '../../../types/entities';
import { isMepFixtureEntity } from '../../../types/entities';
import { useCommandHistory, CompoundCommand, type ICommand } from '../../../core/commands';
import { CreateMepSystemCommand } from '../../../core/commands/entity-commands/CreateMepSystemCommand';
import { UpdateMepSystemParamsCommand } from '../../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../bim/mep-systems/mep-circuit-editor-store';
import {
  resolveCircuitFromSelection,
  type CircuitDraft,
} from '../../../bim/mep-systems/mep-circuit-from-selection';
import {
  buildAddMembersUpdate,
  buildRemoveMembersUpdate,
  type MepSystemParamsUpdate,
} from '../../../bim/mep-systems/mep-circuit-editor';
import { pickNextSystemColor } from '../../../bim/mep-systems/mep-system-color';
import {
  buildDefaultCircuitParams,
  type MepSystemEntity,
} from '../../../bim/types/mep-system-types';
import { generateMepSystemId } from '@/services/enterprise-id-convenience';
import { MEP_CIRCUIT_RIBBON_ACTIONS } from './bridge/mep-circuit-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';
import { useTranslation } from 'react-i18next';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getSelectedEntityIds' | 'clearAll'
>;

export interface UseRibbonMepCircuitBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonMepCircuitBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonMepCircuitBridge(
  props: UseRibbonMepCircuitBridgeProps,
): RibbonMepCircuitBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveSelectedEntities = useCallback((): Entity[] => {
    if (!levelManager.currentLevelId) return [];
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return [];
    const ids = new Set(universalSelection.getSelectedEntityIds());
    return scene.entities.filter((e) => ids.has(e.id));
  }, [levelManager, universalSelection]);

  const handleCreate = useCallback((): void => {
    const systems = useMepSystemStore.getState().getSystems();
    const resolution = resolveCircuitFromSelection(resolveSelectedEntities(), systems);
    if (!resolution.ok) {
      EventBus.emit('bim:mep-circuit-create-failed', { reason: resolution.reason });
      return;
    }
    const command = buildCreateCommand(resolution.draft, systems, t);
    executeCommand(command);
    EventBus.emit('bim:mep-circuit-created', {
      memberCount: resolution.draft.members.length,
    });
  }, [resolveSelectedEntities, executeCommand, t]);

  // ADR-408 Φ6 — the circuit the properties panel is editing (selection-synced).
  const resolveActiveSystem = useCallback((): MepSystemEntity | null => {
    const id = useMepCircuitEditorStore.getState().activeSystemId;
    if (!id) return null;
    return useMepSystemStore.getState().getSystems().find((s) => s.id === id) ?? null;
  }, []);

  const handleAddMembers = useCallback((): void => {
    const active = resolveActiveSystem();
    if (!active) {
      EventBus.emit('bim:mep-circuit-edit-failed', { reason: 'noActiveCircuit' });
      return;
    }
    const systems = useMepSystemStore.getState().getSystems();
    const fixtures = resolveSelectedEntities().filter(isMepFixtureEntity);
    const plan = buildAddMembersUpdate(active, fixtures, systems);
    if (!plan) {
      EventBus.emit('bim:mep-circuit-edit-failed', { reason: 'addFailed' });
      return;
    }
    const updates: MepSystemParamsUpdate[] = [plan.update, ...plan.reassignRemovals];
    executeCommand(buildUpdateCommand('Add MEP circuit members', updates));
    EventBus.emit('bim:mep-circuit-members-added', { memberCount: plan.addedCount });
  }, [resolveActiveSystem, resolveSelectedEntities, executeCommand]);

  const handleRemoveMembers = useCallback((): void => {
    const active = resolveActiveSystem();
    if (!active) {
      EventBus.emit('bim:mep-circuit-edit-failed', { reason: 'noActiveCircuit' });
      return;
    }
    const ids = new Set(universalSelection.getSelectedEntityIds());
    const plan = buildRemoveMembersUpdate(active, ids);
    if (!plan) {
      EventBus.emit('bim:mep-circuit-edit-failed', { reason: 'removeFailed' });
      return;
    }
    executeCommand(buildUpdateCommand('Remove MEP circuit members', [plan.update]));
    EventBus.emit('bim:mep-circuit-members-removed', { memberCount: plan.removedCount });
  }, [resolveActiveSystem, universalSelection, executeCommand]);

  const onAction = useCallback(
    (action: string): void => {
      if (action === MEP_CIRCUIT_RIBBON_ACTIONS.create) return handleCreate();
      if (action === MEP_CIRCUIT_RIBBON_ACTIONS.addMembers) return handleAddMembers();
      if (action === MEP_CIRCUIT_RIBBON_ACTIONS.removeMembers) return handleRemoveMembers();
      if (action === MEP_CIRCUIT_RIBBON_ACTIONS.close) {
        universalSelection.clearAll();
      }
    },
    [handleCreate, handleAddMembers, handleRemoveMembers, universalSelection],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

/** Turn one or more param updates into a single (compound) undoable command. */
function buildUpdateCommand(name: string, updates: readonly MepSystemParamsUpdate[]): ICommand {
  const commands = updates.map(
    (u) => new UpdateMepSystemParamsCommand(u.systemId, u.nextParams, u.prevParams),
  );
  return commands.length === 1 ? commands[0]! : new CompoundCommand(name, commands);
}

/** Build the (compound) create command, bundling Revit single-circuit reassigns. */
function buildCreateCommand(
  draft: CircuitDraft,
  existing: readonly MepSystemEntity[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): ICommand {
  const name = t('ribbon.commands.mepCircuit.defaultName', { n: existing.length + 1 });
  const color = pickNextSystemColor(existing);
  const entity: MepSystemEntity = {
    id: generateMepSystemId(),
    params: buildDefaultCircuitParams(
      name,
      draft.sourceEntityId,
      draft.sourceConnectorId,
      draft.members,
      color,
    ),
  };
  const create = new CreateMepSystemCommand(entity);
  if (draft.reassignRemovals.length === 0) return create;
  const reassigns = draft.reassignRemovals.map(
    (r) => new UpdateMepSystemParamsCommand(r.systemId, r.nextParams, r.prevParams),
  );
  return new CompoundCommand('Create MEP circuit', [create, ...reassigns]);
}

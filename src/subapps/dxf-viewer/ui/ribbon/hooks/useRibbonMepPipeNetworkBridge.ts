'use client';

/**
 * ADR-408 Φ13 — Bridge between the MEP pipe-network contextual ribbon tab and the
 * current selection (the plumbing analogue of `useRibbonMepCircuitBridge`).
 *
 * The action tab surfaces «Δημιουργία δικτύου ύδρευσης»: it resolves the source
 * manifold (συλλέκτης) + member pipe segments from the selection
 * (`resolvePipeNetworkFromSelection`, pure SSoT), mints an enterprise id, seeds the
 * classification colour (Revit/CIBSE plumbing convention), and dispatches a
 * `CreateMepSystemCommand`. When a pipe is already in another network it is *moved*
 * (Revit single-system rule) — the reassign removals are bundled into one
 * `CompoundCommand`. The Φ6-style management actions (add / remove member) edit the
 * **active network** (`useMepCircuitEditorStore`, shared with the electrical editor)
 * through the undoable `UpdateMepSystemParamsCommand`.
 *
 * The System backbone, the active-system store, the connector reconciliation and
 * the picker / name / colour widgets are all domain-agnostic and reused as-is — no
 * fork. Only the create + add resolution is pipe-specific (a segment contributes two
 * endpoint members). Feedback is decoupled via EventBus → `useDxfViewerNotifications`.
 *
 * @see ../../../bim/mep-systems/mep-pipe-network-from-selection.ts
 * @see ./useRibbonMepCircuitBridge.ts — the electrical counterpart
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ13
 */

import { useCallback, useMemo } from 'react';

import type { Entity } from '../../../types/entities';
import { isMepSegmentEntity } from '../../../types/entities';
import { useCommandHistory, CompoundCommand, type ICommand } from '../../../core/commands';
import { CreateMepSystemCommand } from '../../../core/commands/entity-commands/CreateMepSystemCommand';
import { UpdateMepSystemParamsCommand } from '../../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../bim/mep-systems/mep-circuit-editor-store';
import {
  resolvePipeNetworkFromSelection,
  buildAddPipeMembersUpdate,
  type PipeNetworkFromSelectionDraft,
} from '../../../bim/mep-systems/mep-pipe-network-from-selection';
import {
  buildRemoveMembersUpdate,
  type MepSystemParamsUpdate,
} from '../../../bim/mep-systems/mep-circuit-editor';
import { classificationDefaultColor } from '../../../bim/mep-systems/mep-system-color';
import {
  buildDefaultPipeNetworkParams,
  type MepSystemEntity,
} from '../../../bim/types/mep-system-types';
import { generateMepSystemId } from '@/services/enterprise-id-convenience';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from './bridge/mep-pipe-network-command-keys';
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

export interface UseRibbonMepPipeNetworkBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonMepPipeNetworkBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonMepPipeNetworkBridge(
  props: UseRibbonMepPipeNetworkBridgeProps,
): RibbonMepPipeNetworkBridge {
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
    const resolution = resolvePipeNetworkFromSelection(resolveSelectedEntities(), systems);
    if (!resolution.ok) {
      EventBus.emit('bim:mep-network-create-failed', { reason: resolution.reason });
      return;
    }
    executeCommand(buildCreateCommand(resolution.draft, systems, t));
    // Report the pipe (host) count, not the endpoint-connector count (2 per pipe).
    EventBus.emit('bim:mep-network-created', {
      memberCount: new Set(resolution.draft.members.map((m) => m.entityId)).size,
    });
  }, [resolveSelectedEntities, executeCommand, t]);

  // ADR-408 Φ13 — the network the properties panel is editing (selection-synced via
  // the shared `useMepCircuitEditorSync`, which now resolves any system type).
  const resolveActiveSystem = useCallback((): MepSystemEntity | null => {
    const id = useMepCircuitEditorStore.getState().activeSystemId;
    if (!id) return null;
    return useMepSystemStore.getState().getSystems().find((s) => s.id === id) ?? null;
  }, []);

  const handleAddMembers = useCallback((): void => {
    const active = resolveActiveSystem();
    if (!active) {
      EventBus.emit('bim:mep-network-edit-failed', { reason: 'noActiveNetwork' });
      return;
    }
    const systems = useMepSystemStore.getState().getSystems();
    const segments = resolveSelectedEntities().filter(isMepSegmentEntity);
    const plan = buildAddPipeMembersUpdate(active, segments, systems);
    if (!plan) {
      EventBus.emit('bim:mep-network-edit-failed', { reason: 'addFailed' });
      return;
    }
    const updates: MepSystemParamsUpdate[] = [plan.update, ...plan.reassignRemovals];
    executeCommand(buildUpdateCommand('Add MEP network members', updates));
    EventBus.emit('bim:mep-network-members-added', { memberCount: plan.addedCount });
  }, [resolveActiveSystem, resolveSelectedEntities, executeCommand]);

  const handleRemoveMembers = useCallback((): void => {
    const active = resolveActiveSystem();
    if (!active) {
      EventBus.emit('bim:mep-network-edit-failed', { reason: 'noActiveNetwork' });
      return;
    }
    const ids = new Set(universalSelection.getSelectedEntityIds());
    const plan = buildRemoveMembersUpdate(active, ids);
    if (!plan) {
      EventBus.emit('bim:mep-network-edit-failed', { reason: 'removeFailed' });
      return;
    }
    executeCommand(buildUpdateCommand('Remove MEP network members', [plan.update]));
    // Report distinct removed pipes (hosts), not endpoint connectors (2 per pipe).
    const after = new Set(plan.update.nextParams.members.map((m) => m.entityId));
    const removedPipes = new Set(
      active.params.members.map((m) => m.entityId).filter((id) => !after.has(id)),
    ).size;
    EventBus.emit('bim:mep-network-members-removed', { memberCount: removedPipes });
  }, [resolveActiveSystem, universalSelection, executeCommand]);

  const onAction = useCallback(
    (action: string): void => {
      if (action === MEP_PIPE_NETWORK_RIBBON_ACTIONS.create) return handleCreate();
      if (action === MEP_PIPE_NETWORK_RIBBON_ACTIONS.addMembers) return handleAddMembers();
      if (action === MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers) return handleRemoveMembers();
      if (action === MEP_PIPE_NETWORK_RIBBON_ACTIONS.close) {
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

/** Build the (compound) create command, bundling Revit single-system reassigns. */
function buildCreateCommand(
  draft: PipeNetworkFromSelectionDraft,
  existing: readonly MepSystemEntity[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): ICommand {
  const name = t('ribbon.commands.mepCircuit.networkDefaultName', { n: existing.length + 1 });
  // ADR-408 Φ-heating — the network inherits its classification (ύδρευση/θέρμανση)
  // from the source manifold (carried on the draft); colour follows it (CIBSE/Revit).
  const entity: MepSystemEntity = {
    id: generateMepSystemId(),
    params: buildDefaultPipeNetworkParams(
      name,
      draft.systemClassification,
      draft.sourceEntityId,
      draft.sourceConnectorId,
      draft.members,
      classificationDefaultColor(draft.systemClassification),
    ),
  };
  const create = new CreateMepSystemCommand(entity);
  if (draft.reassignRemovals.length === 0) return create;
  const reassigns = draft.reassignRemovals.map(
    (r) => new UpdateMepSystemParamsCommand(r.systemId, r.nextParams, r.prevParams),
  );
  return new CompoundCommand('Create MEP pipe network', [create, ...reassigns]);
}

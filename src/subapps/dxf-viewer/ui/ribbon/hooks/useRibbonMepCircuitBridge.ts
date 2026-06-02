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
import { useCommandHistory, CompoundCommand, type ICommand } from '../../../core/commands';
import { CreateMepSystemCommand } from '../../../core/commands/entity-commands/CreateMepSystemCommand';
import { UpdateMepSystemParamsCommand } from '../../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import {
  resolveCircuitFromSelection,
  type CircuitDraft,
} from '../../../bim/mep-systems/mep-circuit-from-selection';
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

  const onAction = useCallback(
    (action: string): void => {
      if (action === MEP_CIRCUIT_RIBBON_ACTIONS.create) {
        handleCreate();
        return;
      }
      if (action === MEP_CIRCUIT_RIBBON_ACTIONS.close) {
        universalSelection.clearAll();
      }
    },
    [handleCreate, universalSelection],
  );

  return useMemo(() => ({ onAction }), [onAction]);
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

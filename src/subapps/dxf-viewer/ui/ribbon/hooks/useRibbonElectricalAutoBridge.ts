'use client';

/**
 * ADR-430 Slice 2 — Bridge between the «Αυτόματος Ηλεκτρολογικός» ribbon actions and the
 * electrical-strong auto-design engine (Slice 1) + the proposal/commit layer.
 *
 * Revit "Generate → review → accept":
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run
 *     `designElectricalStrong` (Slice 1, skipping terminals already on a circuit) → build the
 *     circuit `MepSystem` entities (`buildElectricalCommit`) + pre-route their home-run wires
 *     (`computeCircuitWirePaths`) → push the review into the low-frequency proposal store,
 *     which the canvas ghost leaf renders.
 *   - **accept**: dispatch ONE `CompoundCommand` of `CreateMepSystemCommand`s (a single
 *     atomic undo). NO segments — the wiring is derived at render from each circuit's members.
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon bridges in
 * `useRibbonCommands`. Feedback is decoupled via EventBus → `useDxfViewerNotifications`.
 *
 * @see ../../../systems/mep-design/electrical/design-electrical-strong.ts (engine)
 * @see ../../../systems/mep-design/electrical/commit/build-electrical-commit.ts (commit builder)
 * @see ./useRibbonHeatingAutoBridge.ts (the pipe-discipline counterpart / template)
 * @see docs/centralized-systems/reference/adrs/ADR-430-electrical-strong-auto-design.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCommandHistory, CompoundCommand, type ICommand } from '../../../core/commands';
import { CreateMepSystemCommand } from '../../../core/commands/entity-commands/CreateMepSystemCommand';
import { getCurrentLayerId } from '../../../stores/LayerStore';
import { resolveSceneUnits } from '../../../utils/scene-units';
import { EventBus } from '../../../systems/events/EventBus';
import {
  recognizeSceneFromRegistry,
  registerMepRecognition,
} from '../../../systems/recognition';
import { designElectricalStrong } from '../../../systems/mep-design/electrical';
import { electricalProposalStore } from '../../../systems/mep-design/electrical/electrical-proposal-store';
import { buildElectricalCommit } from '../../../systems/mep-design/electrical/commit/build-electrical-commit';
import type { ProposedCircuit } from '../../../systems/mep-design/electrical';
import { computeCircuitWirePaths } from '../../../bim/mep-systems/mep-wire-routing';
import { resolverFromHosts } from '../../../bim/mep-systems/mep-wire-resolver';
import { collectWireHosts } from '../../../bim/mep-systems/mep-wire-scene';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { ELECTRICAL_AUTO_RIBBON_ACTIONS } from './bridge/electrical-auto-command-keys';
import type { useLevels } from '../../../systems/levels';
import type { Entity } from '../../../types/entities';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseRibbonElectricalAutoBridgeProps {
  readonly levelManager: LevelManagerLike;
}

export interface RibbonElectricalAutoBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonElectricalAutoBridge(
  props: UseRibbonElectricalAutoBridgeProps,
): RibbonElectricalAutoBridge {
  const { levelManager } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');
  const systems = useMepSystemStore((s) => s.systems);

  // Generate — recognize the storey + auto-design → proposal ghost.
  const handleGenerate = useCallback((): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) return;
    const entities = scene.entities as readonly Entity[];
    const sceneUnits = resolveSceneUnits(scene);
    registerMepRecognition();
    const model = recognizeSceneFromRegistry({ entities, storeyId: levelId, sceneUnits });
    const proposal = designElectricalStrong(model, entities, systems, sceneUnits);
    if (proposal.circuits.length === 0) {
      electricalProposalStore.reset();
      EventBus.emit('bim:electrical-empty', {
        reason: proposal.warnings.some((w) => w.includes('panel')) ? 'no-source' : 'no-terminals',
      });
      return;
    }
    // i18n circuit name: «Φωτισμός L1» / «Ρευματοδότες L2».
    const resolveCircuitName = (circuit: ProposedCircuit): string => {
      const base =
        circuit.service === 'lighting'
          ? t('ribbon.commands.electrical.lightingName')
          : t('ribbon.commands.electrical.powerName');
      return `${base} ${circuit.phase}`;
    };
    const plan = buildElectricalCommit(proposal, resolveCircuitName);
    const resolve = resolverFromHosts(collectWireHosts(entities));
    const wirePaths = computeCircuitWirePaths(plan.systemEntities, resolve);
    electricalProposalStore.set({ proposal, systemEntities: plan.systemEntities, wirePaths, sceneUnits });
    EventBus.emit('bim:electrical-generated', {
      circuitCount: proposal.circuits.length,
      skipped: proposal.skippedAlreadyCircuited,
      warningCount: proposal.warnings.length,
    });
  }, [levelManager, systems, t]);

  // Accept — commit the reviewed circuits as one atomic transaction.
  const handleAccept = useCallback((): void => {
    const review = electricalProposalStore.get();
    if (!review || review.systemEntities.length === 0) {
      electricalProposalStore.reset();
      return;
    }
    // The circuits are geometry-less MepSystems; one CreateMepSystemCommand each, bundled
    // into a single CompoundCommand (the layer id is irrelevant — systems carry no layer).
    void getCurrentLayerId();
    const commands: ICommand[] = review.systemEntities.map(
      (entity) => new CreateMepSystemCommand(entity),
    );
    executeCommand(new CompoundCommand('Generate electrical circuits', commands));
    electricalProposalStore.reset();
    EventBus.emit('bim:electrical-committed', { circuitCount: commands.length });
  }, [executeCommand]);

  const handleReject = useCallback((): void => {
    electricalProposalStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === ELECTRICAL_AUTO_RIBBON_ACTIONS.generate) return handleGenerate();
      if (action === ELECTRICAL_AUTO_RIBBON_ACTIONS.accept) return handleAccept();
      if (action === ELECTRICAL_AUTO_RIBBON_ACTIONS.reject) return handleReject();
    },
    [handleGenerate, handleAccept, handleReject],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

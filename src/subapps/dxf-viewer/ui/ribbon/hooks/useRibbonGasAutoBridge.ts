'use client';

/**
 * ADR-434 Slice 2 — Bridge between the «Αυτόματο Αέριο» ribbon actions and the gas
 * (φυσικό αέριο) auto-design engine (Slice 1) + the proposal/commit layer.
 *
 * Revit "Generate → review → accept":
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run `designGas`
 *     (Slice 1) → push the `GasNetworkProposal` into the low-frequency proposal store,
 *     which the canvas ghost leaf renders.
 *   - **accept**: turn the reviewed proposal into real entities via the pure `buildGasCommit`,
 *     then dispatch ONE `CompoundCommand` (`CreateMepSegmentsCommand` + a
 *     `CreateMepSystemCommand` per network) — a single atomic undo. The auto-fitting
 *     reconciler grows elbows/tees afterwards.
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon bridges in
 * `useRibbonCommands`. Feedback is decoupled via EventBus → `useDxfViewerNotifications`.
 *
 * @see ../../../systems/mep-design/gas/design-gas.ts (engine)
 * @see ../../../systems/mep-design/gas/commit/build-gas-commit.ts (commit builder)
 * @see ./useRibbonHvacAutoBridge.ts (action-bridge template)
 * @see docs/centralized-systems/reference/adrs/ADR-434-gas-auto-design.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCommandHistory, CompoundCommand, type ICommand } from '../../../core/commands';
import { CreateMepSystemCommand } from '../../../core/commands/entity-commands/CreateMepSystemCommand';
import { CreateMepSegmentsCommand } from '../../../core/commands/entity-commands/CreateMepSegmentsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { getCurrentLayerId } from '../../../stores/LayerStore';
import { resolveSceneUnits } from '../../../utils/scene-units';
import { EventBus } from '../../../systems/events/EventBus';
import {
  recognizeSceneFromRegistry,
  registerMepRecognition,
} from '../../../systems/recognition';
import { designGas } from '../../../systems/mep-design/gas';
import { gasProposalStore } from '../../../systems/mep-design/gas/gas-proposal-store';
import { buildGasCommit } from '../../../systems/mep-design/gas/commit/build-gas-commit';
import { GAS_AUTO_RIBBON_ACTIONS } from './bridge/gas-auto-command-keys';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseRibbonGasAutoBridgeProps {
  readonly levelManager: LevelManagerLike;
}

export interface RibbonGasAutoBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonGasAutoBridge(
  props: UseRibbonGasAutoBridgeProps,
): RibbonGasAutoBridge {
  const { levelManager } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  // Generate — recognize the storey + auto-design → proposal ghost.
  const handleGenerate = useCallback((): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) return;
    const entities = scene.entities;
    const sceneUnits = resolveSceneUnits(scene);
    registerMepRecognition();
    const model = recognizeSceneFromRegistry({ entities, storeyId: levelId, sceneUnits });
    const proposal = designGas(model, entities);
    if (proposal.networks.length === 0) {
      gasProposalStore.reset();
      EventBus.emit('bim:gas-empty', {
        reason: proposal.warnings.length > 0 ? 'no-source' : 'no-terminals',
      });
      return;
    }
    gasProposalStore.set({ proposal, sceneUnits });
    EventBus.emit('bim:gas-generated', {
      networkCount: proposal.networks.length,
      warningCount: proposal.warnings.length,
    });
  }, [levelManager]);

  // Accept — commit the reviewed proposal as one atomic transaction.
  const handleAccept = useCallback((): void => {
    const review = gasProposalStore.get();
    const levelId = levelManager.currentLevelId;
    if (!review || !levelId) return;
    const layerId = getCurrentLayerId() ?? '';
    const plan = buildGasCommit(review.proposal, layerId, review.sceneUnits, (network, i) =>
      t('ribbon.commands.gas.networkName', {
        service: t(`ribbon.commands.gas.service.${network.service}`),
        n: i + 1,
      }),
    );
    if (plan.segmentEntities.length === 0) {
      gasProposalStore.reset();
      return;
    }
    const adapter = new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelId,
    );
    const commands: ICommand[] = [
      new CreateMepSegmentsCommand(plan.segmentEntities, adapter),
      ...plan.systemEntities.map((entity) => new CreateMepSystemCommand(entity)),
    ];
    executeCommand(new CompoundCommand('Generate gas supply', commands));
    gasProposalStore.reset();
    EventBus.emit('bim:gas-committed', {
      networkCount: plan.systemEntities.length,
      segmentCount: plan.segmentEntities.length,
    });
  }, [levelManager, executeCommand, t]);

  const handleReject = useCallback((): void => {
    gasProposalStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === GAS_AUTO_RIBBON_ACTIONS.generate) return handleGenerate();
      if (action === GAS_AUTO_RIBBON_ACTIONS.accept) return handleAccept();
      if (action === GAS_AUTO_RIBBON_ACTIONS.reject) return handleReject();
    },
    [handleGenerate, handleAccept, handleReject],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

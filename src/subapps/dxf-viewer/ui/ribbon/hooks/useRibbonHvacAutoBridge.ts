'use client';

/**
 * ADR-432 Slice 2 — Bridge between the «Αυτόματος Αερισμός» ribbon actions and the
 * HVAC (ventilation) auto-design engine (Slice 1) + the proposal/commit layer.
 *
 * Revit "Generate → review → accept":
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run
 *     `designHvac` (Slice 1) → push the `DuctNetworkProposal` into the
 *     low-frequency proposal store, which the canvas ghost leaf renders.
 *   - **accept**: turn the reviewed proposal into real entities via the pure
 *     `buildHvacCommit`, then dispatch ONE `CompoundCommand`
 *     (`CreateMepSegmentsCommand` + a `CreateMepSystemCommand` per network) — a
 *     single atomic undo. The auto-fitting reconciler grows elbows/tees afterwards.
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon
 * bridges in `useRibbonCommands`. Feedback is decoupled via EventBus →
 * `useDxfViewerNotifications`.
 *
 * @see ../../../systems/mep-design/hvac/design-hvac.ts (engine)
 * @see ../../../systems/mep-design/hvac/commit/build-hvac-commit.ts (commit builder)
 * @see ./useRibbonWaterAutoSupplyBridge.ts (action-bridge template)
 * @see docs/centralized-systems/reference/adrs/ADR-432-hvac-auto-design.md
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
import { designHvac } from '../../../systems/mep-design/hvac';
import { hvacProposalStore } from '../../../systems/mep-design/hvac/hvac-proposal-store';
import { buildHvacCommit } from '../../../systems/mep-design/hvac/commit/build-hvac-commit';
import { HVAC_AUTO_RIBBON_ACTIONS } from './bridge/hvac-auto-command-keys';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseRibbonHvacAutoBridgeProps {
  readonly levelManager: LevelManagerLike;
}

export interface RibbonHvacAutoBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonHvacAutoBridge(
  props: UseRibbonHvacAutoBridgeProps,
): RibbonHvacAutoBridge {
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
    const proposal = designHvac(model, entities);
    if (proposal.networks.length === 0) {
      hvacProposalStore.reset();
      EventBus.emit('bim:hvac-empty', {
        reason: proposal.warnings.length > 0 ? 'no-source' : 'no-terminals',
      });
      return;
    }
    hvacProposalStore.set({ proposal, sceneUnits });
    EventBus.emit('bim:hvac-generated', {
      networkCount: proposal.networks.length,
      warningCount: proposal.warnings.length,
    });
  }, [levelManager]);

  // Accept — commit the reviewed proposal as one atomic transaction.
  const handleAccept = useCallback((): void => {
    const review = hvacProposalStore.get();
    const levelId = levelManager.currentLevelId;
    if (!review || !levelId) return;
    const layerId = getCurrentLayerId() ?? '';
    const plan = buildHvacCommit(review.proposal, layerId, review.sceneUnits, (network, i) =>
      t('ribbon.commands.hvac.networkName', {
        service: t(`ribbon.commands.hvac.service.${network.service}`),
        n: i + 1,
      }),
    );
    if (plan.segmentEntities.length === 0) {
      hvacProposalStore.reset();
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
    executeCommand(new CompoundCommand('Generate ventilation', commands));
    hvacProposalStore.reset();
    EventBus.emit('bim:hvac-committed', {
      networkCount: plan.systemEntities.length,
      segmentCount: plan.segmentEntities.length,
    });
  }, [levelManager, executeCommand, t]);

  const handleReject = useCallback((): void => {
    hvacProposalStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === HVAC_AUTO_RIBBON_ACTIONS.generate) return handleGenerate();
      if (action === HVAC_AUTO_RIBBON_ACTIONS.accept) return handleAccept();
      if (action === HVAC_AUTO_RIBBON_ACTIONS.reject) return handleReject();
    },
    [handleGenerate, handleAccept, handleReject],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

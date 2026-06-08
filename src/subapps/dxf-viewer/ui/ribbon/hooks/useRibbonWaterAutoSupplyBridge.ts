'use client';

/**
 * ADR-426 Slice 2 — Bridge between the «Αυτόματη Ύδρευση» ribbon actions and the
 * water-supply auto-design engine (Slice 1) + the proposal/commit layer.
 *
 * Revit "Generate → review → accept":
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run
 *     `designWaterSupply` (Slice 1) → push the `WaterNetworkProposal` into the
 *     low-frequency proposal store, which the canvas ghost leaf renders.
 *   - **accept**: turn the reviewed proposal into real entities via the pure
 *     `buildWaterSupplyCommit`, then dispatch ONE `CompoundCommand`
 *     (`CreateMepSegmentsCommand` + a `CreateMepSystemCommand` per network) — a
 *     single atomic undo. The auto-fitting reconciler grows elbows/tees afterwards.
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon
 * bridges in `useRibbonCommands`. Feedback is decoupled via EventBus →
 * `useDxfViewerNotifications`.
 *
 * @see ../../../systems/mep-design/water/design-water-supply.ts (engine)
 * @see ../../../systems/mep-design/water/commit/build-water-supply-commit.ts (commit builder)
 * @see ./useRibbonMepCircuitBridge.ts (action-bridge template)
 * @see docs/centralized-systems/reference/adrs/ADR-426-water-supply-auto-design.md
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
import { designWaterSupply } from '../../../systems/mep-design/water';
import { waterProposalStore } from '../../../systems/mep-design/water/water-proposal-store';
import { buildWaterSupplyCommit } from '../../../systems/mep-design/water/commit/build-water-supply-commit';
import { WATER_SUPPLY_RIBBON_ACTIONS } from './bridge/water-auto-supply-command-keys';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseRibbonWaterAutoSupplyBridgeProps {
  readonly levelManager: LevelManagerLike;
}

export interface RibbonWaterAutoSupplyBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonWaterAutoSupplyBridge(
  props: UseRibbonWaterAutoSupplyBridgeProps,
): RibbonWaterAutoSupplyBridge {
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
    const proposal = designWaterSupply(model, entities);
    if (proposal.networks.length === 0) {
      waterProposalStore.reset();
      EventBus.emit('bim:water-supply-empty', {
        reason: proposal.warnings.length > 0 ? 'no-source' : 'no-fixtures',
      });
      return;
    }
    waterProposalStore.set({ proposal, sceneUnits });
    EventBus.emit('bim:water-supply-generated', {
      networkCount: proposal.networks.length,
      warningCount: proposal.warnings.length,
    });
  }, [levelManager]);

  // Accept — commit the reviewed proposal as one atomic transaction.
  const handleAccept = useCallback((): void => {
    const review = waterProposalStore.get();
    const levelId = levelManager.currentLevelId;
    if (!review || !levelId) return;
    const layerId = getCurrentLayerId() ?? '';
    const plan = buildWaterSupplyCommit(review.proposal, layerId, review.sceneUnits, (network, i) =>
      t('ribbon.commands.waterSupply.networkName', {
        service: t(`ribbon.commands.waterSupply.service.${network.service}`),
        n: i + 1,
      }),
    );
    if (plan.segmentEntities.length === 0) {
      waterProposalStore.reset();
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
    executeCommand(new CompoundCommand('Generate water supply', commands));
    waterProposalStore.reset();
    EventBus.emit('bim:water-supply-committed', {
      networkCount: plan.systemEntities.length,
      segmentCount: plan.segmentEntities.length,
    });
  }, [levelManager, executeCommand, t]);

  const handleReject = useCallback((): void => {
    waterProposalStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === WATER_SUPPLY_RIBBON_ACTIONS.generate) return handleGenerate();
      if (action === WATER_SUPPLY_RIBBON_ACTIONS.accept) return handleAccept();
      if (action === WATER_SUPPLY_RIBBON_ACTIONS.reject) return handleReject();
    },
    [handleGenerate, handleAccept, handleReject],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

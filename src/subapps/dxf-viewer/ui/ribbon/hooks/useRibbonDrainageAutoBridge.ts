'use client';

/**
 * ADR-427 Slice 2 — Bridge between the «Αυτόματη Αποχέτευση» ribbon actions and the
 * sanitary-drainage auto-design engine (Slice 1) + the proposal/commit layer.
 *
 * Revit "Generate → review → accept":
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run
 *     `designDrainage` (Slice 1) → push the `DrainageNetworkProposal` into the
 *     low-frequency proposal store, which the canvas ghost leaf renders.
 *   - **accept**: turn the reviewed proposal into real entities via the pure
 *     `buildDrainageCommit`, then dispatch ONE `CompoundCommand`
 *     (`CreateMepSegmentsCommand` + a `CreateMepSystemCommand` per network) — a
 *     single atomic undo. The auto-fitting reconciler grows the φρεάτιο/elbows afterwards.
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon
 * bridges in `useRibbonCommands`. Feedback is decoupled via EventBus →
 * `useDxfViewerNotifications`.
 *
 * @see ../../../systems/mep-design/drainage/design-drainage.ts (engine)
 * @see ../../../systems/mep-design/drainage/commit/build-drainage-commit.ts (commit builder)
 * @see ./useRibbonWaterAutoSupplyBridge.ts (pressurised counterpart / template)
 * @see docs/centralized-systems/reference/adrs/ADR-427-sanitary-drainage-auto-design.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCommandHistory, CompoundCommand, type ICommand } from '../../../core/commands';
import { CreateMepSystemCommand } from '../../../core/commands/entity-commands/CreateMepSystemCommand';
import { CreateMepSegmentsCommand } from '../../../core/commands/entity-commands/CreateMepSegmentsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { getCurrentLayerId } from '../../../stores/LayerStore';
import { resolveSceneUnits } from '../../../utils/scene-units';
import { EventBus } from '../../../systems/events/EventBus';
import {
  recognizeSceneFromRegistry,
  registerMepRecognition,
} from '../../../systems/recognition';
import { designDrainage } from '../../../systems/mep-design/drainage';
import { drainageProposalStore } from '../../../systems/mep-design/drainage/drainage-proposal-store';
import { buildDrainageCommit } from '../../../systems/mep-design/drainage/commit/build-drainage-commit';
import { DRAINAGE_AUTO_RIBBON_ACTIONS } from './bridge/drainage-auto-command-keys';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseRibbonDrainageAutoBridgeProps {
  readonly levelManager: LevelManagerLike;
}

export interface RibbonDrainageAutoBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonDrainageAutoBridge(
  props: UseRibbonDrainageAutoBridgeProps,
): RibbonDrainageAutoBridge {
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
    // ⚠️ designDrainage takes sceneUnits as its 3rd arg (gravity slope rise needs mm).
    const proposal = designDrainage(model, entities, sceneUnits);
    if (proposal.networks.length === 0) {
      drainageProposalStore.reset();
      EventBus.emit('bim:drainage-empty', {
        reason: proposal.warnings.length > 0 ? 'no-collector' : 'no-fixtures',
      });
      return;
    }
    drainageProposalStore.set({ proposal, sceneUnits });
    EventBus.emit('bim:drainage-generated', {
      networkCount: proposal.networks.length,
      warningCount: proposal.warnings.length,
    });
  }, [levelManager]);

  // Accept — commit the reviewed proposal as one atomic transaction.
  const handleAccept = useCallback((): void => {
    const review = drainageProposalStore.get();
    const levelId = levelManager.currentLevelId;
    if (!review || !levelId) return;
    const layerId = getCurrentLayerId() ?? '';
    const plan = buildDrainageCommit(review.proposal, layerId, review.sceneUnits, (_network, i) =>
      t('ribbon.commands.drainage.networkName', { n: i + 1 }),
    );
    if (plan.segmentEntities.length === 0) {
      drainageProposalStore.reset();
      return;
    }
    const adapter = createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelId,
    );
    const commands: ICommand[] = [
      new CreateMepSegmentsCommand(plan.segmentEntities, adapter),
      ...plan.systemEntities.map((entity) => new CreateMepSystemCommand(entity)),
    ];
    executeCommand(new CompoundCommand('Generate drainage', commands));
    drainageProposalStore.reset();
    EventBus.emit('bim:drainage-committed', {
      networkCount: plan.systemEntities.length,
      segmentCount: plan.segmentEntities.length,
    });
  }, [levelManager, executeCommand, t]);

  const handleReject = useCallback((): void => {
    drainageProposalStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === DRAINAGE_AUTO_RIBBON_ACTIONS.generate) return handleGenerate();
      if (action === DRAINAGE_AUTO_RIBBON_ACTIONS.accept) return handleAccept();
      if (action === DRAINAGE_AUTO_RIBBON_ACTIONS.reject) return handleReject();
    },
    [handleGenerate, handleAccept, handleReject],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

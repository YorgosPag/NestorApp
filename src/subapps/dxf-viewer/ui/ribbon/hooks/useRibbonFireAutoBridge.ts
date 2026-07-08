'use client';

/**
 * ADR-433 Slice 2 — Bridge between the «Αυτόματη Πυρόσβεση» ribbon actions and the
 * fire-protection (sprinkler) auto-design engine (Slice 1) + the proposal/commit layer.
 *
 * Revit "Generate → review → accept":
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run `designFire`
 *     (Slice 1) → push the `FireNetworkProposal` into the low-frequency proposal store,
 *     which the canvas ghost leaf renders.
 *   - **accept**: turn the reviewed proposal into real entities via the pure
 *     `buildFireCommit`, then dispatch ONE `CompoundCommand` (`CreateMepSegmentsCommand` +
 *     a `CreateMepSystemCommand` per network) — a single atomic undo. The auto-fitting
 *     reconciler grows elbows/tees afterwards.
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon bridges in
 * `useRibbonCommands`. Feedback is decoupled via EventBus → `useDxfViewerNotifications`.
 *
 * @see ../../../systems/mep-design/fire/design-fire.ts (engine)
 * @see ../../../systems/mep-design/fire/commit/build-fire-commit.ts (commit builder)
 * @see ./useRibbonHvacAutoBridge.ts (action-bridge template)
 * @see docs/centralized-systems/reference/adrs/ADR-433-fire-protection-auto-design.md
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
import { designFire } from '../../../systems/mep-design/fire';
import { fireProposalStore } from '../../../systems/mep-design/fire/fire-proposal-store';
import { buildFireCommit } from '../../../systems/mep-design/fire/commit/build-fire-commit';
import { FIRE_AUTO_RIBBON_ACTIONS } from './bridge/fire-auto-command-keys';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';

export interface UseRibbonFireAutoBridgeProps {
  readonly levelManager: LevelSceneWriter;
}

export interface RibbonFireAutoBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonFireAutoBridge(
  props: UseRibbonFireAutoBridgeProps,
): RibbonFireAutoBridge {
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
    const proposal = designFire(model, entities);
    if (proposal.networks.length === 0) {
      fireProposalStore.reset();
      EventBus.emit('bim:fire-empty', {
        reason: proposal.warnings.length > 0 ? 'no-source' : 'no-terminals',
      });
      return;
    }
    fireProposalStore.set({ proposal, sceneUnits });
    EventBus.emit('bim:fire-generated', {
      networkCount: proposal.networks.length,
      warningCount: proposal.warnings.length,
    });
  }, [levelManager]);

  // Accept — commit the reviewed proposal as one atomic transaction.
  const handleAccept = useCallback((): void => {
    const review = fireProposalStore.get();
    const levelId = levelManager.currentLevelId;
    if (!review || !levelId) return;
    const layerId = getCurrentLayerId() ?? '';
    const plan = buildFireCommit(review.proposal, layerId, review.sceneUnits, (network, i) =>
      t('ribbon.commands.fire.networkName', {
        service: t(`ribbon.commands.fire.service.${network.service}`),
        n: i + 1,
      }),
    );
    if (plan.segmentEntities.length === 0) {
      fireProposalStore.reset();
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
    executeCommand(new CompoundCommand('Generate fire protection', commands));
    fireProposalStore.reset();
    EventBus.emit('bim:fire-committed', {
      networkCount: plan.systemEntities.length,
      segmentCount: plan.segmentEntities.length,
    });
  }, [levelManager, executeCommand, t]);

  const handleReject = useCallback((): void => {
    fireProposalStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === FIRE_AUTO_RIBBON_ACTIONS.generate) return handleGenerate();
      if (action === FIRE_AUTO_RIBBON_ACTIONS.accept) return handleAccept();
      if (action === FIRE_AUTO_RIBBON_ACTIONS.reject) return handleReject();
    },
    [handleGenerate, handleAccept, handleReject],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

'use client';

/**
 * ADR-428 Slice 2 — Bridge between the «Αυτόματη Θέρμανση» ribbon actions and the
 * heating (hydronic) auto-design engine (Slice 1) + the proposal/commit layer.
 *
 * Revit "Generate → review → accept":
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run
 *     `designHeating` (Slice 1) → push the `HeatingNetworkProposal` into the
 *     low-frequency proposal store, which the canvas ghost leaf renders.
 *   - **accept**: turn the reviewed proposal into real entities via the pure
 *     `buildHeatingCommit`, then dispatch ONE `CompoundCommand`
 *     (`CreateMepSegmentsCommand` + a `CreateMepSystemCommand` per network) — a
 *     single atomic undo. The auto-fitting reconciler grows the elbows/tees afterwards.
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon
 * bridges in `useRibbonCommands`. Feedback is decoupled via EventBus →
 * `useDxfViewerNotifications`.
 *
 * @see ../../../systems/mep-design/heating/design-heating.ts (engine)
 * @see ../../../systems/mep-design/heating/commit/build-heating-commit.ts (commit builder)
 * @see ./useRibbonDrainageAutoBridge.ts (single-source counterpart / template)
 * @see docs/centralized-systems/reference/adrs/ADR-428-heating-auto-design.md
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
import { designHeating } from '../../../systems/mep-design/heating';
import { heatingProposalStore } from '../../../systems/mep-design/heating/heating-proposal-store';
import { buildHeatingCommit } from '../../../systems/mep-design/heating/commit/build-heating-commit';
import { HEATING_AUTO_RIBBON_ACTIONS } from './bridge/heating-auto-command-keys';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseRibbonHeatingAutoBridgeProps {
  readonly levelManager: LevelManagerLike;
}

export interface RibbonHeatingAutoBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonHeatingAutoBridge(
  props: UseRibbonHeatingAutoBridgeProps,
): RibbonHeatingAutoBridge {
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
    // ⚠️ designHeating takes (model, entities) only — the closed loop is flat (no slope),
    // so it needs no sceneUnits (unlike designDrainage). sceneUnits is carried separately
    // for the ghost (mm → canvas) and the commit (segment build).
    const proposal = designHeating(model, entities);
    if (proposal.networks.length === 0) {
      heatingProposalStore.reset();
      EventBus.emit('bim:heating-empty', {
        reason: proposal.warnings.length > 0 ? 'no-source' : 'no-terminals',
      });
      return;
    }
    heatingProposalStore.set({ proposal, sceneUnits });
    EventBus.emit('bim:heating-generated', {
      networkCount: proposal.networks.length,
      warningCount: proposal.warnings.length,
    });
  }, [levelManager]);

  // Accept — commit the reviewed proposal as one atomic transaction.
  const handleAccept = useCallback((): void => {
    const review = heatingProposalStore.get();
    const levelId = levelManager.currentLevelId;
    if (!review || !levelId) return;
    const layerId = getCurrentLayerId() ?? '';
    const plan = buildHeatingCommit(review.proposal, layerId, review.sceneUnits, (network) =>
      network.role === 'supply'
        ? t('ribbon.commands.heating.supplyName')
        : t('ribbon.commands.heating.returnName'),
    );
    if (plan.segmentEntities.length === 0) {
      heatingProposalStore.reset();
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
    executeCommand(new CompoundCommand('Generate heating', commands));
    heatingProposalStore.reset();
    EventBus.emit('bim:heating-committed', {
      networkCount: plan.systemEntities.length,
      segmentCount: plan.segmentEntities.length,
    });
  }, [levelManager, executeCommand, t]);

  const handleReject = useCallback((): void => {
    heatingProposalStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === HEATING_AUTO_RIBBON_ACTIONS.generate) return handleGenerate();
      if (action === HEATING_AUTO_RIBBON_ACTIONS.accept) return handleAccept();
      if (action === HEATING_AUTO_RIBBON_ACTIONS.reject) return handleReject();
    },
    [handleGenerate, handleAccept, handleReject],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

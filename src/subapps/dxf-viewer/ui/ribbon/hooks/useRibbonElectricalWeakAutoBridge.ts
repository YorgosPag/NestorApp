'use client';

/**
 * ADR-431 Slice 2 — Bridge between the «Αυτόματα Ασθενή» ribbon actions and the
 * electrical-WEAK auto-design engine (Slice 1) + the SHARED proposal/commit layer.
 *
 * The sibling of `useRibbonElectricalAutoBridge` (ADR-430). Revit "Generate → review →
 * accept":
 *   - **generate**: recognize the storey (Stage 0) + run `designElectricalWeak` (skipping
 *     already-channelled outlets) → build the channel `MepSystem` entities
 *     (`buildWeakCommit`) + pre-route their home-run wires (`computeCircuitWirePaths`) →
 *     push the review into the SAME low-frequency proposal store the strong bridge uses
 *     (one auto-design review at a time), which the canvas ghost leaf renders.
 *   - **accept**: dispatch ONE `CompoundCommand` of `CreateMepSystemCommand`s (single undo).
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon bridges.
 *
 * @see ./useRibbonElectricalAutoBridge.ts (the strong counterpart / template)
 * @see ../../../systems/mep-design/electrical/design-electrical-weak.ts (engine)
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCommandHistory, CompoundCommand, type ICommand } from '../../../core/commands';
import { CreateMepSystemCommand } from '../../../core/commands/entity-commands/CreateMepSystemCommand';
import { resolveSceneUnits } from '../../../utils/scene-units';
import { EventBus } from '../../../systems/events/EventBus';
import {
  recognizeSceneFromRegistry,
  registerMepRecognition,
} from '../../../systems/recognition';
import { designElectricalWeak } from '../../../systems/mep-design/electrical';
import type { ProposedWeakChannel } from '../../../systems/mep-design/electrical';
import { electricalProposalStore } from '../../../systems/mep-design/electrical/electrical-proposal-store';
import { buildWeakCommit } from '../../../systems/mep-design/electrical/commit/build-electrical-weak-commit';
import { computeCircuitWirePaths } from '../../../bim/mep-systems/mep-wire-routing';
import { resolverFromHosts } from '../../../bim/mep-systems/mep-wire-resolver';
import { collectWireHosts } from '../../../bim/mep-systems/mep-wire-scene';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS } from './bridge/electrical-weak-auto-command-keys';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { Entity } from '../../../types/entities';

export interface UseRibbonElectricalWeakAutoBridgeProps {
  readonly levelManager: LevelSceneWriter;
}

export interface RibbonElectricalWeakAutoBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonElectricalWeakAutoBridge(
  props: UseRibbonElectricalWeakAutoBridgeProps,
): RibbonElectricalWeakAutoBridge {
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
    const proposal = designElectricalWeak(model, entities, systems, sceneUnits);
    if (proposal.channels.length === 0) {
      electricalProposalStore.reset();
      EventBus.emit('bim:electrical-weak-empty', {
        reason: proposal.warnings.some((w) => w.includes('comms-rack')) ? 'no-source' : 'no-terminals',
      });
      return;
    }
    // i18n channel name: «Δεδομένα 1» / «Έλεγχος 2».
    const resolveChannelName = (channel: ProposedWeakChannel, index: number): string => {
      const base =
        channel.service === 'data'
          ? t('ribbon.commands.electricalWeak.dataName')
          : t('ribbon.commands.electricalWeak.controlsName');
      return `${base} ${index + 1}`;
    };
    const plan = buildWeakCommit(proposal, resolveChannelName);
    const resolve = resolverFromHosts(collectWireHosts(entities));
    const wirePaths = computeCircuitWirePaths(plan.systemEntities, resolve);
    electricalProposalStore.set({ proposal, systemEntities: plan.systemEntities, wirePaths, sceneUnits });
    EventBus.emit('bim:electrical-weak-generated', {
      channelCount: proposal.channels.length,
      skipped: proposal.skippedAlreadyCircuited,
      warningCount: proposal.warnings.length,
    });
  }, [levelManager, systems, t]);

  // Accept — commit the reviewed channels as one atomic transaction.
  const handleAccept = useCallback((): void => {
    const review = electricalProposalStore.get();
    if (!review || review.systemEntities.length === 0) {
      electricalProposalStore.reset();
      return;
    }
    const commands: ICommand[] = review.systemEntities.map(
      (entity) => new CreateMepSystemCommand(entity),
    );
    executeCommand(new CompoundCommand('Generate structured-cabling channels', commands));
    electricalProposalStore.reset();
    EventBus.emit('bim:electrical-weak-committed', { channelCount: commands.length });
  }, [executeCommand]);

  const handleReject = useCallback((): void => {
    electricalProposalStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS.generate) return handleGenerate();
      if (action === ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS.accept) return handleAccept();
      if (action === ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS.reject) return handleReject();
    },
    [handleGenerate, handleAccept, handleReject],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}

/**
 * Factory for the electrical auto-design ribbon bridges (ADR-430 strong · ADR-431 weak) — the
 * electrical counterpart of `create-ribbon-mep-auto-bridge` (pipe disciplines). Revit
 * "Generate → review → accept":
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run the discipline engine
 *     (skipping terminals already on a circuit/channel) → build the `MepSystem` entities +
 *     pre-route their home-run wires (`computeCircuitWirePaths`) → push the review into the
 *     SHARED low-frequency proposal store (tagged with `origin`), which the ghost leaf renders.
 *   - **accept**: ONE `CompoundCommand` of `CreateMepSystemCommand`s (`commitElectricalReview`).
 *   - **reject**: discard the review — only when it is this bridge's `origin`.
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon bridges in
 * `useRibbonCommands`. Feedback is decoupled via the `emit*` callbacks → EventBus.
 */

import { useCallback } from 'react';
import type { TFunction } from 'i18next';

import {
  electricalProposalStore,
  type ElectricalProposalOrigin,
  type ProposalReviewSummary,
} from '../../../../systems/mep-design/electrical/electrical-proposal-store';
import { computeCircuitWirePaths } from '../../../../bim/mep-systems/mep-wire-routing';
import { resolverFromHosts } from '../../../../bim/mep-systems/mep-wire-resolver';
import { collectWireHosts } from '../../../../bim/mep-systems/mep-wire-scene';
import type { MepSystemEntity } from '../../../../bim/types/mep-system-types';
import type { RecognitionModel } from '../../../../systems/recognition';
import type { SceneUnits } from '../../../../utils/scene-units';
import type { LevelSceneWriter } from '../../../../systems/levels/level-scene-accessor';
import type { Entity } from '../../../../types/entities';
import { recognizeCurrentStorey } from './mep-storey-recognition';
import { commitElectricalReview } from './electrical-proposal-commit';
import { useElectricalAutoBridgeDeps } from './use-electrical-auto-bridge-deps';
import { useGenerateReviewActions } from './use-generate-review-actions';

export interface ElectricalAutoBridgeConfig<P extends ProposalReviewSummary> {
  readonly origin: ElectricalProposalOrigin;
  readonly actions: { readonly generate: string; readonly accept: string; readonly reject: string };
  /** Undo-history label of the Accept transaction. */
  readonly commandLabel: string;
  readonly design: (
    model: RecognitionModel,
    entities: readonly Entity[],
    systems: readonly MepSystemEntity[],
    sceneUnits: SceneUnits,
  ) => P;
  /** Circuits / channels proposed — `0` ⇒ «nothing to design». */
  readonly countOf: (proposal: P) => number;
  /** Builds the `MepSystem`s Accept will create (i18n names via `t`). */
  readonly buildSystems: (proposal: P, t: TFunction) => readonly MepSystemEntity[];
  readonly emitEmpty: (proposal: P) => void;
  readonly emitGenerated: (proposal: P) => void;
  readonly emitCommitted: (count: number) => void;
}

export interface ElectricalAutoBridgeProps {
  readonly levelManager: LevelSceneWriter;
}

export interface ElectricalAutoBridge {
  readonly onAction: (action: string) => void;
}

export function createElectricalAutoBridge<P extends ProposalReviewSummary>(
  config: ElectricalAutoBridgeConfig<P>,
): (props: ElectricalAutoBridgeProps) => ElectricalAutoBridge {
  const { origin, actions, commandLabel, design, countOf, buildSystems, emitEmpty, emitGenerated, emitCommitted } =
    config;

  return function useElectricalAutoBridge(props: ElectricalAutoBridgeProps): ElectricalAutoBridge {
    const { levelManager } = props;
    const { executeCommand, t, systems } = useElectricalAutoBridgeDeps();

    const handleGenerate = useCallback((): void => {
      const storey = recognizeCurrentStorey(levelManager);
      if (!storey) return;
      const entities = storey.entities as readonly Entity[];
      const proposal = design(storey.model, entities, systems, storey.sceneUnits);
      if (countOf(proposal) === 0) {
        electricalProposalStore.reset();
        emitEmpty(proposal);
        return;
      }
      const systemEntities = buildSystems(proposal, t);
      const wirePaths = computeCircuitWirePaths(systemEntities, resolverFromHosts(collectWireHosts(entities)));
      electricalProposalStore.set({ origin, proposal, systemEntities, wirePaths, sceneUnits: storey.sceneUnits });
      emitGenerated(proposal);
    }, [levelManager, systems, t]);

    const handleAccept = useCallback((): void => {
      const count = commitElectricalReview(origin, commandLabel, executeCommand);
      if (count !== null) emitCommitted(count);
    }, [executeCommand]);

    const handleReject = useCallback((): void => {
      if (electricalProposalStore.get()?.origin === origin) electricalProposalStore.reset();
    }, []);

    return useGenerateReviewActions(actions, {
      onGenerate: handleGenerate,
      onAccept: handleAccept,
      onReject: handleReject,
    });
  };
}

'use client';

/**
 * ADR-609 — createRibbonMepAutoBridge SSoT factory.
 *
 * The 6 pressurised/gravity **network** auto-design ribbon bridges (water-supply,
 * drainage, heating, hvac, fire, gas) repeated the SAME ~90-line body verbatim,
 * differing ΜΟΝΟ σε 7 παραμέτρους: the action-key set, the proposal store, the
 * discipline `design*` engine, the pure `build*Commit` builder, the per-network i18n
 * name resolver, the `CompoundCommand` label, and the `bim:<discipline>-{empty,
 * generated,committed}` EventBus feedback triple. This factory is that single source —
 * Revit "Generate → review → accept":
 *
 *   - **generate**: recognize the current storey (Stage 0, ADR-425) + run the
 *     discipline engine → push the proposal into the low-frequency proposal store,
 *     which the canvas ghost leaf renders. Empty proposal ⇒ reset + `-empty` feedback.
 *   - **accept**: turn the reviewed proposal into real entities via the pure builder,
 *     then dispatch ONE `CompoundCommand` (`CreateMepSegmentsCommand` + a
 *     `CreateMepSystemCommand` per network) — a single atomic undo. The auto-fitting
 *     reconciler grows elbows/tees afterwards.
 *   - **reject**: clear the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so the built hook composes with the other
 * ribbon bridges in `useRibbonCommands`. Feedback is decoupled via EventBus →
 * `useDxfViewerNotifications`. Each discipline supplies its own typed `emit*` thunk so
 * the strongly-typed EventBus keys stay concrete (zero `any`, no generic-key erasure).
 * Sibling of the commit-layer SSoT `createMepNetworkCommitBuilder` (ADR-606) it
 * consumes, and the 3D placement-hook factory `createBim3DPointPlacementHook` (ADR-605).
 *
 * NOTE: the two electrical bridges (`useRibbonElectricalAutoBridge` /
 * `useRibbonElectricalWeakAutoBridge`) are a DIFFERENT shape (channels + home-run wire
 * routing, `CreateMepSystemCommand`-only) and are intentionally NOT built by this
 * factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-609-ribbon-mep-auto-bridge-ssot.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { useCommandHistory, CompoundCommand, type ICommand } from '../../../core/commands';
import { CreateMepSystemCommand } from '../../../core/commands/entity-commands/CreateMepSystemCommand';
import { CreateMepSegmentsCommand } from '../../../core/commands/entity-commands/CreateMepSegmentsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { getCurrentLayerId } from '../../../stores/LayerStore';
import { resolveSceneUnits, type SceneUnits } from '../../../utils/scene-units';
import {
  recognizeSceneFromRegistry,
  registerMepRecognition,
  type RecognitionModel,
} from '../../../systems/recognition';
import type {
  MepNetworkCommitPlan,
  ResolveMepSystemName,
} from '../../../systems/mep-design/shared/create-mep-network-commit-builder';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { Entity } from '../../../types/entities';

/** The reviewed proposal plus the scene units it was generated in (store payload). */
interface MepAutoProposalReview<TProposal> {
  readonly proposal: TProposal;
  readonly sceneUnits: SceneUnits;
}

/** The discrete-write proposal store each discipline publishes (ADR-040 low-frequency). */
interface MepAutoProposalStore<TProposal> {
  get(): MepAutoProposalReview<TProposal> | null;
  set(review: MepAutoProposalReview<TProposal>): void;
  reset(): void;
}

/** The minimal shape the factory reads off any discipline proposal. */
interface MepAutoProposal<TNetwork> {
  readonly networks: readonly TNetwork[];
  readonly warnings: readonly unknown[];
}

/**
 * The per-discipline variation vector — everything the shared Generate/Accept/Reject
 * pipeline needs that differs between water/drainage/heating/hvac/fire/gas.
 */
export interface RibbonMepAutoBridgeConfig<
  TNetwork,
  TProposal extends MepAutoProposal<TNetwork>,
> {
  /** The `generate` / `accept` / `reject` ribbon command keys this bridge owns. */
  readonly actions: {
    readonly generate: string;
    readonly accept: string;
    readonly reject: string;
  };
  /** The discipline proposal store (single review under Generate → review → accept). */
  readonly store: MepAutoProposalStore<TProposal>;
  /**
   * The discipline auto-design engine. Receives `sceneUnits` for the disciplines that
   * need it (drainage gravity slope); the flat-network engines ignore the 3rd arg.
   */
  readonly design: (
    model: RecognitionModel,
    entities: readonly Entity[],
    sceneUnits: SceneUnits,
  ) => TProposal;
  /** The pure `build<discipline>Commit` builder (ADR-606). */
  readonly buildCommit: (
    proposal: TProposal,
    layerId: string,
    sceneUnits: SceneUnits,
    resolveName: ResolveMepSystemName<TNetwork>,
  ) => MepNetworkCommitPlan;
  /** i18n display name for one network (kept in the caller; the builder stays pure). */
  readonly resolveNetworkName: (
    t: TFunction<'dxf-viewer-shell'>,
    network: TNetwork,
    index: number,
  ) => string;
  /** The `CompoundCommand` label (single atomic undo entry). */
  readonly commandLabel: string;
  /**
   * `bim:<discipline>-empty` feedback. `hasWarnings` is true when the engine found a
   * source/collector but routed nothing (vs no terminals/fixtures at all) — each
   * discipline maps it onto its own strongly-typed `reason` union.
   */
  readonly emitEmpty: (hasWarnings: boolean) => void;
  /** `bim:<discipline>-generated` feedback (proposal pushed to the ghost store). */
  readonly emitGenerated: (networkCount: number, warningCount: number) => void;
  /** `bim:<discipline>-committed` feedback (accept transaction dispatched). */
  readonly emitCommitted: (networkCount: number, segmentCount: number) => void;
}

/** Props every network auto-bridge hook takes — the level scene writer. */
export interface RibbonMepAutoBridgeProps {
  readonly levelManager: LevelSceneWriter;
}

/** The imperative surface `useRibbonCommands` dispatches into. */
export interface RibbonMepAutoBridge {
  readonly onAction: (action: string) => void;
}

/**
 * Build a network auto-design ribbon bridge hook for one MEP discipline. The returned
 * hook is the parametric SSoT for the 6 `useRibbon<Discipline>AutoBridge` cells.
 */
export function createRibbonMepAutoBridge<
  TNetwork,
  TProposal extends MepAutoProposal<TNetwork>,
>(
  config: RibbonMepAutoBridgeConfig<TNetwork, TProposal>,
): (props: RibbonMepAutoBridgeProps) => RibbonMepAutoBridge {
  const {
    actions,
    store,
    design,
    buildCommit,
    resolveNetworkName,
    commandLabel,
    emitEmpty,
    emitGenerated,
    emitCommitted,
  } = config;

  return function useRibbonMepAutoBridge(
    props: RibbonMepAutoBridgeProps,
  ): RibbonMepAutoBridge {
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
      const proposal = design(model, entities, sceneUnits);
      if (proposal.networks.length === 0) {
        store.reset();
        emitEmpty(proposal.warnings.length > 0);
        return;
      }
      store.set({ proposal, sceneUnits });
      emitGenerated(proposal.networks.length, proposal.warnings.length);
    }, [levelManager]);

    // Accept — commit the reviewed proposal as one atomic transaction.
    const handleAccept = useCallback((): void => {
      const review = store.get();
      const levelId = levelManager.currentLevelId;
      if (!review || !levelId) return;
      const layerId = getCurrentLayerId() ?? '';
      const plan = buildCommit(review.proposal, layerId, review.sceneUnits, (network, i) =>
        resolveNetworkName(t, network, i),
      );
      if (plan.segmentEntities.length === 0) {
        store.reset();
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
      executeCommand(new CompoundCommand(commandLabel, commands));
      store.reset();
      emitCommitted(plan.systemEntities.length, plan.segmentEntities.length);
    }, [levelManager, executeCommand, t]);

    const handleReject = useCallback((): void => {
      store.reset();
    }, []);

    const onAction = useCallback(
      (action: string): void => {
        if (action === actions.generate) return handleGenerate();
        if (action === actions.accept) return handleAccept();
        if (action === actions.reject) return handleReject();
      },
      [handleGenerate, handleAccept, handleReject],
    );

    return useMemo(() => ({ onAction }), [onAction]);
  };
}

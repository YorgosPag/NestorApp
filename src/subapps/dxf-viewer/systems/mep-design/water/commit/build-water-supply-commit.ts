/**
 * ADR-426 Slice 2 — Water-supply commit **builder** (pure).
 *
 * Turns a reviewed `WaterNetworkProposal` into the concrete entities that the
 * accept transaction will create — WITHOUT touching the scene, the command
 * history, React, or Firestore. Keeping this pure makes the whole "Generate →
 * accept" translation unit-testable in isolation; the ribbon bridge wraps the
 * output in commands and dispatches.
 *
 * Per network (cold / hot):
 *   1. Each `ProposedSegment` → a real `MepSegmentEntity` (round pipe) via the SSoT
 *      `completeMepSegmentFromTwoClicks` — same builder the manual 2-click pipe tool
 *      uses, so geometry / validation / id-minting are identical. A segment that
 *      fails validation is skipped (counted) rather than aborting the whole network.
 *   2. The `MepSystem` (Revit "System Type" Cold/Hot) — members are every emitted
 *      segment's two endpoint connectors (`pipeSegmentMembers`) PLUS the proposal's
 *      `servedConnectors` (each served fixture's matching cold/hot inlet). Source =
 *      the recognized manifold/boiler outlet the engine resolved.
 *
 * The fittings (elbows/tees/reducers) are NOT built here: once the segments land in
 * the scene, the auto-reconciler (`useMepFittingAutoReconciliation`) inserts them.
 *
 * @see ./design-water-supply.ts (producer of the proposal)
 * @see ../../../bim/mep-systems/mep-pipe-network-from-selection.ts (members SSoT)
 * @see ../../../hooks/drawing/mep-segment-completion.ts (segment SSoT)
 */

import { generateMepSystemId } from '@/services/enterprise-id-convenience';
import type { SceneUnits } from '../../../../utils/scene-units';
import {
  completeMepSegmentFromTwoClicks,
} from '../../../../hooks/drawing/mep-segment-completion';
import type { MepSegmentEntity } from '../../../../bim/types/mep-segment-types';
import type { MepSystemEntity, MepSystemMember } from '../../../../bim/types/mep-system-types';
import { buildDefaultPipeNetworkParams } from '../../../../bim/types/mep-system-types';
import { pipeSegmentMembers } from '../../../../bim/mep-systems/mep-pipe-network-from-selection';
import type { ProposedNetwork, WaterNetworkProposal } from '../water-design-types';

/** The concrete entities an accept transaction will create. */
export interface WaterSupplyCommitPlan {
  /** All emitted pipe segments, across every network (flattened). */
  readonly segmentEntities: readonly MepSegmentEntity[];
  /** One `MepSystem` per network that produced at least one valid segment. */
  readonly systemEntities: readonly MepSystemEntity[];
  /** Proposed segments that failed validation and were skipped. */
  readonly skippedSegments: number;
}

/** Resolves a system display name (i18n lives in the caller — keep the builder pure). */
export type ResolveSystemName = (network: ProposedNetwork, indexAmongNetworks: number) => string;

/** Build one network's segments + its `MepSystem` entity. */
function buildNetworkEntities(
  network: ProposedNetwork,
  index: number,
  layerId: string,
  sceneUnits: SceneUnits,
  resolveName: ResolveSystemName,
): { segments: MepSegmentEntity[]; system: MepSystemEntity | null; skipped: number } {
  const segments: MepSegmentEntity[] = [];
  let skipped = 0;
  // The whole network runs flat at the source outlet's elevation (Revit "Connect
  // To"): both endpoints of every run carry the source mm height, so the pipes sit
  // at the manifold/boiler datum instead of the default ceiling centreline.
  const elevationMm = network.sourceElevationMm;
  for (const seg of network.segments) {
    const result = completeMepSegmentFromTwoClicks(
      seg.start,
      seg.end,
      layerId,
      'pipe',
      { classification: seg.classification, diameter: seg.diameterMm },
      sceneUnits,
      elevationMm,
      elevationMm,
    );
    if (result.ok) segments.push(result.entity);
    else skipped += 1;
  }

  // A network with zero buildable segments contributes no system (honest).
  if (segments.length === 0) return { segments, system: null, skipped };

  const members: MepSystemMember[] = [
    ...segments.flatMap(pipeSegmentMembers),
    ...network.servedConnectors,
  ];
  const system: MepSystemEntity = {
    id: generateMepSystemId(),
    params: buildDefaultPipeNetworkParams(
      resolveName(network, index),
      network.classification,
      network.sourceEntityId,
      network.sourceConnectorId,
      members,
    ),
  };
  return { segments, system, skipped };
}

/**
 * Build the full commit plan for a reviewed proposal. Pure — no side effects.
 */
export function buildWaterSupplyCommit(
  proposal: WaterNetworkProposal,
  layerId: string,
  sceneUnits: SceneUnits,
  resolveName: ResolveSystemName,
): WaterSupplyCommitPlan {
  const segmentEntities: MepSegmentEntity[] = [];
  const systemEntities: MepSystemEntity[] = [];
  let skippedSegments = 0;
  proposal.networks.forEach((network, index) => {
    const built = buildNetworkEntities(network, index, layerId, sceneUnits, resolveName);
    segmentEntities.push(...built.segments);
    if (built.system) systemEntities.push(built.system);
    skippedSegments += built.skipped;
  });
  return { segmentEntities, systemEntities, skippedSegments };
}

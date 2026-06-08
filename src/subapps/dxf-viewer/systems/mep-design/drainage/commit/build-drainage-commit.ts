/**
 * ADR-427 Slice 2 — Sanitary-drainage commit **builder** (pure).
 *
 * Turns a reviewed `DrainageNetworkProposal` into the concrete entities that the
 * accept transaction will create — WITHOUT touching the scene, the command
 * history, React, or Firestore. Keeping this pure makes the whole "Generate →
 * accept" translation unit-testable in isolation; the ribbon bridge wraps the
 * output in commands and dispatches.
 *
 * Mirrors `../../water/commit/build-water-supply-commit.ts`, with the gravity
 * differences:
 *   1. Each `ProposedDrainageSegment` → a real sloped `MepSegmentEntity` (round
 *      pipe) via the SSoT `completeMepSegmentFromTwoClicks`. The per-endpoint
 *      elevations come straight from the proposal (`start` lower / `end` higher),
 *      so completion treats them as a "real connected run" (the network geometry
 *      wins, no slope re-projection) and stores the run's `slopePercent` as an
 *      instance param. A segment that fails validation is skipped (counted) rather
 *      than aborting the whole network.
 *   2. The `MepSystem` (Revit "System Type" = Αποχέτευση) — members are every
 *      emitted segment's two endpoint connectors (`pipeSegmentMembers`) PLUS the
 *      proposal's `servedConnectors` (each served fixture's sanitary-drainage
 *      outlet). Source = the recognized collector (φρεάτιο) outlet — the gravity
 *      sink, unlike the pressurised manifold/boiler source of the water network.
 *
 * The fittings (φρεάτιο junction / elbows) are NOT built here: once the segments
 * land in the scene, the auto-reconciler (`useMepFittingAutoReconciliation`) inserts them.
 *
 * @see ./../design-drainage.ts (producer of the proposal)
 * @see ../../water/commit/build-water-supply-commit.ts (pressurised counterpart)
 * @see ../../../../hooks/drawing/mep-segment-completion.ts (segment SSoT)
 */

import { generateMepSystemId } from '@/services/enterprise-id-convenience';
import type { SceneUnits } from '../../../../utils/scene-units';
import { completeMepSegmentFromTwoClicks } from '../../../../hooks/drawing/mep-segment-completion';
import type { MepSegmentEntity } from '../../../../bim/types/mep-segment-types';
import type { MepSystemEntity, MepSystemMember } from '../../../../bim/types/mep-system-types';
import { buildDefaultPipeNetworkParams } from '../../../../bim/types/mep-system-types';
import { pipeSegmentMembers } from '../../../../bim/mep-systems/mep-pipe-network-from-selection';
import type {
  ProposedDrainageNetwork,
  DrainageNetworkProposal,
} from '../drainage-design-types';

/** The concrete entities an accept transaction will create. */
export interface DrainageCommitPlan {
  /** All emitted pipe segments, across every network (flattened). */
  readonly segmentEntities: readonly MepSegmentEntity[];
  /** One `MepSystem` per network that produced at least one valid segment. */
  readonly systemEntities: readonly MepSystemEntity[];
  /** Proposed segments that failed validation and were skipped. */
  readonly skippedSegments: number;
}

/** Resolves a system display name (i18n lives in the caller — keep the builder pure). */
export type ResolveDrainageSystemName = (
  network: ProposedDrainageNetwork,
  indexAmongNetworks: number,
) => string;

/** Build one network's sloped segments + its `MepSystem` entity. */
function buildNetworkEntities(
  network: ProposedDrainageNetwork,
  index: number,
  layerId: string,
  sceneUnits: SceneUnits,
  resolveName: ResolveDrainageSystemName,
): { segments: MepSegmentEntity[]; system: MepSystemEntity | null; skipped: number } {
  const segments: MepSegmentEntity[] = [];
  let skipped = 0;
  for (const seg of network.segments) {
    // Per-endpoint z is the SSoT: `start` runs lower (toward the φρεάτιο) and `end`
    // higher, so the pair is DISTINCT and completion keeps it as a real gravity run.
    const result = completeMepSegmentFromTwoClicks(
      seg.start,
      seg.end,
      layerId,
      'pipe',
      { classification: seg.classification, diameter: seg.diameterMm, slopePercent: seg.slopePercent },
      sceneUnits,
      seg.startElevationMm,
      seg.endElevationMm,
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
      network.outfallEntityId,
      network.outfallConnectorId,
      members,
    ),
  };
  return { segments, system, skipped };
}

/**
 * Build the full commit plan for a reviewed proposal. Pure — no side effects.
 */
export function buildDrainageCommit(
  proposal: DrainageNetworkProposal,
  layerId: string,
  sceneUnits: SceneUnits,
  resolveName: ResolveDrainageSystemName,
): DrainageCommitPlan {
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

/**
 * ADR-428 Slice 2 — Heating (hydronic) commit **builder** (pure).
 *
 * Turns a reviewed `HeatingNetworkProposal` into the concrete entities that the
 * accept transaction will create — WITHOUT touching the scene, the command
 * history, React, or Firestore. Keeping this pure makes the whole "Generate →
 * accept" translation unit-testable in isolation; the ribbon bridge wraps the
 * output in commands and dispatches.
 *
 * Per network (supply / return — the two-pipe closed loop):
 *   1. Each `ProposedHeatingSegment` → a real `MepSegmentEntity` (round pipe) via the
 *      SSoT `completeMepSegmentFromTwoClicks` — same builder the manual 2-click pipe
 *      tool uses, so geometry / validation / id-minting are identical. The whole
 *      network is FLAT at the boiler endpoint elevation (Revit "Connect To"); there
 *      is NO slope (pressurised loop, unlike gravity drainage). A segment that fails
 *      validation is skipped (counted) rather than aborting the whole network.
 *   2. The `MepSystem` (Revit "System Type" Θέρμανση Προσαγωγή / Επιστροφή) — members
 *      are every emitted segment's two endpoint connectors (`pipeSegmentMembers`) PLUS
 *      the proposal's `servedConnectors` (each terminal's matching supply inlet /
 *      return outlet). Source = the recognized boiler endpoint the engine resolved.
 *
 * The fittings (elbows/tees/reducers) are NOT built here: once the segments land in
 * the scene, the auto-reconciler (`useMepFittingAutoReconciliation`) inserts them.
 *
 * @see ../design-heating.ts (producer of the proposal)
 * @see ../../water/commit/build-water-supply-commit.ts (pressurised counterpart / template)
 * @see ../../../../hooks/drawing/mep-segment-completion.ts (segment SSoT)
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
import type { ProposedHeatingNetwork, HeatingNetworkProposal } from '../heating-design-types';

/** The concrete entities an accept transaction will create. */
export interface HeatingCommitPlan {
  /** All emitted pipe segments, across both networks (flattened). */
  readonly segmentEntities: readonly MepSegmentEntity[];
  /** One `MepSystem` per network that produced at least one valid segment. */
  readonly systemEntities: readonly MepSystemEntity[];
  /** Proposed segments that failed validation and were skipped. */
  readonly skippedSegments: number;
}

/** Resolves a system display name (i18n lives in the caller — keep the builder pure). */
export type ResolveHeatingSystemName = (
  network: ProposedHeatingNetwork,
  indexAmongNetworks: number,
) => string;

/** Build one network's segments + its `MepSystem` entity. */
function buildNetworkEntities(
  network: ProposedHeatingNetwork,
  index: number,
  layerId: string,
  sceneUnits: SceneUnits,
  resolveName: ResolveHeatingSystemName,
): { segments: MepSegmentEntity[]; system: MepSystemEntity | null; skipped: number } {
  const segments: MepSegmentEntity[] = [];
  let skipped = 0;
  // The whole network runs flat at the boiler endpoint's elevation (Revit "Connect
  // To"): both endpoints of every run carry the source mm height, so the pipes sit
  // at the boiler tapping datum instead of the default ceiling centreline. No slope —
  // the loop is pressurised, not gravity (unlike drainage).
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
export function buildHeatingCommit(
  proposal: HeatingNetworkProposal,
  layerId: string,
  sceneUnits: SceneUnits,
  resolveName: ResolveHeatingSystemName,
): HeatingCommitPlan {
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

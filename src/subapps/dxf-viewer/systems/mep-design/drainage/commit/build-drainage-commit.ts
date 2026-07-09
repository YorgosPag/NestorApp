/**
 * ADR-427 Slice 2 / ADR-606 — Sanitary-drainage commit **builder** (pure).
 *
 * Thin binding over `createMepNetworkCommitBuilder` (ADR-606): each `ProposedDrainageSegment`
 * → a round **pipe** (`domain: 'pipe'`) carrying `{ classification, diameter, slopePercent }`,
 * and one `MepSystem` per network on the shared pipe-network params sourced from the
 * outfall (φρεάτιο). Unlike pressurised runs this is GRAVITY fall: each segment keeps its
 * per-endpoint `start/endElevationMm` so completion builds a real sloped run. Fittings are
 * inserted by the auto-reconciler once segments land — not here.
 *
 * @see ../../shared/create-mep-network-commit-builder.ts — the parametric single source
 */

import { buildDefaultPipeNetworkParams } from '../../../../bim/types/mep-system-types';
import {
  createMepNetworkCommitBuilder,
  type MepNetworkCommitPlan,
  type ResolveMepSystemName,
} from '../../shared/create-mep-network-commit-builder';
import type { ProposedDrainageNetwork } from '../drainage-design-types';

/** The concrete entities a drainage accept transaction will create. */
export type DrainageCommitPlan = MepNetworkCommitPlan;
/** Resolves a drainage system display name (i18n lives in the caller). */
export type ResolveDrainageSystemName = ResolveMepSystemName<ProposedDrainageNetwork>;

/** Build the full drainage commit plan for a reviewed proposal. Pure. */
export const buildDrainageCommit = createMepNetworkCommitBuilder<
  ProposedDrainageNetwork,
  ProposedDrainageNetwork['segments'][number]
>({
  domain: 'pipe',
  buildSegmentOverride: (seg) => ({
    classification: seg.classification,
    diameter: seg.diameterMm,
    slopePercent: seg.slopePercent,
  }),
  // Per-endpoint z is the SSoT: `start` runs lower (toward the φρεάτιο) and `end` higher,
  // so the pair is DISTINCT and completion keeps it as a real gravity run.
  resolveSegmentElevations: (seg) => ({
    startMm: seg.startElevationMm,
    endMm: seg.endElevationMm,
  }),
  buildSystemParams: (network, index, members, resolveName) =>
    buildDefaultPipeNetworkParams(
      resolveName(network, index),
      network.classification,
      network.outfallEntityId,
      network.outfallConnectorId,
      members,
    ),
});

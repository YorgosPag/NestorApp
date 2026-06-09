/**
 * ADR-426 — Parallel cold/hot pairing for the water-supply networks (pure, headless).
 *
 * Revit/MagiCAD/4M-FINE-grade twin-pipe routing: where the cold + hot spines naturally coincide
 * (a shared corridor, fixtures fed by both cold + hot), the hot run must NOT overlap the cold
 * one. Cold is the **reference** (stays put); hot runs as a constant lateral **offset** of its
 * OWN spine by `discipline.hotSpineOffsetMm` (Revit-grade parallel runs).
 *
 * Unlike heating (where supply & return share one root + one terminal set, so the return is
 * built FROM the supply geometry), cold & hot have DIFFERENT sources + DIFFERENT fixtures
 * (WC = cold only, washbasin = cold + hot). So the hot is routed INDEPENDENTLY (upstream) and
 * here merely offset onto its own spine — same geometric core, different inputs.
 *
 * FULL SSoT: a THIN wrapper over the discipline-agnostic core `../routing/offset-pairing.ts`
 * (Boy-Scout N.0.2 — the same core powers the heating supply/return pairing). This module only
 * supplies water types + the fixed offset distance, and maps the core's index-tagged runs back
 * to `ProposedSegment`s, copying cumulative LU + DN from the original hot run by index.
 *
 * Pure + deterministic.
 *
 * @see ../routing/offset-pairing.ts (the shared geometric core)
 * @see ../heating/pair-supply-return.ts (the heating wrapper over the same core)
 * @see ./design-water-supply.ts (the gate: cold = reference, hot = offset, no-walls only)
 */

import type { Point2D } from '../../../rendering/types/Types';
import { buildOffsetPairing } from '../routing/offset-pairing';
import type { Rect2D } from '../routing/routing-constants';
import type { FixtureDemand, ProposedNetwork, ProposedSegment } from './water-design-types';
import type { WaterSupplyDiscipline } from './water-supply-discipline';

/** A hot trunk/stub run carrying a copied cumulative LU + DN from its original counterpart. */
function hotTrunk(
  start: Point2D,
  end: Point2D,
  classification: ProposedSegment['classification'],
  cumulativeLU: number,
  diameterMm: number,
): ProposedSegment {
  return { start, end, service: 'hot', classification, diameterMm, cumulativeLU, role: 'trunk' };
}

/**
 * Build the offset (parallel) hot network from the already-routed `hot` network. Cold is left
 * untouched (it is the reference). Caller guarantees `hot` has ≥1 trunk segment. The hot is
 * offset onto its OWN spine (root = its own source), so where cold/hot coincide the offset
 * separates them, and where they already diverge nothing changes. With `obstacles` (Slice 3C)
 * the offset is wall-aware: any offset run landing on a wall is locally A\*-detoured by the core.
 */
export function buildOffsetHotNetwork(
  hot: ProposedNetwork,
  hotDemands: readonly FixtureDemand[],
  discipline: WaterSupplyDiscipline,
  obstacles: readonly Rect2D[] = [],
): ProposedNetwork {
  const trunks = hot.segments.filter((s) => s.role === 'trunk');
  const pairing = buildOffsetPairing(
    trunks,
    hot.sourcePoint,
    hot.sourcePoint, // offset onto its own spine: the root is the hot source itself.
    hotDemands.map((d) => d.point),
    discipline.hotSpineOffsetMm,
    { obstacles },
  );
  // Stub carries its arm's total (first trunk's LU); each offset trunk copies its counterpart.
  const trunkSegs: ProposedSegment[] = [
    ...pairing.stubs.map((s) =>
      hotTrunk(s.start, s.end, hot.classification, trunks[s.armFirstTrunkIndex].cumulativeLU, trunks[s.armFirstTrunkIndex].diameterMm),
    ),
    ...pairing.trunks.map((t) =>
      hotTrunk(t.start, t.end, hot.classification, trunks[t.sourceTrunkIndex].cumulativeLU, trunks[t.sourceTrunkIndex].diameterMm),
    ),
  ];
  const branches: ProposedSegment[] = pairing.branches.map((b) => {
    const d = hotDemands[b.targetIndex];
    return {
      start: b.start,
      end: b.end,
      service: 'hot',
      classification: hot.classification,
      diameterMm: discipline.sizingStandard.diameterForLU(d.loadingUnits),
      cumulativeLU: d.loadingUnits,
      role: 'branch',
    };
  });
  return {
    service: 'hot',
    classification: hot.classification,
    sourceEntityId: hot.sourceEntityId,
    sourceConnectorId: hot.sourceConnectorId,
    sourcePoint: hot.sourcePoint,
    sourceElevationMm: hot.sourceElevationMm,
    segments: [...trunkSegs, ...branches],
    servedTerminalIds: hot.servedTerminalIds,
    servedConnectors: hot.servedConnectors,
    totalLU: hot.totalLU,
  };
}

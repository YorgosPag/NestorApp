/**
 * ADR-606 — createMepNetworkCommitBuilder SSoT factory (pure).
 *
 * The 6 `build-<discipline>-commit.ts` builders (fire · water-supply · heating · gas ·
 * drainage · hvac) turned a reviewed MEP network proposal into the concrete
 * `MepSegmentEntity[]` + one `MepSystemEntity` per network, WITHOUT touching the scene,
 * command history, React, or Firestore (pure — the ribbon bridge wraps the output in
 * commands). Each repeated the SAME two-function body verbatim — a per-network
 * `buildNetworkEntities` (segment loop → skip-invalid → members = segment connectors +
 * servedConnectors → one system or null) and the outer `buildXCommit` (forEach network →
 * accumulate segments/systems/skipped) — differing ΜΟΝΟ σε:
 *
 *   1. the segment **domain** (`'pipe'` | `'duct'` | `'fuel'`);
 *   2. the per-segment **override** (`{classification,diameter}` vs `{sectionKind,diameter}`
 *      vs drainage's `{classification,diameter,slopePercent}`);
 *   3. the per-segment **elevations** (flat `network.sourceElevationMm` for pressurised/
 *      supply-air runs vs drainage's per-endpoint `seg.start/endElevationMm` gravity fall);
 *   4. the **system params** builder (`buildDefaultPipe/Duct/FuelNetworkParams`, which take
 *      different args — duct/fuel seed a palette colour, drainage sources the outfall).
 *
 * This factory is that single source; each discipline is now a ~30-line config binding
 * that keeps its exact public API (named builder + `*CommitPlan` / `Resolve*SystemName`
 * type aliases re-exported from its `index.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-606-mep-network-commit-builder-ssot.md
 * @see ../../../hooks/drawing/mep-segment-completion.ts (segment SSoT)
 * @see ../../../bim/mep-systems/mep-pipe-network-from-selection.ts (members SSoT)
 */

import { generateMepSystemId } from '@/services/enterprise-id-convenience';
import type { Point2D } from '../../../rendering/types/Types';
import type { SceneUnits } from '../../../utils/scene-units';
import {
  completeMepSegmentFromTwoClicks,
  type MepSegmentParamOverrides,
} from '../../../hooks/drawing/mep-segment-completion';
import type { MepSegmentDomain, MepSegmentEntity } from '../../../bim/types/mep-segment-types';
import type { MepSystemEntity, MepSystemMember } from '../../../bim/types/mep-system-types';
import { buildDefaultPipeNetworkParams } from '../../../bim/types/mep-system-types';
import { pipeSegmentMembers } from '../../../bim/mep-systems/mep-pipe-network-from-selection';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';

/** The concrete entities an accept transaction will create (shared across disciplines). */
export interface MepNetworkCommitPlan {
  /** All emitted segments, across every network (flattened). */
  readonly segmentEntities: readonly MepSegmentEntity[];
  /** One `MepSystem` per network that produced at least one valid segment. */
  readonly systemEntities: readonly MepSystemEntity[];
  /** Proposed segments that failed validation and were skipped. */
  readonly skippedSegments: number;
}

/** Resolves a system display name (i18n lives in the caller — keep the builder pure). */
export type ResolveMepSystemName<TNetwork> = (
  network: TNetwork,
  indexAmongNetworks: number,
) => string;

/** Minimal shape the factory reads off each proposed segment. */
interface MepCommitSegmentLike {
  readonly start: Point2D;
  readonly end: Point2D;
}

/** Minimal shape the factory reads off each proposed network. */
interface MepCommitNetworkLike<TSeg extends MepCommitSegmentLike> {
  readonly segments: readonly TSeg[];
  readonly servedConnectors: readonly MepSystemMember[];
}

/** The reviewed proposal: a bag of networks. */
export interface MepCommitProposalLike<TNetwork> {
  readonly networks: readonly TNetwork[];
}

export interface MepNetworkCommitBuilderConfig<
  TNetwork extends MepCommitNetworkLike<TSeg>,
  TSeg extends MepCommitSegmentLike,
> {
  /** Segment domain passed to `completeMepSegmentFromTwoClicks`. */
  readonly domain: MepSegmentDomain;
  /** Per-segment field overrides (classification / sectionKind / slope / diameter). */
  readonly buildSegmentOverride: (seg: TSeg) => MepSegmentParamOverrides;
  /** Per-segment endpoint elevations — flat network datum, or per-endpoint gravity fall. */
  readonly resolveSegmentElevations: (
    seg: TSeg,
    network: TNetwork,
  ) => { readonly startMm: number; readonly endMm: number };
  /** Build the `MepSystem` params for one network (discipline-specific default-params fn). */
  readonly buildSystemParams: (
    network: TNetwork,
    index: number,
    members: readonly MepSystemMember[],
    resolveName: ResolveMepSystemName<TNetwork>,
  ) => MepSystemEntity['params'];
}

/**
 * Build the pure "proposal → commit plan" function for one MEP discipline. The returned
 * builder is the parametric SSoT for all 6 `build-<discipline>-commit.ts` cells.
 */
export function createMepNetworkCommitBuilder<
  TNetwork extends MepCommitNetworkLike<TSeg>,
  TSeg extends MepCommitSegmentLike,
>(
  config: MepNetworkCommitBuilderConfig<TNetwork, TSeg>,
): (
  proposal: MepCommitProposalLike<TNetwork>,
  layerId: string,
  sceneUnits: SceneUnits,
  resolveName: ResolveMepSystemName<TNetwork>,
) => MepNetworkCommitPlan {
  const { domain, buildSegmentOverride, resolveSegmentElevations, buildSystemParams } = config;

  const buildNetworkEntities = (
    network: TNetwork,
    index: number,
    layerId: string,
    sceneUnits: SceneUnits,
    resolveName: ResolveMepSystemName<TNetwork>,
  ): { segments: MepSegmentEntity[]; system: MepSystemEntity | null; skipped: number } => {
    const segments: MepSegmentEntity[] = [];
    let skipped = 0;
    for (const seg of network.segments) {
      const { startMm, endMm } = resolveSegmentElevations(seg, network);
      const result = completeMepSegmentFromTwoClicks(
        seg.start,
        seg.end,
        layerId,
        domain,
        buildSegmentOverride(seg),
        sceneUnits,
        startMm,
        endMm,
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
      params: buildSystemParams(network, index, members, resolveName),
    };
    return { segments, system, skipped };
  };

  return function buildMepNetworkCommit(
    proposal: MepCommitProposalLike<TNetwork>,
    layerId: string,
    sceneUnits: SceneUnits,
    resolveName: ResolveMepSystemName<TNetwork>,
  ): MepNetworkCommitPlan {
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
  };
}

// ── Composable config presets ────────────────────────────────────────────────
// Shared so disciplines with identical variance don't ship twin configs (jscpd
// CHECK 3.28 / N.18). Each is a plain building block a `config` field references.

/** Flat network: both endpoints sit at the source outlet's elevation ("Connect To"). */
export const flatNetworkElevations = (
  _seg: unknown,
  network: { readonly sourceElevationMm: number },
): { readonly startMm: number; readonly endMm: number } => ({
  startMm: network.sourceElevationMm,
  endMm: network.sourceElevationMm,
});

/** Round-section override (duct/fuel): the classification lives on the system, not the run. */
export const roundDiameterOverride = (
  seg: { readonly diameterMm: number },
): MepSegmentParamOverrides => ({ sectionKind: 'round', diameter: seg.diameterMm });

/**
 * Full config preset for a flat **pressurised pipe** network (fire · water · heating): a
 * round pipe carrying `{ classification, diameter }`, flat at the source elevation, on the
 * shared pipe-network params sourced from the network's `source*` ids. The three disciplines
 * differ ΜΟΝΟ in their `TNetwork`/`TSeg` types — the runtime config is byte-identical, so it
 * lives here once.
 */
export function flatPressurisedPipeConfig<
  TNetwork extends MepCommitNetworkLike<TSeg> & {
    readonly sourceElevationMm: number;
    readonly sourceEntityId: string;
    readonly sourceConnectorId: string;
    readonly classification: PlumbingSystemClassification;
  },
  TSeg extends MepCommitSegmentLike & {
    readonly classification: PlumbingSystemClassification;
    readonly diameterMm: number;
  },
>(): MepNetworkCommitBuilderConfig<TNetwork, TSeg> {
  return {
    domain: 'pipe',
    buildSegmentOverride: (seg) => ({ classification: seg.classification, diameter: seg.diameterMm }),
    resolveSegmentElevations: flatNetworkElevations,
    buildSystemParams: (network, index, members, resolveName) =>
      buildDefaultPipeNetworkParams(
        resolveName(network, index),
        network.classification,
        network.sourceEntityId,
        network.sourceConnectorId,
        members,
      ),
  };
}

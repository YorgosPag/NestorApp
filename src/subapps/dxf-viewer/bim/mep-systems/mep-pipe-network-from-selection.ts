/**
 * Resolve a plumbing pipe-network draft from the current selection — ADR-408 Φ13
 * (SSoT, pure).
 *
 * The **explicit, Revit-style** counterpart of `mep-pipe-network-derive.ts`: where
 * the derive walk infers networks from raw pipe topology (and picks a lex-smallest
 * segment as the deterministic root), this resolver turns an **intentional**
 * selection — one plumbing **manifold** (the συλλέκτης = the distribution SOURCE,
 * exactly like a panel sources an electrical circuit) plus ≥1 **pipe segment**
 * (the members it feeds) — into the data a `CreateMepSystemCommand` needs. The
 * manifold is the `sourceEntityId`; its outlet connector is the source connector;
 * the pipes are the members. This mirrors `mep-circuit-from-selection.ts` 1:1,
 * narrowed to the pipe domain via the entity guards (no fork — the System backbone
 * is domain-agnostic).
 *
 * Member granularity matches the derive walk: each pipe segment contributes **both**
 * endpoint connectors (`seg-start` + `seg-end`) so the connector→systemId cache is
 * reconciled on both ends and colour-by-system tints the whole run. The manifold is
 * the source, **not** a member — so it is deliberately never tinted (members-only
 * `buildEntitySystemColorIndex`), exactly as the electrical panel is not tinted.
 *
 * Pure: no store / Firestore / React. Reuses the connector accessor + the
 * coordinator reassign SSoT (Revit single-system rule: a pipe already in another
 * network is *moved*, all in one undo via the caller's `CompoundCommand`).
 *
 * @see ./mep-circuit-from-selection.ts — the electrical (logical) counterpart
 * @see ./mep-pipe-network-derive.ts — the implicit (topology) counterpart
 * @see ./mep-system-coordinator.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ13
 */

import type { Entity } from '../../types/entities';
import { isMepSegmentEntity, isMepFixtureEntity } from '../../types/entities';
import type { MepSegmentEntity } from '../types/mep-segment-types';
import type { MepFixtureEntity } from '../types/mep-fixture-types';
import type { MepSystemEntity, MepSystemMember } from '../types/mep-system-types';
import {
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../types/mep-connector-types';
import type { PlumbingSystemClassification } from '../types/mep-connector-types';
import { isPipeNetworkSourceEntity, findPipeNetworkSourceConnectorId } from './pipe-network-source';
import {
  computeReassignRemovals,
  memberKey,
  type MepMemberRemoval,
} from './mep-system-coordinator';
import type { MepSystemParamsUpdate } from './mep-circuit-editor';

/** Why a selection could not form a pipe network (mapped to an i18n toast). */
export type PipeNetworkResolveError = 'no-source' | 'multiple-sources' | 'no-members';

/** The resolved ingredients of a new pipe network (mirror of `CircuitDraft`). */
export interface PipeNetworkFromSelectionDraft {
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  /**
   * Hydraulic classification the new network inherits from its source manifold
   * (Revit: a Piping System takes its System Type from the source equipment's
   * connector — ADR-408 Φ-heating). Drives the seeded `systemClassification` +
   * `classificationDefaultColor`. Falls back to `domestic-cold-water`.
   */
  readonly systemClassification: PlumbingSystemClassification;
  readonly members: readonly MepSystemMember[];
  /** Surviving networks that lose a reassigned member (Revit single-system rule). */
  readonly reassignRemovals: readonly MepMemberRemoval[];
}

export type PipeNetworkResolution =
  | { readonly ok: true; readonly draft: PipeNetworkFromSelectionDraft }
  | { readonly ok: false; readonly reason: PipeNetworkResolveError };

/** Both endpoint connectors of a pipe segment — its full membership in a network. */
export function pipeSegmentMembers(segment: MepSegmentEntity): MepSystemMember[] {
  return [
    { entityId: segment.id, connectorId: SEGMENT_START_CONNECTOR_ID },
    { entityId: segment.id, connectorId: SEGMENT_END_CONNECTOR_ID },
  ];
}

/**
 * The fixture connectors that belong to a network of the given hydraulic
 * classification (Revit: a Plumbing Fixture's Cold connector is on the Cold system,
 * its Hot on the Hot system, its Drain on the Sanitary system — membership is
 * per-(entity, connector)). A sanitary terminal therefore joins a water-supply
 * network through its matching cold/hot inlet only. Empty when the fixture has no
 * connector of that classification.
 */
export function fixtureMembersForClassification(
  fixture: MepFixtureEntity,
  classification: PlumbingSystemClassification,
): MepSystemMember[] {
  return (fixture.params.connectors ?? [])
    .filter((c) => c.domain === 'pipe' && c.pipe?.systemClassification === classification)
    .map((c) => ({ entityId: fixture.id, connectorId: c.connectorId }));
}

/** Selected segments that carry water (pipe domain) — duct segments are ignored. */
function selectedPipeSegments(selected: readonly Entity[]): MepSegmentEntity[] {
  return selected.filter(isMepSegmentEntity).filter((s) => s.params.domain === 'pipe');
}

/**
 * Resolve a pipe network from the selected entities. Requires **exactly one**
 * pipe-network source — a manifold (συλλέκτης) OR a boiler (λέβητας), via the SSoT
 * `isPipeNetworkSourceEntity` guard — and **≥1 pipe segment** (members). Returns the
 * draft, or a typed error. Mirror of `resolveCircuitFromSelection`.
 */
export function resolvePipeNetworkFromSelection(
  selected: readonly Entity[],
  existingSystems: readonly MepSystemEntity[],
): PipeNetworkResolution {
  const sources = selected.filter(isPipeNetworkSourceEntity);
  if (sources.length === 0) return { ok: false, reason: 'no-source' };
  if (sources.length > 1) return { ok: false, reason: 'multiple-sources' };

  const source = sources[0]!;
  // Inherit the source's hydraulic classification (ύδρευση/θέρμανση); a boiler
  // defaults to hydronic-supply, a pre-heating manifold carries none ⇒
  // domestic-cold-water (back-compat).
  const systemClassification: PlumbingSystemClassification =
    source.params.systemClassification ?? 'domestic-cold-water';

  // Members = both endpoints of each selected pipe + the matching water connector of
  // each selected sanitary fixture (Revit Plumbing Fixture joins the supply network
  // through its cold/hot inlet of the network's classification).
  const members: MepSystemMember[] = [
    ...selectedPipeSegments(selected).flatMap(pipeSegmentMembers),
    ...selected
      .filter(isMepFixtureEntity)
      .flatMap((f) => fixtureMembersForClassification(f, systemClassification)),
  ];
  if (members.length === 0) return { ok: false, reason: 'no-members' };

  return {
    ok: true,
    draft: {
      sourceEntityId: source.id,
      sourceConnectorId: findPipeNetworkSourceConnectorId(source),
      systemClassification,
      members,
      reassignRemovals: computeReassignRemovals(members, existingSystems),
    },
  };
}

/**
 * Plan adding the given pipe segments to `activeNetwork` (Φ13 management — mirror
 * of `buildAddMembersUpdate`, but a segment contributes **two** endpoint members).
 * New members are the selected pipes whose endpoints are not already in the network;
 * pipes moved from another network produce reassign-removals there (Revit single
 * system). Returns `null` when nothing new would be added (idempotent).
 *
 * Removal reuses the domain-agnostic `buildRemoveMembersUpdate` (it filters by host
 * entity id, so it already drops both endpoints of a removed pipe).
 */
export function buildAddPipeMembersUpdate(
  activeNetwork: MepSystemEntity,
  segmentsToAdd: readonly Entity[],
  allSystems: readonly MepSystemEntity[],
): { readonly update: MepSystemParamsUpdate; readonly reassignRemovals: readonly MepMemberRemoval[]; readonly addedCount: number } | null {
  const existing = new Set(
    activeNetwork.params.members.map((m) => memberKey(m.entityId, m.connectorId)),
  );
  const newMembers: MepSystemMember[] = [];
  for (const segment of segmentsToAdd) {
    if (!isMepSegmentEntity(segment) || segment.params.domain !== 'pipe') continue;
    for (const member of pipeSegmentMembers(segment)) {
      if (existing.has(memberKey(member.entityId, member.connectorId))) continue;
      existing.add(memberKey(member.entityId, member.connectorId));
      newMembers.push(member);
    }
  }
  if (newMembers.length === 0) return null;

  const nextParams = {
    ...activeNetwork.params,
    members: [...activeNetwork.params.members, ...newMembers],
  };
  const reassignRemovals = computeReassignRemovals(newMembers, allSystems).filter(
    (r) => r.systemId !== activeNetwork.id,
  );
  // addedCount counts segments (host entities), not endpoint connectors.
  const addedHostIds = new Set(newMembers.map((m) => m.entityId));
  return {
    update: { systemId: activeNetwork.id, prevParams: activeNetwork.params, nextParams },
    reassignRemovals,
    addedCount: addedHostIds.size,
  };
}

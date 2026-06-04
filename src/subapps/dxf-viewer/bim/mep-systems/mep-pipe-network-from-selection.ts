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
import { isMepManifoldEntity, isMepSegmentEntity } from '../../types/entities';
import type { MepSegmentEntity } from '../types/mep-segment-types';
import type { MepManifoldEntity } from '../types/mep-manifold-types';
import type { MepSystemEntity, MepSystemMember } from '../types/mep-system-types';
import {
  MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX,
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../types/mep-connector-types';
import { getEntityConnectors } from './connector-access';
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
  readonly members: readonly MepSystemMember[];
  /** Surviving networks that lose a reassigned member (Revit single-system rule). */
  readonly reassignRemovals: readonly MepMemberRemoval[];
}

export type PipeNetworkResolution =
  | { readonly ok: true; readonly draft: PipeNetworkFromSelectionDraft }
  | { readonly ok: false; readonly reason: PipeNetworkResolveError };

/** The canonical first outlet id of a manifold (`m-out-0`) — the default source. */
const DEFAULT_MANIFOLD_OUTLET_CONNECTOR_ID = `${MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX}0`;

/**
 * The manifold's source connector id: its first outgoing (`flow:'out'`) connector,
 * else any connector, else the canonical first-outlet id. A manifold placed before
 * the connector seed (or via a path that did not seed connectors) carries none — it
 * is still a valid distribution source, so we fall back rather than refuse.
 */
function findManifoldSourceConnectorId(manifold: MepManifoldEntity): string {
  const conns = getEntityConnectors(manifold);
  return (
    conns.find((c) => c.flow === 'out')?.connectorId
    ?? conns[0]?.connectorId
    ?? DEFAULT_MANIFOLD_OUTLET_CONNECTOR_ID
  );
}

/** Both endpoint connectors of a pipe segment — its full membership in a network. */
export function pipeSegmentMembers(segment: MepSegmentEntity): MepSystemMember[] {
  return [
    { entityId: segment.id, connectorId: SEGMENT_START_CONNECTOR_ID },
    { entityId: segment.id, connectorId: SEGMENT_END_CONNECTOR_ID },
  ];
}

/** Selected segments that carry water (pipe domain) — duct segments are ignored. */
function selectedPipeSegments(selected: readonly Entity[]): MepSegmentEntity[] {
  return selected.filter(isMepSegmentEntity).filter((s) => s.params.domain === 'pipe');
}

/**
 * Resolve a pipe network from the selected entities. Requires **exactly one**
 * manifold (the source) and **≥1 pipe segment** (members). Returns the draft, or a
 * typed error. Mirror of `resolveCircuitFromSelection`.
 */
export function resolvePipeNetworkFromSelection(
  selected: readonly Entity[],
  existingSystems: readonly MepSystemEntity[],
): PipeNetworkResolution {
  const manifolds = selected.filter(isMepManifoldEntity);
  if (manifolds.length === 0) return { ok: false, reason: 'no-source' };
  if (manifolds.length > 1) return { ok: false, reason: 'multiple-sources' };

  const members: MepSystemMember[] = selectedPipeSegments(selected).flatMap(pipeSegmentMembers);
  if (members.length === 0) return { ok: false, reason: 'no-members' };

  return {
    ok: true,
    draft: {
      sourceEntityId: manifolds[0]!.id,
      sourceConnectorId: findManifoldSourceConnectorId(manifolds[0]!),
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

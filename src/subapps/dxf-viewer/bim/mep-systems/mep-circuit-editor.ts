/**
 * MEP circuit management — pure SSoT for the Φ6 contextual editing UI.
 *
 * Turns the current selection into the *candidate circuits* the management panel
 * can edit, and turns add/remove-member intents into the param patches the
 * (undoable) `UpdateMepSystemParamsCommand` consumes. Pure — no store / React /
 * Firestore — so the ribbon bridge + widgets stay thin and this is unit-tested
 * in isolation. Reuses the coordinator reverse-lookups + reassign SSoT and the
 * fixture connector resolver (no duplicate membership logic).
 *
 * Revit model: a fixture (device) belongs to exactly one circuit; a panel
 * (equipment) can source several. So selecting a fixture yields its one circuit,
 * selecting a panel yields all the circuits it feeds (the picker disambiguates).
 *
 * @see ./mep-system-coordinator.ts
 * @see ./mep-circuit-from-selection.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Entity } from '../../types/entities';
import { isMepFixtureEntity } from '../../types/entities';
import type {
  MepSystemEntity,
  MepSystemMember,
  MepSystemParams,
} from '../types/mep-system-types';
import {
  computeReassignRemovals,
  findSystemMembershipsByEntity,
  findSystemsBySource,
  memberKey,
  type MepMemberRemoval,
} from './mep-system-coordinator';
import { findMemberConnectorId } from './mep-circuit-from-selection';

/** A `params` patch for one system: the inverse pair an undoable update needs. */
export interface MepSystemParamsUpdate {
  readonly systemId: string;
  readonly prevParams: MepSystemParams;
  readonly nextParams: MepSystemParams;
}

/** The patches to add members to a circuit: the union update + Revit reassigns. */
export interface AddMembersPlan {
  /** The active circuit gaining the members (union of old + new). */
  readonly update: MepSystemParamsUpdate;
  /** Other circuits that lose a moved member (single-circuit rule). */
  readonly reassignRemovals: readonly MepMemberRemoval[];
  /** How many members were actually new (for the toast). */
  readonly addedCount: number;
}

/** The patch to remove members from a circuit. */
export interface RemoveMembersPlan {
  readonly update: MepSystemParamsUpdate;
  /** How many members were actually removed (for the toast). */
  readonly removedCount: number;
}

/**
 * The MEP systems a selection can manage: every system a selected entity belongs
 * to (member-of) plus every system a selected entity is the source of (source-of),
 * deduped in first-seen order. Empty when the selection touches no system.
 *
 * **Entity-type-agnostic (ADR-408 Φ13).** Membership is resolved by entity id, not
 * kind, so the SAME resolver serves the electrical circuit (panel = source, fixture
 * = member) and the plumbing pipe network (manifold = source, pipe segment = member)
 * — the System backbone is domain-agnostic, so there is no reason to fork. The two
 * passes (all member-of, then all source-of) are deliberately NOT interleaved: this
 * preserves the original electrical ordering — a selected device's system ranks
 * before a selected equipment's sourced systems.
 */
export function resolveManagedSystems(
  selected: readonly Entity[],
  systems: readonly MepSystemEntity[],
): MepSystemEntity[] {
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  const push = (sid: string): void => {
    if (seen.has(sid)) return;
    seen.add(sid);
    orderedIds.push(sid);
  };

  // Pass 1 — systems each selected entity is a MEMBER of (device/segment → system).
  for (const e of selected) {
    for (const m of findSystemMembershipsByEntity(e.id, systems)) push(m.systemId);
  }
  // Pass 2 — systems each selected entity is the SOURCE of (equipment → its systems).
  for (const sid of findSystemsBySource(new Set(selected.map((e) => e.id)), systems)) push(sid);

  const byId = new Map(systems.map((s) => [s.id, s]));
  return orderedIds.map((id) => byId.get(id)).filter((s): s is MepSystemEntity => !!s);
}

/**
 * Plan adding the given fixtures to `activeSystem`. New members are the selected
 * fixtures not already in the circuit (mapped to their power connector); members
 * moved from another circuit produce reassign-removals there (Revit single
 * circuit). Returns `null` when nothing new would be added.
 */
export function buildAddMembersUpdate(
  activeSystem: MepSystemEntity,
  fixturesToAdd: readonly Entity[],
  allSystems: readonly MepSystemEntity[],
): AddMembersPlan | null {
  const existing = new Set(
    activeSystem.params.members.map((m) => memberKey(m.entityId, m.connectorId)),
  );
  const newMembers: MepSystemMember[] = [];
  for (const fixture of fixturesToAdd) {
    if (!isMepFixtureEntity(fixture)) continue;
    const member = { entityId: fixture.id, connectorId: findMemberConnectorId(fixture) };
    if (existing.has(memberKey(member.entityId, member.connectorId))) continue;
    existing.add(memberKey(member.entityId, member.connectorId));
    newMembers.push(member);
  }
  if (newMembers.length === 0) return null;

  const nextParams: MepSystemParams = {
    ...activeSystem.params,
    members: [...activeSystem.params.members, ...newMembers],
  };
  const reassignRemovals = computeReassignRemovals(newMembers, allSystems).filter(
    (r) => r.systemId !== activeSystem.id,
  );
  return {
    update: { systemId: activeSystem.id, prevParams: activeSystem.params, nextParams },
    reassignRemovals,
    addedCount: newMembers.length,
  };
}

/**
 * Plan removing every member of `activeSystem` whose host entity id is in
 * `entityIdsToRemove`. Returns `null` when the circuit keeps all its members
 * (idempotent — no undo pollution).
 */
export function buildRemoveMembersUpdate(
  activeSystem: MepSystemEntity,
  entityIdsToRemove: ReadonlySet<string>,
): RemoveMembersPlan | null {
  const nextMembers = activeSystem.params.members.filter(
    (m) => !entityIdsToRemove.has(m.entityId),
  );
  const removedCount = activeSystem.params.members.length - nextMembers.length;
  if (removedCount === 0) return null;

  return {
    update: {
      systemId: activeSystem.id,
      prevParams: activeSystem.params,
      nextParams: { ...activeSystem.params, members: nextMembers },
    },
    removedCount,
  };
}

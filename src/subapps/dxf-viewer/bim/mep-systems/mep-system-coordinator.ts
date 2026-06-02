/**
 * MEP System ↔ Connector Coordinator — ADR-408 Φ2.
 *
 * The **System owns membership truth** (`MepSystemParams.members`); each member
 * connector's `MepConnector.systemId` is a derived cache. This module is the
 * single place that reconciles that cache (System→connector, **System wins**)
 * and runs the integrity reverse-lookups the delete/cascade logic (Φ4) and the
 * member-missing warning consume. Pure detection + a thin EventBus signal —
 * mirror of `wall-structural-attach-coordinator.ts` (pattern C).
 *
 * No scene mutation here: stale `systemId` is harmless (truth is the System),
 * exactly like a dangling `wall.params.attachTopToIds` ref.
 *
 * @see ../types/mep-system-types.ts
 * @see ../walls/wall-structural-attach-coordinator.ts — pattern template
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { MepConnector } from '../types/mep-connector-types';
import type { MepSystemEntity, MepSystemMember, MepSystemParams } from '../types/mep-system-types';
import { EventBus } from '../../systems/events/EventBus';

const KEY_SEP = '::';

/** Stable key for a connection point (the System member granularity). */
export function memberKey(entityId: string, connectorId: string): string {
  return `${entityId}${KEY_SEP}${connectorId}`;
}

/**
 * Build the `(entityId, connectorId) → systemId` index from the live systems.
 * A connector belongs to at most one electrical system (Revit rule); if two
 * systems claim the same connector the last one wins (the single-circuit guard
 * lives in the assignment UI, Φ5).
 */
export function buildConnectorSystemIndex(
  systems: readonly MepSystemEntity[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const system of systems) {
    for (const m of system.params.members) {
      index.set(memberKey(m.entityId, m.connectorId), system.id);
    }
  }
  return index;
}

/**
 * For every member already wired to an existing system, produce the removal that
 * drops it from that system's `members[]` (so each fixture lives in exactly one
 * circuit — the Revit single-circuit rule). One removal per affected system,
 * even if it loses several members at once. SSoT for "move these members out of
 * whatever circuits currently own them" — consumed by both circuit creation
 * (`mep-circuit-from-selection.ts`) and the Φ6 add-member edit
 * (`mep-circuit-editor.ts`). Pure; returns `[]` when nothing is reassigned.
 */
export function computeReassignRemovals(
  members: readonly MepSystemMember[],
  existingSystems: readonly MepSystemEntity[],
): MepMemberRemoval[] {
  const index = buildConnectorSystemIndex(existingSystems);
  const claimed = new Set(members.map((m) => memberKey(m.entityId, m.connectorId)));
  const affectedSystemIds = new Set<string>();
  for (const m of members) {
    const owner = index.get(memberKey(m.entityId, m.connectorId));
    if (owner) affectedSystemIds.add(owner);
  }

  const removals: MepMemberRemoval[] = [];
  for (const system of existingSystems) {
    if (!affectedSystemIds.has(system.id)) continue;
    const nextMembers = system.params.members.filter(
      (m) => !claimed.has(memberKey(m.entityId, m.connectorId)),
    );
    if (nextMembers.length === system.params.members.length) continue;
    removals.push({
      systemId: system.id,
      prevParams: system.params,
      nextParams: { ...system.params, members: nextMembers },
    });
  }
  return removals;
}

/**
 * Reconcile one host's connectors against the system index: set `systemId` for
 * members, clear it for non-members. Pure — returns a new array only when at
 * least one connector's cache changed (referential-stable otherwise, so callers
 * can skip a no-op scene write).
 */
export function reconcileEntityConnectors(
  entityId: string,
  connectors: readonly MepConnector[],
  index: ReadonlyMap<string, string>,
): readonly MepConnector[] {
  let changed = false;
  const next = connectors.map((c) => {
    const desired = index.get(memberKey(entityId, c.connectorId));
    if (desired === c.systemId) return c;
    changed = true;
    if (desired === undefined) {
      const { systemId: _drop, ...rest } = c;
      return rest;
    }
    return { ...c, systemId: desired };
  });
  return changed ? next : connectors;
}

// ─── Integrity reverse-lookups (pure) ─────────────────────────────────────────

/** System ids whose source (base equipment) is one of the given entity ids. */
export function findSystemsBySource(
  sourceEntityIds: ReadonlySet<string>,
  systems: readonly MepSystemEntity[],
): string[] {
  const out: string[] = [];
  for (const s of systems) {
    if (sourceEntityIds.has(s.params.sourceEntityId)) out.push(s.id);
  }
  return out;
}

/** Every `(systemId, connectorId)` membership that references a given entity. */
export function findSystemMembershipsByEntity(
  entityId: string,
  systems: readonly MepSystemEntity[],
): Array<{ readonly systemId: string; readonly connectorId: string }> {
  const out: Array<{ systemId: string; connectorId: string }> = [];
  for (const s of systems) {
    for (const m of s.params.members) {
      if (m.entityId === entityId) out.push({ systemId: s.id, connectorId: m.connectorId });
    }
  }
  return out;
}

/** A member (or source) reference pointing at an entity not present in the scene. */
export interface MissingSystemMember {
  readonly systemId: string;
  readonly entityId: string;
  readonly connectorId: string;
}

/**
 * Detect dangling member/source references — members (or the source) whose host
 * entity is absent from `presentEntityIds`. Pure; the resolver tolerates these
 * (truth is the System), but surfacing them lets the UI flag a broken circuit.
 */
export function detectMissingSystemMembers(
  systems: readonly MepSystemEntity[],
  presentEntityIds: ReadonlySet<string>,
): MissingSystemMember[] {
  const out: MissingSystemMember[] = [];
  for (const s of systems) {
    if (!presentEntityIds.has(s.params.sourceEntityId)) {
      out.push({ systemId: s.id, entityId: s.params.sourceEntityId, connectorId: s.params.sourceConnectorId });
    }
    for (const m of s.params.members) {
      if (!presentEntityIds.has(m.entityId)) {
        out.push({ systemId: s.id, entityId: m.entityId, connectorId: m.connectorId });
      }
    }
  }
  return out;
}

/**
 * Emit a decoupled `bim:mep-system-member-missing` event for each dangling
 * reference (no-op when none). Pure detection + signal — does not mutate the
 * scene or the System. Returns the missing references (for callers / tests).
 */
export function notifyMissingSystemMembers(
  systems: readonly MepSystemEntity[],
  presentEntityIds: ReadonlySet<string>,
): MissingSystemMember[] {
  const missing = detectMissingSystemMembers(systems, presentEntityIds);
  for (const m of missing) {
    EventBus.emit('bim:mep-system-member-missing', m);
  }
  return missing;
}

// ─── Φ4 cascade planning (pure) ───────────────────────────────────────────────

/** One surviving system that loses a deleted member from `params.members`. */
export interface MepMemberRemoval {
  readonly systemId: string;
  readonly prevParams: MepSystemParams;
  readonly nextParams: MepSystemParams;
}

/**
 * The integrity plan produced when one or more entities are deleted:
 *   - `dissolve` — systems whose **source** (base equipment) was deleted: the
 *     whole circuit is gone (Revit "deleting the panel deletes its circuits").
 *   - `memberRemovals` — surviving systems that simply lose a deleted member
 *     from `params.members` (the circuit stays, minus that connection).
 * Pure data — the caller turns it into undoable commands (Φ4 `useSmartDelete`).
 */
export interface MepCascadePlan {
  readonly dissolve: readonly MepSystemEntity[];
  readonly memberRemovals: readonly MepMemberRemoval[];
}

/**
 * Compute the cascade plan for a set of deleted entity ids. Pure (no store /
 * Firestore / EventBus side effect) — the single SSoT for "what happens to the
 * systems when these entities vanish". Reuses `findSystemsBySource`.
 *
 * A system whose source is deleted is **dissolved**, and is therefore excluded
 * from `memberRemovals` (no point editing a doc we are about to delete — even
 * if the deleted entity was also one of its members).
 */
export function resolveMepCascadeOnDelete(
  deletedEntityIds: ReadonlySet<string>,
  systems: readonly MepSystemEntity[],
): MepCascadePlan {
  const dissolveIds = new Set(findSystemsBySource(deletedEntityIds, systems));
  const dissolve = systems.filter((s) => dissolveIds.has(s.id));

  const memberRemovals: MepMemberRemoval[] = [];
  for (const s of systems) {
    if (dissolveIds.has(s.id)) continue;
    const nextMembers = s.params.members.filter((m) => !deletedEntityIds.has(m.entityId));
    if (nextMembers.length === s.params.members.length) continue;
    memberRemovals.push({
      systemId: s.id,
      prevParams: s.params,
      nextParams: { ...s.params, members: nextMembers },
    });
  }

  return { dissolve, memberRemovals };
}

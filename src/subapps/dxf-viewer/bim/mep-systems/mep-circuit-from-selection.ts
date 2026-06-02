/**
 * Resolve a circuit draft from the current selection — ADR-408 Φ5 (SSoT, pure).
 *
 * Turns a mixed selection (one electrical panel = the source + ≥1 light fixture
 * = members) into the data a `CreateMepSystemCommand` needs, plus the
 * **reassign removals** that honour the Revit single-circuit rule: a fixture
 * already wired to another circuit is *moved* — removed from its old system's
 * `members[]` and added to the new one, all in one undo (the caller bundles
 * these into a `CompoundCommand`).
 *
 * Pure: no store / Firestore / React. Keeps the ribbon bridge thin and lets the
 * resolution be unit-tested in isolation. Reuses the connector accessor and the
 * coordinator reverse-lookups (no duplicate membership logic).
 *
 * @see ./mep-system-coordinator.ts
 * @see ./connector-access.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Entity } from '../../types/entities';
import { isElectricalPanelEntity, isMepFixtureEntity } from '../../types/entities';
import type { MepSystemEntity, MepSystemMember } from '../types/mep-system-types';
import { getEntityConnectors } from './connector-access';
import {
  buildConnectorSystemIndex,
  memberKey,
  type MepMemberRemoval,
} from './mep-system-coordinator';

/** Why a selection could not form a circuit (mapped to an i18n toast by the UI). */
export type CircuitResolveError = 'no-source' | 'multiple-sources' | 'no-members';

/** The resolved ingredients of a new circuit. */
export interface CircuitDraft {
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  readonly members: readonly MepSystemMember[];
  /** Surviving systems that lose a reassigned member (Revit single-circuit rule). */
  readonly reassignRemovals: readonly MepMemberRemoval[];
}

export type CircuitResolution =
  | { readonly ok: true; readonly draft: CircuitDraft }
  | { readonly ok: false; readonly reason: CircuitResolveError };

/** First outgoing (`flow:'out'`) connector on a panel — the circuit source. */
function findSourceConnectorId(panel: Entity): string | null {
  const out = getEntityConnectors(panel).find((c) => c.flow === 'out');
  return out?.connectorId ?? null;
}

/** First incoming (`flow:'in'`) connector on a fixture — the circuit member. */
function findMemberConnectorId(fixture: Entity): string | null {
  const inbound = getEntityConnectors(fixture).find((c) => c.flow === 'in');
  return inbound?.connectorId ?? null;
}

/**
 * Resolve a circuit from the selected entities. Requires **exactly one** panel
 * (the source) and **≥1 fixture** (members). Returns the draft, or a typed error.
 */
export function resolveCircuitFromSelection(
  selected: readonly Entity[],
  existingSystems: readonly MepSystemEntity[],
): CircuitResolution {
  const panels = selected.filter(isElectricalPanelEntity);
  if (panels.length === 0) return { ok: false, reason: 'no-source' };
  if (panels.length > 1) return { ok: false, reason: 'multiple-sources' };

  const sourceConnectorId = findSourceConnectorId(panels[0]!);
  if (!sourceConnectorId) return { ok: false, reason: 'no-source' };

  const members: MepSystemMember[] = [];
  for (const fixture of selected.filter(isMepFixtureEntity)) {
    const connectorId = findMemberConnectorId(fixture);
    if (connectorId) members.push({ entityId: fixture.id, connectorId });
  }
  if (members.length === 0) return { ok: false, reason: 'no-members' };

  return {
    ok: true,
    draft: {
      sourceEntityId: panels[0]!.id,
      sourceConnectorId,
      members,
      reassignRemovals: computeReassignRemovals(members, existingSystems),
    },
  };
}

/**
 * For every member already wired to an existing system, produce the removal that
 * drops it from that system's `members[]` (so it lives in exactly one circuit).
 * One removal per affected system, even if it loses several members at once.
 */
function computeReassignRemovals(
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

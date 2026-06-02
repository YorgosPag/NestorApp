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
import {
  FIXTURE_POWER_CONNECTOR_ID,
  PANEL_OUT_CONNECTOR_ID,
} from '../types/mep-connector-types';
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

/**
 * The panel's source connector id: the outgoing (`flow:'out'`) connector, else
 * any connector, else the canonical `PANEL_OUT_CONNECTOR_ID`. A panel placed
 * before the Φ1 connector retrofit (or via a path that did not seed the default
 * connector) carries no embedded connector — it is still a valid power source,
 * so we fall back to the canonical id rather than refuse the circuit.
 */
function findSourceConnectorId(panel: Entity): string {
  const conns = getEntityConnectors(panel);
  return (
    conns.find((c) => c.flow === 'out')?.connectorId
    ?? conns[0]?.connectorId
    ?? PANEL_OUT_CONNECTOR_ID
  );
}

/**
 * The fixture's member connector id: the incoming (`flow:'in'`) connector, else
 * any electrical connector, else the canonical `FIXTURE_POWER_CONNECTOR_ID`. A
 * light fixture is always a connectable load (Revit), so a legacy fixture with
 * no embedded connector still joins the circuit via the canonical fallback.
 */
function findMemberConnectorId(fixture: Entity): string {
  const conns = getEntityConnectors(fixture);
  return (
    conns.find((c) => c.flow === 'in')?.connectorId
    ?? conns.find((c) => c.domain === 'electrical')?.connectorId
    ?? FIXTURE_POWER_CONNECTOR_ID
  );
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

  const members: MepSystemMember[] = selected
    .filter(isMepFixtureEntity)
    .map((fixture) => ({ entityId: fixture.id, connectorId: findMemberConnectorId(fixture) }));
  if (members.length === 0) return { ok: false, reason: 'no-members' };

  return {
    ok: true,
    draft: {
      sourceEntityId: panels[0]!.id,
      sourceConnectorId: findSourceConnectorId(panels[0]!),
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

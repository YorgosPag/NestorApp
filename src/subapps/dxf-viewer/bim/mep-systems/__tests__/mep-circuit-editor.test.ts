/**
 * ADR-408 Φ6 — mep-circuit-editor (pure SSoT) tests.
 */

import {
  resolveManagedSystems,
  buildAddMembersUpdate,
  buildRemoveMembersUpdate,
} from '../mep-circuit-editor';
import type { Entity } from '../../../types/entities';
import type { MepSystemEntity, MepSystemParams } from '../../types/mep-system-types';

function panel(id: string): Entity {
  return {
    type: 'electrical-panel',
    id,
    params: { connectors: [{ connectorId: 'out1', domain: 'electrical', flow: 'out', localPosition: { x: 0, y: 0 } }] },
  } as unknown as Entity;
}

function fixture(id: string): Entity {
  return {
    type: 'mep-fixture',
    id,
    params: { connectors: [{ connectorId: 'c1', domain: 'electrical', flow: 'in', localPosition: { x: 0, y: 0 } }] },
  } as unknown as Entity;
}

function sys(id: string, members: Array<[string, string]>, source = 'pnlX'): MepSystemEntity {
  const params: MepSystemParams = {
    systemType: 'electrical-circuit',
    name: id,
    systemClassification: 'lighting',
    sourceEntityId: source,
    sourceConnectorId: 'out1',
    members: members.map(([entityId, connectorId]) => ({ entityId, connectorId })),
  };
  return { id, params };
}

describe('resolveManagedSystems', () => {
  it('returns the circuit a selected fixture belongs to', () => {
    const systems = [sys('A', [['fx1', 'c1']]), sys('B', [['fx2', 'c1']])];
    const out = resolveManagedSystems([fixture('fx1')], systems);
    expect(out.map((s) => s.id)).toEqual(['A']);
  });

  it('returns every circuit a selected panel feeds (source-of)', () => {
    const systems = [
      sys('A', [['fx1', 'c1']], 'pnl1'),
      sys('B', [['fx2', 'c1']], 'pnl1'),
      sys('C', [['fx3', 'c1']], 'pnlOther'),
    ];
    const out = resolveManagedSystems([panel('pnl1')], systems);
    expect(out.map((s) => s.id)).toEqual(['A', 'B']);
  });

  it('dedupes when a selection touches the same circuit twice', () => {
    const systems = [sys('A', [['fx1', 'c1'], ['fx2', 'c1']], 'pnl1')];
    const out = resolveManagedSystems([fixture('fx1'), fixture('fx2')], systems);
    expect(out.map((s) => s.id)).toEqual(['A']);
  });

  it('returns empty when the selection touches no circuit', () => {
    const systems = [sys('A', [['fx1', 'c1']], 'pnl1')];
    expect(resolveManagedSystems([fixture('fxNope')], systems)).toEqual([]);
  });
});

describe('buildAddMembersUpdate', () => {
  it('adds new fixtures to the active circuit (union)', () => {
    const active = sys('A', [['fx1', 'c1']], 'pnl1');
    const plan = buildAddMembersUpdate(active, [fixture('fx2')], [active]);
    expect(plan).not.toBeNull();
    expect(plan!.addedCount).toBe(1);
    expect(plan!.update.systemId).toBe('A');
    expect(plan!.update.nextParams.members).toEqual([
      { entityId: 'fx1', connectorId: 'c1' },
      { entityId: 'fx2', connectorId: 'c1' },
    ]);
    expect(plan!.reassignRemovals).toEqual([]);
  });

  it('returns null when every selected fixture is already a member', () => {
    const active = sys('A', [['fx1', 'c1']], 'pnl1');
    expect(buildAddMembersUpdate(active, [fixture('fx1')], [active])).toBeNull();
  });

  it('moves a fixture wired elsewhere (reassign removal from the old circuit)', () => {
    const active = sys('A', [], 'pnl1');
    const other = sys('B', [['fx1', 'c1'], ['fx9', 'c1']], 'pnl2');
    const plan = buildAddMembersUpdate(active, [fixture('fx1')], [active, other]);
    expect(plan).not.toBeNull();
    expect(plan!.update.nextParams.members).toEqual([{ entityId: 'fx1', connectorId: 'c1' }]);
    expect(plan!.reassignRemovals).toHaveLength(1);
    expect(plan!.reassignRemovals[0]!.systemId).toBe('B');
    expect(plan!.reassignRemovals[0]!.nextParams.members).toEqual([{ entityId: 'fx9', connectorId: 'c1' }]);
  });

  it('ignores non-fixture entities in the add selection', () => {
    const active = sys('A', [], 'pnl1');
    expect(buildAddMembersUpdate(active, [panel('pnl1')], [active])).toBeNull();
  });
});

describe('buildRemoveMembersUpdate', () => {
  it('removes the selected member fixtures', () => {
    const active = sys('A', [['fx1', 'c1'], ['fx2', 'c1']], 'pnl1');
    const plan = buildRemoveMembersUpdate(active, new Set(['fx1']));
    expect(plan).not.toBeNull();
    expect(plan!.removedCount).toBe(1);
    expect(plan!.update.nextParams.members).toEqual([{ entityId: 'fx2', connectorId: 'c1' }]);
  });

  it('returns null when nothing matches (idempotent)', () => {
    const active = sys('A', [['fx1', 'c1']], 'pnl1');
    expect(buildRemoveMembersUpdate(active, new Set(['fxNope']))).toBeNull();
  });
});

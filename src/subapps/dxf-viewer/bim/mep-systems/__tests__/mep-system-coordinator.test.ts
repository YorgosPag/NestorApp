/**
 * ADR-408 Φ2 — MEP system coordinator tests.
 *
 * Covers the backbone invariants: System→connector cache reconciliation
 * (System wins), source/membership reverse-lookups, and dangling-reference
 * detection + EventBus signal.
 */

import {
  buildConnectorSystemIndex,
  reconcileEntityConnectors,
  findSystemsBySource,
  findSystemMembershipsByEntity,
  detectMissingSystemMembers,
  notifyMissingSystemMembers,
  resolveMepCascadeOnDelete,
  memberKey,
} from '../mep-system-coordinator';
import { EventBus } from '../../../systems/events/EventBus';
import type { MepSystemEntity } from '../../types/mep-system-types';
import type { MepConnector } from '../../types/mep-connector-types';

function circuit(id: string, source: string, members: Array<[string, string]>): MepSystemEntity {
  return {
    id,
    params: {
      systemType: 'electrical-circuit',
      name: id,
      systemClassification: 'lighting',
      sourceEntityId: source,
      sourceConnectorId: 'src',
      members: members.map(([entityId, connectorId]) => ({ entityId, connectorId })),
    },
  };
}

const conn = (connectorId: string, systemId?: string): MepConnector => ({
  connectorId,
  domain: 'electrical',
  flow: 'in',
  localPosition: { x: 0, y: 0, z: 0 },
  ...(systemId ? { systemId } : {}),
});

describe('buildConnectorSystemIndex', () => {
  it('maps each member tuple to its system id', () => {
    const idx = buildConnectorSystemIndex([circuit('sys1', 'pnl1', [['fx1', 'c1'], ['fx2', 'c1']])]);
    expect(idx.get(memberKey('fx1', 'c1'))).toBe('sys1');
    expect(idx.get(memberKey('fx2', 'c1'))).toBe('sys1');
    expect(idx.get(memberKey('fx3', 'c1'))).toBeUndefined();
  });

  it('last system wins on a duplicate connector claim', () => {
    const idx = buildConnectorSystemIndex([
      circuit('sysA', 'pnl1', [['fx1', 'c1']]),
      circuit('sysB', 'pnl2', [['fx1', 'c1']]),
    ]);
    expect(idx.get(memberKey('fx1', 'c1'))).toBe('sysB');
  });
});

describe('reconcileEntityConnectors (System wins)', () => {
  it('sets systemId on a member connector', () => {
    const idx = buildConnectorSystemIndex([circuit('sys1', 'pnl1', [['fx1', 'c1']])]);
    const next = reconcileEntityConnectors('fx1', [conn('c1')], idx);
    expect(next[0].systemId).toBe('sys1');
  });

  it('clears a stale systemId on a non-member connector', () => {
    const idx = buildConnectorSystemIndex([]); // fx1 belongs to nothing now
    const next = reconcileEntityConnectors('fx1', [conn('c1', 'oldSys')], idx);
    expect(next[0].systemId).toBeUndefined();
  });

  it('overwrites a disagreeing cache (System wins)', () => {
    const idx = buildConnectorSystemIndex([circuit('sysNew', 'pnl1', [['fx1', 'c1']])]);
    const next = reconcileEntityConnectors('fx1', [conn('c1', 'sysOld')], idx);
    expect(next[0].systemId).toBe('sysNew');
  });

  it('returns the same array reference when nothing changed (no-op skip)', () => {
    const idx = buildConnectorSystemIndex([circuit('sys1', 'pnl1', [['fx1', 'c1']])]);
    const input = [conn('c1', 'sys1')];
    expect(reconcileEntityConnectors('fx1', input, idx)).toBe(input);
  });
});

describe('reverse lookups', () => {
  const systems = [
    circuit('sys1', 'pnl1', [['fx1', 'c1'], ['fx2', 'c1']]),
    circuit('sys2', 'pnl1', [['fx3', 'c1']]),
    circuit('sys3', 'pnl2', [['fx1', 'c1']]),
  ];

  it('findSystemsBySource returns circuits fed by a panel', () => {
    expect(findSystemsBySource(new Set(['pnl1']), systems).sort()).toEqual(['sys1', 'sys2']);
  });

  it('findSystemMembershipsByEntity returns every membership for an entity', () => {
    const m = findSystemMembershipsByEntity('fx1', systems);
    expect(m).toEqual([
      { systemId: 'sys1', connectorId: 'c1' },
      { systemId: 'sys3', connectorId: 'c1' },
    ]);
  });
});

describe('detectMissingSystemMembers', () => {
  it('flags absent source and absent members', () => {
    const systems = [circuit('sys1', 'pnlGONE', [['fx1', 'c1'], ['fxGONE', 'c1']])];
    const present = new Set(['fx1']);
    const missing = detectMissingSystemMembers(systems, present);
    expect(missing).toEqual([
      { systemId: 'sys1', entityId: 'pnlGONE', connectorId: 'src' },
      { systemId: 'sys1', entityId: 'fxGONE', connectorId: 'c1' },
    ]);
  });

  it('returns nothing when all references resolve', () => {
    const systems = [circuit('sys1', 'pnl1', [['fx1', 'c1']])];
    expect(detectMissingSystemMembers(systems, new Set(['pnl1', 'fx1']))).toEqual([]);
  });
});

describe('notifyMissingSystemMembers', () => {
  it('emits one event per dangling reference', () => {
    const spy = jest.spyOn(EventBus, 'emit').mockImplementation(() => {});
    const systems = [circuit('sys1', 'pnl1', [['fxGONE', 'c1']])];
    const missing = notifyMissingSystemMembers(systems, new Set(['pnl1']));
    expect(missing).toHaveLength(1);
    expect(spy).toHaveBeenCalledWith('bim:mep-system-member-missing', {
      systemId: 'sys1',
      entityId: 'fxGONE',
      connectorId: 'c1',
    });
    spy.mockRestore();
  });

  it('no-op when nothing is missing', () => {
    const spy = jest.spyOn(EventBus, 'emit').mockImplementation(() => {});
    notifyMissingSystemMembers([circuit('sys1', 'pnl1', [['fx1', 'c1']])], new Set(['pnl1', 'fx1']));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('resolveMepCascadeOnDelete (Φ4 cascade plan)', () => {
  it('dissolves circuits whose source was deleted', () => {
    const systems = [
      circuit('sys1', 'pnl1', [['fx1', 'c1']]),
      circuit('sys2', 'pnl2', [['fx2', 'c1']]),
    ];
    const plan = resolveMepCascadeOnDelete(new Set(['pnl1']), systems);
    expect(plan.dissolve.map((s) => s.id)).toEqual(['sys1']);
    expect(plan.memberRemovals).toEqual([]);
  });

  it('removes a deleted member from a surviving circuit (correct nextParams)', () => {
    const systems = [circuit('sys1', 'pnl1', [['fx1', 'c1'], ['fx2', 'c1']])];
    const plan = resolveMepCascadeOnDelete(new Set(['fx1']), systems);
    expect(plan.dissolve).toEqual([]);
    expect(plan.memberRemovals).toHaveLength(1);
    const removal = plan.memberRemovals[0];
    expect(removal.systemId).toBe('sys1');
    expect(removal.prevParams.members).toHaveLength(2);
    expect(removal.nextParams.members).toEqual([{ entityId: 'fx2', connectorId: 'c1' }]);
  });

  it('dissolves (not member-edits) when the entity is BOTH source and member', () => {
    // pnl1 is the source of sys1 AND a member of sys2.
    const systems = [
      circuit('sys1', 'pnl1', [['fx1', 'c1']]),
      circuit('sys2', 'pnl2', [['pnl1', 'cIn'], ['fx9', 'c1']]),
    ];
    const plan = resolveMepCascadeOnDelete(new Set(['pnl1']), systems);
    // sys1 dissolved (source); sys2 survives minus pnl1.
    expect(plan.dissolve.map((s) => s.id)).toEqual(['sys1']);
    expect(plan.memberRemovals.map((r) => r.systemId)).toEqual(['sys2']);
    expect(plan.memberRemovals[0].nextParams.members).toEqual([{ entityId: 'fx9', connectorId: 'c1' }]);
  });

  it('does not member-edit a system that is also being dissolved', () => {
    // fxX is the source of sysA and also a member of sysA — sysA only dissolves.
    const systems = [circuit('sysA', 'fxX', [['fxX', 'c1'], ['fy', 'c1']])];
    const plan = resolveMepCascadeOnDelete(new Set(['fxX']), systems);
    expect(plan.dissolve.map((s) => s.id)).toEqual(['sysA']);
    expect(plan.memberRemovals).toEqual([]);
  });

  it('no-op when no system references the deleted entities', () => {
    const systems = [circuit('sys1', 'pnl1', [['fx1', 'c1']])];
    const plan = resolveMepCascadeOnDelete(new Set(['ghost']), systems);
    expect(plan.dissolve).toEqual([]);
    expect(plan.memberRemovals).toEqual([]);
  });
});

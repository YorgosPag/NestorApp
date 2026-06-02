/**
 * ADR-408 Φ4 — MEP system command tests (Update params / Dissolve) + the
 * CompoundCommand cascade integration (single coherent undo unit).
 */

import { UpdateMepSystemParamsCommand } from '../UpdateMepSystemParamsCommand';
import { DissolveMepSystemCommand } from '../DissolveMepSystemCommand';
import { CompoundCommand } from '../../CompoundCommand';
import {
  setMepSystemMutator,
  type MepSystemMutator,
} from '../../../../bim/mep-systems/mep-system-mutator';
import { resolveMepCascadeOnDelete } from '../../../../bim/mep-systems/mep-system-coordinator';
import type { ICommand } from '../../interfaces';
import type {
  MepSystemEntity,
  MepSystemParams,
} from '../../../../bim/types/mep-system-types';

function params(name: string, members: Array<[string, string]> = []): MepSystemParams {
  return {
    systemType: 'electrical-circuit',
    name,
    systemClassification: 'lighting',
    sourceEntityId: 'pnl1',
    sourceConnectorId: 'src',
    members: members.map(([entityId, connectorId]) => ({ entityId, connectorId })),
  };
}

function system(id: string, p: MepSystemParams): MepSystemEntity {
  return { id, params: p };
}

interface MockMutator {
  updateSystemParams: jest.Mock;
  dissolveSystem: jest.Mock;
  restoreSystem: jest.Mock;
}

function installMutator(): MockMutator {
  const mock: MockMutator = {
    updateSystemParams: jest.fn(),
    dissolveSystem: jest.fn(),
    restoreSystem: jest.fn(),
  };
  setMepSystemMutator(mock as unknown as MepSystemMutator);
  return mock;
}

afterEach(() => setMepSystemMutator(null));

describe('UpdateMepSystemParamsCommand', () => {
  it('execute / redo apply next params, undo applies previous', () => {
    const mock = installMutator();
    const prev = params('Circuit', [['fx1', 'c1'], ['fx2', 'c1']]);
    const next = params('Circuit', [['fx2', 'c1']]);
    const cmd = new UpdateMepSystemParamsCommand('sys1', next, prev);

    cmd.execute();
    expect(mock.updateSystemParams).toHaveBeenLastCalledWith('sys1', next);

    cmd.undo();
    expect(mock.updateSystemParams).toHaveBeenLastCalledWith('sys1', prev);

    cmd.redo();
    expect(mock.updateSystemParams).toHaveBeenLastCalledWith('sys1', next);
    expect(mock.updateSystemParams).toHaveBeenCalledTimes(3);
  });

  it('validate guards id + members array', () => {
    const ok = new UpdateMepSystemParamsCommand('sys1', params('A'), params('A'));
    expect(ok.validate()).toBeNull();
    const bad = new UpdateMepSystemParamsCommand('', params('A'), params('A'));
    expect(bad.validate()).toMatch(/ID is required/);
  });

  it('merges consecutive drag samples into one entry', () => {
    const a = new UpdateMepSystemParamsCommand('sys1', params('A'), params('orig'), true);
    const b = new UpdateMepSystemParamsCommand('sys1', params('B'), params('A'), true);
    expect(a.canMergeWith(b)).toBe(true);
    const merged = a.mergeWith(b) as UpdateMepSystemParamsCommand;
    const mock = installMutator();
    merged.undo();
    // merged keeps THIS.previousParams (pre-drag) for a clean single undo.
    expect(mock.updateSystemParams).toHaveBeenLastCalledWith('sys1', params('orig'));
  });

  it('does not merge across different systems', () => {
    const a = new UpdateMepSystemParamsCommand('sys1', params('A'), params('o'), true);
    const b = new UpdateMepSystemParamsCommand('sys2', params('B'), params('o'), true);
    expect(a.canMergeWith(b)).toBe(false);
  });

  it('no-op (no throw) when no mutator is registered', () => {
    setMepSystemMutator(null);
    const cmd = new UpdateMepSystemParamsCommand('sys1', params('A'), params('A'));
    expect(() => { cmd.execute(); cmd.undo(); }).not.toThrow();
  });
});

describe('DissolveMepSystemCommand', () => {
  it('execute dissolves, undo restores the snapshot', () => {
    const mock = installMutator();
    const snap = system('sys1', params('Circuit L1', [['fx1', 'c1']]));
    const cmd = new DissolveMepSystemCommand(snap);

    cmd.execute();
    expect(mock.dissolveSystem).toHaveBeenCalledWith('sys1');

    cmd.undo();
    expect(mock.restoreSystem).toHaveBeenCalledWith(snap);
  });

  it('never merges and validates the snapshot id', () => {
    const cmd = new DissolveMepSystemCommand(system('sys1', params('A')));
    expect(cmd.canMergeWith()).toBe(false);
    expect(cmd.validate()).toBeNull();
  });
});

describe('CompoundCommand cascade (single coherent undo)', () => {
  it('execute applies delete + cascade; undo reverses ALL in one unit', () => {
    const mock = installMutator();
    // pnl1 = source of sys1 (dissolve); fx1 = member of sys2 (member removal).
    const systems = [
      system('sys1', params('Src circuit')), // source pnl1
      {
        id: 'sys2',
        params: {
          systemType: 'electrical-circuit' as const,
          name: 'Other',
          systemClassification: 'lighting' as const,
          sourceEntityId: 'pnlX',
          sourceConnectorId: 'src',
          members: [{ entityId: 'fx1', connectorId: 'c1' }, { entityId: 'fx7', connectorId: 'c1' }],
        },
      },
    ];
    const plan = resolveMepCascadeOnDelete(new Set(['pnl1', 'fx1']), systems);
    expect(plan.dissolve.map((s) => s.id)).toEqual(['sys1']);
    expect(plan.memberRemovals.map((r) => r.systemId)).toEqual(['sys2']);

    const deleteCalls: string[] = [];
    const fakeDelete: ICommand = {
      id: 'del', name: 'del', type: 'fake-delete', timestamp: 0,
      execute: () => deleteCalls.push('exec'),
      undo: () => deleteCalls.push('undo'),
      redo: () => deleteCalls.push('redo'),
      getDescription: () => 'fake', getAffectedEntityIds: () => ['pnl1', 'fx1'],
      serialize: () => ({ type: 'fake-delete', id: 'del', name: 'del', timestamp: 0, data: {}, version: 1 }),
    };

    const compound = new CompoundCommand('Delete MEP', [
      fakeDelete,
      ...plan.dissolve.map((s) => new DissolveMepSystemCommand(s)),
      ...plan.memberRemovals.map((r) => new UpdateMepSystemParamsCommand(r.systemId, r.nextParams, r.prevParams)),
    ]);

    compound.execute();
    expect(deleteCalls).toEqual(['exec']);
    expect(mock.dissolveSystem).toHaveBeenCalledWith('sys1');
    expect(mock.updateSystemParams).toHaveBeenLastCalledWith('sys2', plan.memberRemovals[0].nextParams);

    compound.undo();
    // reverse order: member-removal undo (prev) → dissolve undo (restore) → delete undo.
    expect(mock.updateSystemParams).toHaveBeenLastCalledWith('sys2', plan.memberRemovals[0].prevParams);
    expect(mock.restoreSystem).toHaveBeenCalledWith(systems[0]);
    expect(deleteCalls).toEqual(['exec', 'undo']);
  });
});

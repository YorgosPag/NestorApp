/**
 * ADR-430 / ADR-431 — the ONE Accept path of the electrical auto-design bridges.
 *
 * Locks: the shared proposal store is committed ONLY by the bridge whose `origin` produced the
 * review (strong never commits weak, and vice versa) · an empty review is cleared without a
 * transaction · a review commits as ONE `CompoundCommand` (single undo) of one
 * `CreateMepSystemCommand` per system, then the store is cleared.
 */

import { CompoundCommand, type ICommand } from '../../../../../core/commands';
import {
  electricalProposalStore,
  type ElectricalProposalOrigin,
} from '../../../../../systems/mep-design/electrical/electrical-proposal-store';
import type { MepElectricalSystemParams, MepSystemEntity } from '../../../../../bim/types/mep-system-types';
import { commitElectricalReview } from '../electrical-proposal-commit';

function makeSystem(id: string): MepSystemEntity {
  const params: MepElectricalSystemParams = {
    systemType: 'electrical-circuit',
    name: id,
    systemClassification: 'lighting',
    sourceEntityId: 'pnl',
    sourceConnectorId: 'c1',
    members: [],
  };
  return { id, params };
}

function seed(origin: ElectricalProposalOrigin, systemEntities: readonly MepSystemEntity[]): void {
  electricalProposalStore.set({
    origin,
    proposal: { warnings: [], storeyId: 'L1', skippedAlreadyCircuited: 0 },
    systemEntities,
    wirePaths: [],
    sceneUnits: 'mm',
  });
}

describe('commitElectricalReview', () => {
  afterEach(() => electricalProposalStore.reset());

  it('never commits the sibling bridge\'s review — and leaves it under review', () => {
    seed('weak', [makeSystem('d1')]);
    const execute = jest.fn<void, [ICommand]>();
    expect(commitElectricalReview('strong', 'Generate electrical circuits', execute)).toBeNull();
    expect(execute).not.toHaveBeenCalled();
    expect(electricalProposalStore.get()?.origin).toBe('weak');
  });

  it('returns null with nothing under review', () => {
    const execute = jest.fn<void, [ICommand]>();
    expect(commitElectricalReview('strong', 'x', execute)).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('clears an empty review of its own origin without a transaction', () => {
    seed('strong', []);
    const execute = jest.fn<void, [ICommand]>();
    expect(commitElectricalReview('strong', 'x', execute)).toBeNull();
    expect(execute).not.toHaveBeenCalled();
    expect(electricalProposalStore.get()).toBeNull();
  });

  it('commits its own review as ONE compound command and clears the store', () => {
    seed('weak', [makeSystem('d1'), makeSystem('d2')]);
    const execute = jest.fn<void, [ICommand]>();
    expect(commitElectricalReview('weak', 'Generate structured-cabling channels', execute)).toBe(2);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toBeInstanceOf(CompoundCommand);
    expect(electricalProposalStore.get()).toBeNull();
  });
});

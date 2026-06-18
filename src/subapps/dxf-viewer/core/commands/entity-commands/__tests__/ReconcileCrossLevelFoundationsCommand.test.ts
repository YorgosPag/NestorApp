/**
 * ADR-484 Slice 6 — ReconcileCrossLevelFoundationsCommand.
 *
 * Επαληθεύει ότι όλο το reconcile delta (create + delete + update) δρομολογείται μέσω
 * του FoundationCrossLevelWriter, με atomic undo/redo (mirror DeleteCrossLevelFootingsCommand).
 */

import { ReconcileCrossLevelFoundationsCommand } from '../ReconcileCrossLevelFoundationsCommand';
import type { FoundationCrossLevelWriter } from '../../../../bim/foundations/foundation-cross-level-writer';
import type { FoundationEntity } from '../../../../bim/types/foundation-types';

const writer = (): jest.Mocked<FoundationCrossLevelWriter> => ({
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const strip = (id: string, width = 600): FoundationEntity =>
  ({ id, type: 'foundation', kind: 'strip', params: { kind: 'strip', width } } as unknown as FoundationEntity);

describe('ReconcileCrossLevelFoundationsCommand', () => {
  it('execute routes creates/deletes/updates through the cross-level writer', () => {
    const w = writer();
    const c1 = strip('C1');
    const d1 = strip('D1');
    const u = { original: strip('U1', 500), rehosted: strip('U1', 700) };
    const cmd = new ReconcileCrossLevelFoundationsCommand([c1], [d1], [u], w);

    cmd.execute();

    expect(w.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'C1' }));
    expect(w.remove).toHaveBeenCalledWith('D1');
    expect(w.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'U1', params: expect.objectContaining({ width: 700 }) }));
  });

  it('undo reverses: deletes re-created, updates restored, creates removed', () => {
    const w = writer();
    const c1 = strip('C1');
    const d1 = strip('D1');
    const u = { original: strip('U1', 500), rehosted: strip('U1', 700) };
    const cmd = new ReconcileCrossLevelFoundationsCommand([c1], [d1], [u], w);

    cmd.execute();
    w.create.mockClear();
    w.update.mockClear();
    w.remove.mockClear();

    cmd.undo();

    expect(w.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'D1' }));
    expect(w.remove).toHaveBeenCalledWith('C1');
    expect(w.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'U1', params: expect.objectContaining({ width: 500 }) }));
  });

  it('undo before execute is a no-op', () => {
    const w = writer();
    const cmd = new ReconcileCrossLevelFoundationsCommand([strip('C1')], [], [], w);
    cmd.undo();
    expect(w.create).not.toHaveBeenCalled();
    expect(w.remove).not.toHaveBeenCalled();
    expect(w.update).not.toHaveBeenCalled();
  });

  it('redo re-applies the forward delta', () => {
    const w = writer();
    const cmd = new ReconcileCrossLevelFoundationsCommand([strip('C1')], [strip('D1')], [], w);
    cmd.execute();
    w.create.mockClear();
    w.remove.mockClear();
    cmd.redo();
    expect(w.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'C1' }));
    expect(w.remove).toHaveBeenCalledWith('D1');
  });

  it('validate rejects an empty delta', () => {
    const w = writer();
    expect(new ReconcileCrossLevelFoundationsCommand([], [], [], w).validate()).not.toBeNull();
    expect(new ReconcileCrossLevelFoundationsCommand([strip('C1')], [], [], w).validate()).toBeNull();
  });
});

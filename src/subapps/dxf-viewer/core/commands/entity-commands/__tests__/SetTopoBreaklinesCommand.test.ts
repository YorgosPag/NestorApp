/**
 * ADR-920 Β4.8 Β3.3 — SetTopoBreaklinesCommand: κάθε αλλαγή στις ασυνέχειες αναιρείται.
 *
 * Τα συμβόλαια: (1) execute → undo → redo επιστρέφει ΑΚΡΙΒΩΣ τις εγγραφές που υπήρχαν, με τη σειρά τους· (2) καμία κενή εγγραφή στο ιστορικό· (3) οι τρεις πραγματικοί δρόμοι (εργαλείο,
 * «Καθαρισμός», έγκριση αυτόματων) γράφουν ΜΕΣΑ από το ιστορικό, ώστε ένα Ctrl+Z να τους παίρνει πίσω.
 */

import { SetTopoBreaklinesCommand } from '../SetTopoBreaklinesCommand';
import { getGlobalCommandHistory } from '../../CommandHistory';
import {
  clearTopo, createBreakline, getTopoBreaklines, setTopoBreaklines,
} from '../../../../systems/topography/TopoPointStore';
import { acceptAutoBreaklines } from '../../../../systems/topography/auto-breaklines';
import type { Breakline, TopoPoint3D } from '../../../../systems/topography/topo-types';
import type { AutoBreaklineCandidate } from '../../../../systems/topography/auto-breaklines/auto-breakline-types';

const V: readonly TopoPoint3D[] = [{ x: 0, y: 0, z: 1 }, { x: 1000, y: 0, z: 2 }];

function record(sourceEntityId?: string): Breakline {
  const b = createBreakline(V, false, sourceEntityId, 'elevation');
  if (!b) throw new Error('fixture');
  return b;
}

beforeEach(() => {
  clearTopo();
  getGlobalCommandHistory().clear();
});

describe('SetTopoBreaklinesCommand', () => {
  it('add → undo → redo restores exactly the breaklines that were there (same records, same order)', () => {
    const existing = record('ent_0');
    setTopoBreaklines([existing]);
    const added = record('ent_1');
    const cmd = SetTopoBreaklinesCommand.add('existing', [added])!;
    cmd.execute();
    expect(getTopoBreaklines('existing')).toEqual([existing, added]);
    cmd.undo();
    expect(getTopoBreaklines('existing')).toEqual([existing]);
    cmd.redo();
    expect(getTopoBreaklines('existing')).toEqual([existing, added]);
  });

  it('remove drops only the named ones and undo puts them back in place', () => {
    const [a, b, c] = [record(), record(), record()];
    setTopoBreaklines([a!, b!, c!]);
    const cmd = SetTopoBreaklinesCommand.remove('existing', [b!.id])!;
    cmd.execute();
    expect(getTopoBreaklines('existing').map((x) => x.id)).toEqual([a!.id, c!.id]);
    cmd.undo();
    expect(getTopoBreaklines('existing').map((x) => x.id)).toEqual([a!.id, b!.id, c!.id]);
  });

  it('clear empties ONE surface and leaves the other untouched', () => {
    setTopoBreaklines([record()], 'existing');
    setTopoBreaklines([record()], 'proposed');
    const cmd = SetTopoBreaklinesCommand.clear('existing')!;
    cmd.execute();
    expect(getTopoBreaklines('existing')).toEqual([]);
    expect(getTopoBreaklines('proposed')).toHaveLength(1);
  });

  it('is idempotent: nothing to change → null (never an empty history entry)', () => {
    expect(SetTopoBreaklinesCommand.add('existing', [])).toBeNull();
    expect(SetTopoBreaklinesCommand.remove('existing', ['nope'])).toBeNull();
    expect(SetTopoBreaklinesCommand.clear('existing')).toBeNull();
  });

  it('reports the source entities of the touched breaklines, once each', () => {
    const cmd = SetTopoBreaklinesCommand.add('existing', [record('ent_1'), record('ent_1'), record()])!;
    expect(cmd.getAffectedEntityIds()).toEqual(['ent_1']);
  });
});

describe('the real write paths go through the history (Ctrl+Z)', () => {
  it('approving N automatic candidates is ONE undo', () => {
    const candidate: AutoBreaklineCandidate = {
      id: 'c', vertices: V, closed: false, lengthMm: 1000, avgFoldDeg: 30, edgeCount: 1,
    };
    const ids = acceptAutoBreaklines([candidate, { ...candidate, id: 'd' }]);
    expect(ids).toHaveLength(2);
    expect(getTopoBreaklines('existing').every((b) => b.elevationSource === 'surface')).toBe(true);
    getGlobalCommandHistory().undo();
    expect(getTopoBreaklines('existing')).toEqual([]);
  });
});

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

describe('SetTopoBreaklinesCommand — επίλυση συγκρούσεων (ADR-920 Β3.6)', () => {
  const AT = { x: 500, y: 0 } as const;

  it('resolve αποθηκεύει τον κανόνα στη γραμμή-ιδιοκτήτη· undo τον παίρνει πίσω', () => {
    const [a, b] = [record(), record()];
    setTopoBreaklines([a, b]);
    const cmd = SetTopoBreaklinesCommand.resolve('existing', [
      { ownerBreaklineId: b.id, resolution: { withBreaklineId: a.id, ...AT, rule: 'higher' } },
    ])!;
    cmd.execute();
    expect(getTopoBreaklines('existing')[1].crossingResolutions).toEqual([{ withBreaklineId: a.id, ...AT, rule: 'higher' }]);
    cmd.undo();
    expect(getTopoBreaklines('existing')).toEqual([a, b]);
  });

  it('νέα απόφαση για το ΙΔΙΟ σημείο αντικαθιστά την παλιά — και όταν ήταν αποθηκευμένη στην ΑΛΛΗ γραμμή', () => {
    const [a, b] = [record(), record()];
    setTopoBreaklines([{ ...a, crossingResolutions: [{ withBreaklineId: b.id, ...AT, rule: 'lower' }] }, b]);
    SetTopoBreaklinesCommand.resolve('existing', [
      { ownerBreaklineId: b.id, resolution: { withBreaklineId: a.id, x: 503, y: 0, rule: 'specify', z: 7 } },
    ])!.execute();
    const [na, nb] = getTopoBreaklines('existing');
    expect(na).not.toHaveProperty('crossingResolutions');
    expect(nb.crossingResolutions).toEqual([{ withBreaklineId: a.id, x: 503, y: 0, rule: 'specify', z: 7 }]);
  });

  it('ίδια απόφαση ξανά = null (καμία κενή εγγραφή στο ιστορικό)', () => {
    const [a, b] = [record(), record()];
    const stored = { withBreaklineId: a.id, ...AT, rule: 'average' } as const;
    setTopoBreaklines([a, { ...b, crossingResolutions: [stored] }]);
    expect(SetTopoBreaklinesCommand.resolve('existing', [{ ownerBreaklineId: b.id, resolution: stored }])).toBeNull();
  });

  it('«Επίλυση όλων»: Ν αποφάσεις = ΕΝΑ undo', () => {
    const [a, b, c] = [record(), record(), record()];
    setTopoBreaklines([a, b, c]);
    getGlobalCommandHistory().execute(SetTopoBreaklinesCommand.resolve('existing', [
      { ownerBreaklineId: b.id, resolution: { withBreaklineId: a.id, ...AT, rule: 'higher' } },
      { ownerBreaklineId: c.id, resolution: { withBreaklineId: a.id, x: 900, y: 0, rule: 'higher' } },
    ])!);
    expect(getTopoBreaklines('existing').filter((x) => x.crossingResolutions)).toHaveLength(2);
    getGlobalCommandHistory().undo();
    expect(getTopoBreaklines('existing')).toEqual([a, b, c]);
  });

  it('unresolve επιστρέφει στο «νικά η πρώτη» και αφαιρεί το κενό πεδίο· άγνωστο κλειδί = null', () => {
    const [a, b] = [record(), record()];
    setTopoBreaklines([a, { ...b, crossingResolutions: [{ withBreaklineId: a.id, ...AT, rule: 'higher' }] }]);
    const key = { ownerBreaklineId: b.id, withBreaklineId: a.id, ...AT };
    expect(SetTopoBreaklinesCommand.unresolve('existing', [{ ...key, x: 1 }])).toBeNull();
    SetTopoBreaklinesCommand.unresolve('existing', [key])!.execute();
    expect(getTopoBreaklines('existing')).toEqual([a, b]);
  });

  it('remove μιας γραμμής παίρνει μαζί τις αποφάσεις των άλλων ΓΙΑ αυτήν — ένα Ctrl+Z τα φέρνει όλα πίσω', () => {
    const [a, b] = [record(), record()];
    const withRule = { ...b, crossingResolutions: [{ withBreaklineId: a.id, ...AT, rule: 'higher' as const }] };
    setTopoBreaklines([a, withRule]);
    getGlobalCommandHistory().execute(SetTopoBreaklinesCommand.remove('existing', [a.id])!);
    expect(getTopoBreaklines('existing')).toEqual([b]);
    getGlobalCommandHistory().undo();
    expect(getTopoBreaklines('existing')).toEqual([a, withRule]);
  });
});

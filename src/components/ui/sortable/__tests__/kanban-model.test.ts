/**
 * ADR-930 — ο καθαρός πυρήνας του `KanbanBoard`: ομαδοποίηση, απόφαση ρίψης, πλοήγηση πληκτρολογίου.
 */

import {
  columnOfDropTarget,
  dockTargetId,
  groupByColumn,
  isDockTarget,
  neighbourColumn,
  parseCollapseChoices,
  resolveCollapsedColumns,
  resolveKanbanDrop,
  type KanbanRect,
} from '../kanban-model';

const COLUMNS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('groupByColumn', () => {
  it('κρατά τη σειρά άφιξης και δίνει κενό πίνακα σε κάθε στήλη', () => {
    const items = [{ id: 1, col: 'b' }, { id: 2, col: 'a' }, { id: 3, col: 'b' }];
    const groups = groupByColumn(items, COLUMNS, (item) => item.col);
    expect(groups.get('a')?.map((i) => i.id)).toEqual([2]);
    expect(groups.get('b')?.map((i) => i.id)).toEqual([1, 3]);
    expect(groups.get('c')).toEqual([]);
  });

  it('στοιχείο σε άγνωστη στήλη δεν εμφανίζεται — καμία σιωπηλή νέα στήλη', () => {
    const groups = groupByColumn([{ col: 'zzz' }], COLUMNS, (item) => item.col);
    expect([...groups.keys()]).toEqual(['a', 'b', 'c']);
    expect([...groups.values()].flat()).toEqual([]);
  });
});

describe('resolveKanbanDrop', () => {
  const allowAll = () => true;
  it('έξω από στήλη ⇒ τίποτα', () => expect(resolveKanbanDrop('a', null, allowAll)).toEqual({ kind: 'none' }));
  it('ίδια στήλη ⇒ τίποτα (καμία σειρά μέσα στη στήλη)', () => expect(resolveKanbanDrop('a', 'a', allowAll)).toEqual({ kind: 'none' }));
  it('άλλη στήλη ⇒ μετακίνηση', () => expect(resolveKanbanDrop('a', 'c', allowAll)).toEqual({ kind: 'move', from: 'a', to: 'c' }));
  it('μη επιτρεπτή στήλη ⇒ άρνηση, όχι μετακίνηση', () => {
    expect(resolveKanbanDrop('a', 'b', (to) => to !== 'b')).toEqual({ kind: 'refused', to: 'b' });
  });
});

describe('neighbourColumn', () => {
  // Σκόπιμα ανακατεμένη σειρά: η απόφαση είναι κατά θέση στην οθόνη, όχι κατά DOM.
  const rects: KanbanRect[] = [
    { id: 'c', left: 600, top: 0, width: 280 },
    { id: 'a', left: 0, top: 0, width: 280 },
    { id: 'b', left: 300, top: 0, width: 280 },
  ];
  it('→ από το a πηγαίνει στο b, ← από το b στο a', () => {
    expect(neighbourColumn(rects, 'a', 1)?.id).toBe('b');
    expect(neighbourColumn(rects, 'b', -1)?.id).toBe('a');
  });
  it('στα άκρα μένει εκεί', () => {
    expect(neighbourColumn(rects, 'c', 1)?.id).toBe('c');
    expect(neighbourColumn(rects, 'a', -1)?.id).toBe('a');
  });
  it('η τρέχουσα στήλη λείπει (π.χ. απενεργοποιημένη) ⇒ ξεκινά από το αντίστοιχο άκρο', () => {
    expect(neighbourColumn(rects, 'x', 1)?.id).toBe('a');
    expect(neighbourColumn(rects, null, -1)?.id).toBe('c');
  });
  it('καμία στήλη ⇒ null', () => expect(neighbourColumn([], 'a', 1)).toBeNull());
});

describe('ζώνη ρίψης (ADR-930 §3.11)', () => {
  it('ο στόχος της ζώνης σημαίνει τη στήλη του — και η στήλη σημαίνει τον εαυτό της', () => {
    expect(columnOfDropTarget(dockTargetId('closed_won'))).toBe('closed_won');
    expect(columnOfDropTarget('closed_won')).toBe('closed_won');
  });
  it('ο στόχος της ζώνης ΔΕΝ συγκρούεται με το id της στήλης', () => {
    expect(dockTargetId('a')).not.toBe('a');
    expect(isDockTarget(dockTargetId('a'))).toBe(true);
    expect(isDockTarget('a')).toBe(false);
  });
  it('ρίψη στη ζώνη = ρίψη στη στήλη (ίδια απόφαση, ίδια άρνηση)', () => {
    const to = columnOfDropTarget(dockTargetId('c'));
    expect(resolveKanbanDrop('a', to, () => true)).toEqual({ kind: 'move', from: 'a', to: 'c' });
    expect(resolveKanbanDrop('c', to, () => true)).toEqual({ kind: 'none' });
    expect(resolveKanbanDrop('a', to, () => false)).toEqual({ kind: 'refused', to: 'c' });
  });
});

describe('σύμπτυξη στηλών (ADR-930 §3.11)', () => {
  const IDS = ['a', 'b', 'c'];
  it('κρατά μόνο γνωστές στήλες με τιμή boolean', () => {
    expect(parseCollapseChoices({ a: true, b: 'yes', z: true, c: false }, IDS)).toEqual({ a: true, c: false });
  });
  it('οτιδήποτε άλλο από αντικείμενο ⇒ καμία επιλογή', () => {
    for (const bad of [null, undefined, 'a', 3, ['a'], true]) expect(parseCollapseChoices(bad, IDS)).toEqual({});
  });
  it('η ρητή επιλογή κερδίζει την προεπιλογή — και προς τις δύο κατευθύνσεις', () => {
    const byDefault = (id: string) => id === 'c';
    expect([...resolveCollapsedColumns(IDS, {}, byDefault)]).toEqual(['c']);
    expect([...resolveCollapsedColumns(IDS, { c: false, a: true }, byDefault)]).toEqual(['a']);
  });
});

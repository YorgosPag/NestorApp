/**
 * ADR-930 — ο καθαρός πυρήνας του `KanbanBoard`: ομαδοποίηση, απόφαση ρίψης, πλοήγηση πληκτρολογίου.
 */

import { groupByColumn, neighbourColumn, resolveKanbanDrop, type KanbanRect } from '../kanban-model';

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

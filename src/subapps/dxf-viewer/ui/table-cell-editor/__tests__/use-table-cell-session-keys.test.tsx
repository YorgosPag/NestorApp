/**
 * ADR-739 Φ.Δ βήμα 7 — η **ΜΙΑ καλωδίωση** της σημασιολογίας πλήκτρων, κοινή στα δύο πεδία
 * της συνεδρίας (κελί + γραμμή τύπων).
 *
 * Η σημασιολογία («ποιο πλήκτρο τι σημαίνει») δοκιμάζεται αλλού, στο
 * `table-cell-key-intent.test.ts`. Εδώ δοκιμάζεται το **συμβόλαιο εκτέλεσης**, και ειδικά
 * το ένα κομμάτι του που δεν φαίνεται πουθενά αλλού: η **σειρά** `commit` → `move`.
 * Αντίστροφα, το κείμενο θα γραφόταν στο **επόμενο** κελί — δηλαδή θα εμφανιζόταν σε λάθος
 * γραμμή του πίνακα ποσοτήτων, χωρίς κανένα σφάλμα και χωρίς καμία προειδοποίηση.
 */

import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { useTableCellSessionKeys } from '../use-table-cell-session-keys';
import {
  setTableCellCursor,
  getTableCellCursor,
  __resetTableCellCursorStoreForTests,
} from '../../../state/table-cell-cursor-store';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import type { TableCellCursorMode } from '../../../state/table-cell-cursor-store';
import { setTableCellCursorById } from '../../../bim/table/__tests__/make-table-entity';

function keyEvent(key: string, mod: Partial<KeyboardEvent> = {}): React.KeyboardEvent<HTMLElement> {
  return {
    key,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault: jest.fn(),
    ...mod,
  } as unknown as React.KeyboardEvent<HTMLElement>;
}

function setup(mode: TableCellCursorMode) {
  const calls: string[] = [];
  const handlers = {
    mode,
    initialText: 'παλιό',
    commit: jest.fn(() => { calls.push('commit'); }),
    onMove: jest.fn(() => { calls.push('move'); }),
    onClear: jest.fn(() => { calls.push('clear'); }),
    onHistory: jest.fn(() => { calls.push('history'); }),
    onPassthrough: jest.fn(() => { calls.push('passthrough'); }),
  };
  const { result } = renderHook(() => useTableCellSessionKeys(handlers));
  return { calls, handlers, fire: (e: React.KeyboardEvent<HTMLElement>) => act(() => result.current(e)) };
}

describe('useTableCellSessionKeys', () => {
  beforeEach(() => { __resetTableCellCursorStoreForTests(); });

  it('🔴 `Enter` δεσμεύει ΠΡΙΝ μετακινήσει — ποτέ αντίστροφα', () => {
    const { calls, handlers, fire } = setup('edit');
    fire(keyEvent('Enter'));
    expect(calls).toEqual(['commit', 'move']);
    expect(handlers.onMove).toHaveBeenCalledWith('commitDown');
  });

  it('`Tab` περνά την κίνηση με αναδίπλωση γραμμής', () => {
    const { handlers, fire } = setup('enter');
    fire(keyEvent('Tab'));
    expect(handlers.onMove).toHaveBeenCalledWith('next');
  });

  it('`F2` από πλοήγηση σπέρνει το πρόχειρο από το ΔΕΣΜΕΥΜΕΝΟ κείμενο', () => {
    // Χωρίς αυτό, το `F2` ανοίγει κενό πεδίο και το επόμενο `Tab` σβήνει το κελί — το
    // μετρημένο σφάλμα του βήματος 4, εδώ κλειδωμένο για **δύο** πεδία αντί για ένα.
    setTableCellCursorById('tbl', tableCursorAt('r1', 'c1'), 'nav');
    const { fire } = setup('nav');
    fire(keyEvent('F2'));
    expect(getTableCellCursor()?.mode).toBe('edit');
    expect(getTableCellCursor()?.draft).toBe('παλιό');
  });

  it('`Delete` σε πλοήγηση αδειάζει το κελί· σε γραφή ανήκει στο πεδίο', () => {
    const nav = setup('nav');
    nav.fire(keyEvent('Delete'));
    expect(nav.handlers.onClear).toHaveBeenCalledTimes(1);

    const editing = setup('edit');
    editing.fire(keyEvent('Delete'));
    expect(editing.handlers.onClear).not.toHaveBeenCalled();
  });

  it('`Alt+Enter` καταπίνεται — το `TableCell.value` είναι απλό string', () => {
    const { calls, fire } = setup('edit');
    const event = keyEvent('Enter', { altKey: true });
    fire(event);
    expect(calls).toEqual([]);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('χωρίς `onPassthrough` ένα αδιεκδίκητο πλήκτρο δεν κάνει ΤΙΠΟΤΑ και δεν ρίχνει', () => {
    // Είναι η περίπτωση της γραμμής τύπων: δεν έχει δικό της κύκλο δέσμευσης, οπότε το
    // συμβάν οφείλει να συνεχίσει τον φυσικό του δρόμο ανέγγιχτο.
    const { result } = renderHook(() =>
      useTableCellSessionKeys({
        mode: 'edit',
        initialText: '',
        commit: jest.fn(),
        onMove: jest.fn(),
        onClear: jest.fn(),
        onHistory: jest.fn(),
      }),
    );
    const event = keyEvent('α');
    expect(() => act(() => result.current(event))).not.toThrow();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

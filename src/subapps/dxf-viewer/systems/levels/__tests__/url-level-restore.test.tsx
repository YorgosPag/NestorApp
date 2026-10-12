/**
 * ADR-400 · ADR-914 §8.14 — **η επαναφορά επιπέδου από τη διεύθυνση διαβάζει τον σύνδεσμο ΜΙΑ φορά.**
 *
 * Από τη στιγμή που το `lvl` γράφεται σε κάθε αλλαγή επιπέδου (και σε άδειο καμβά), ο γραφέας
 * (`useViewportUrlSync`, effect **παιδιού**) τρέχει πριν από την επαναφορά (effect **προγόνου**):
 * στο πρώτο snapshot η συνδρομή εκλέγει το προεπιλεγμένο επίπεδο, ο γραφέας το γράφει στη
 * διεύθυνση, και μια επαναφορά που ξαναδιάβαζε τη διεύθυνση εκείνη τη στιγμή θα έβρισκε το
 * προεπιλεγμένο — ο σύνδεσμος θα είχε χαθεί. Η πρόθεση του συνδέσμου κρατιέται από το mount.
 */

import { renderHook } from '@testing-library/react';
import type { Level } from '../config';
import { useUrlLevelRestore } from '../hooks/useUrlLevelRestore';

const level = (id: string): Level => ({ id, name: id, order: 0, isDefault: false, visible: true });
const A = level('lvl_default');
const B = level('lvl_linked');

interface Props { levels: Level[]; current: string | null }

function mount(setCurrentLevelId: jest.Mock, initial: Props) {
  return renderHook(
    ({ levels, current }: Props) => useUrlLevelRestore(levels, current, setCurrentLevelId),
    { initialProps: initial },
  );
}

beforeEach(() => {
  window.history.replaceState({}, '', '/dxf/viewer');
});

describe('useUrlLevelRestore', () => {
  it('επιλέγει το επίπεδο του συνδέσμου όταν φτάσει η λίστα', () => {
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl_linked');
    const select = jest.fn();
    const { rerender } = mount(select, { levels: [], current: null });

    rerender({ levels: [A, B], current: 'lvl_default' });

    expect(select).toHaveBeenCalledWith('lvl_linked');
  });

  it('🔑 ο σύνδεσμος επιβιώνει όταν η διεύθυνση ξαναγραφτεί ΠΡΙΝ φτάσει η λίστα', () => {
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl_linked');
    const select = jest.fn();
    const { rerender } = mount(select, { levels: [], current: null });

    // Ο γραφέας της διεύθυνσης έγραψε το επίπεδο που εξέλεξε η συνδρομή.
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl_default');
    rerender({ levels: [A, B], current: 'lvl_default' });

    expect(select).toHaveBeenCalledWith('lvl_linked');
  });

  it('μία φορά: μετά την επαναφορά ο άνθρωπος αλλάζει επίπεδο ελεύθερα', () => {
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl_linked');
    const select = jest.fn();
    const { rerender } = mount(select, { levels: [A, B], current: 'lvl_default' });
    expect(select).toHaveBeenCalledTimes(1);

    rerender({ levels: [A, B], current: 'lvl_linked' });
    rerender({ levels: [A, B], current: 'lvl_default' });

    expect(select).toHaveBeenCalledTimes(1);
  });

  it('επίπεδο που δεν υπάρχει (ακόμη) στη λίστα δεν επιλέγεται — περιμένει', () => {
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl_linked');
    const select = jest.fn();
    const { rerender } = mount(select, { levels: [A], current: 'lvl_default' });
    expect(select).not.toHaveBeenCalled();

    rerender({ levels: [A, B], current: 'lvl_default' });

    expect(select).toHaveBeenCalledWith('lvl_linked');
  });

  it('χωρίς `lvl` στη διεύθυνση δεν κάνει τίποτα', () => {
    const select = jest.fn();
    mount(select, { levels: [A, B], current: 'lvl_default' });
    expect(select).not.toHaveBeenCalled();
  });
});

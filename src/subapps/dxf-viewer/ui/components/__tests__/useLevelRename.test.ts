/**
 * ADR-914 §2.9 — η επιτόπια μετονομασία επιπέδου: Enter κρατά, Escape πετά, απώλεια εστίασης
 * κρατά — και **γράφει μόνο όταν το όνομα άλλαξε**.
 *
 * Το δεύτερο είναι ο λόγος ύπαρξης της σουίτας: πριν, μια εστίαση που χανόταν πριν ο άνθρωπος
 * πληκτρολογήσει «ολοκλήρωνε» τη μετονομασία με το παλιό όνομα και έστελνε `PATCH` για το τίποτα.
 */

import type React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useLevelRename } from '../useLevelRename';

const draft = { id: 'lvl_draft', name: 'Πρόχειρο 1' };

function setup() {
  const renameLevel = jest.fn();
  const onEmptyName = jest.fn();
  const hook = renderHook(() => useLevelRename({ renameLevel, onEmptyName }));
  return { ...hook, renameLevel, onEmptyName };
}

function key(name: string): React.KeyboardEvent<HTMLInputElement> {
  return { key: name, preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
}

describe('useLevelRename', () => {
  it('ανοίγει με το τωρινό όνομα του επιπέδου', () => {
    const { result } = setup();
    act(() => result.current.startEditing(draft));

    expect(result.current.editingLevelId).toBe('lvl_draft');
    expect(result.current.editingName).toBe('Πρόχειρο 1');
  });

  it('Enter γράφει το νέο όνομα, χωρίς τα κενά στις άκρες, και κλείνει', () => {
    const { result, renameLevel } = setup();
    act(() => result.current.startEditing(draft));
    act(() => result.current.setEditingName('  Μελέτη όψεων '));
    act(() => result.current.onKeyDown(key('Enter')));

    expect(renameLevel).toHaveBeenCalledWith('lvl_draft', 'Μελέτη όψεων');
    expect(result.current.editingLevelId).toBeNull();
  });

  it('🔑 απώλεια εστίασης ΧΩΡΙΣ αλλαγή δεν γράφει τίποτα', () => {
    const { result, renameLevel } = setup();
    act(() => result.current.startEditing(draft));
    act(() => result.current.commit());

    expect(renameLevel).not.toHaveBeenCalled();
    expect(result.current.editingLevelId).toBeNull();
  });

  it('απώλεια εστίασης ΜΕ αλλαγή κρατά το νέο όνομα', () => {
    const { result, renameLevel } = setup();
    act(() => result.current.startEditing(draft));
    act(() => result.current.setEditingName('Σκαρίφημα'));
    act(() => result.current.commit());

    expect(renameLevel).toHaveBeenCalledWith('lvl_draft', 'Σκαρίφημα');
  });

  it('Escape πετά ό,τι γράφτηκε', () => {
    const { result, renameLevel } = setup();
    act(() => result.current.startEditing(draft));
    act(() => result.current.setEditingName('Σκαρίφημα'));
    act(() => result.current.onKeyDown(key('Escape')));

    expect(renameLevel).not.toHaveBeenCalled();
    expect(result.current.editingLevelId).toBeNull();
  });

  it('🔑 Enter και μετά η απώλεια εστίασης του πεδίου που φεύγει γράφουν ΜΙΑ φορά', () => {
    const { result, renameLevel } = setup();
    act(() => result.current.startEditing(draft));
    act(() => result.current.setEditingName('Σκαρίφημα'));
    const staleBlur = result.current.commit;
    act(() => result.current.onKeyDown(key('Enter')));
    act(() => staleBlur());

    expect(renameLevel).toHaveBeenCalledTimes(1);
  });

  it('κενό όνομα: το παλιό μένει, ο άνθρωπος ενημερώνεται, τίποτα δεν γράφεται', () => {
    const { result, renameLevel, onEmptyName } = setup();
    act(() => result.current.startEditing(draft));
    act(() => result.current.setEditingName('   '));
    act(() => result.current.onKeyDown(key('Enter')));

    expect(onEmptyName).toHaveBeenCalledTimes(1);
    expect(renameLevel).not.toHaveBeenCalled();
    expect(result.current.editingLevelId).toBeNull();
  });
});

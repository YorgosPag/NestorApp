/**
 * ADR-763 §7 — **«Πιο πρόσφατη χρήση»**: LRU δέκα ονομάτων με επιμονή.
 *
 * @see state/formula-mru-store.ts
 */

import {
  __resetFormulaMruForTests,
  getRecentFormulaFunctions,
  getRecentFormulaFunctionsServerSnapshot,
  rememberFormulaFunction,
  subscribeRecentFormulaFunctions,
} from '../../../state/formula-mru-store';
import { STORAGE_KEYS } from '../../../utils/storage-utils';

describe('ADR-763 §7 — μνήμη πρόσφατων συναρτήσεων', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetFormulaMruForTests();
  });

  it('καθαρή εγκατάσταση ⇒ σπορά, ΟΧΙ άδεια λίστα', () => {
    // Άδεια λίστα σημαίνει ότι η **προεπιλεγμένη** κατηγορία του διαλόγου ανοίγει κενή.
    const seeded = getRecentFormulaFunctions();
    expect(seeded.length).toBe(10);
    expect(seeded).toContain('SUM');
  });

  it('η νέα χρήση πάει μπροστά', () => {
    rememberFormulaFunction('VLOOKUP');
    expect(getRecentFormulaFunctions()[0]).toBe('VLOOKUP');
  });

  it('η επανάληψη ΜΕΤΑΚΙΝΕΙ, δεν διπλασιάζει', () => {
    rememberFormulaFunction('COUNT');
    rememberFormulaFunction('MAX');
    rememberFormulaFunction('COUNT');
    const recent = getRecentFormulaFunctions();
    expect(recent[0]).toBe('COUNT');
    expect(recent.filter((name) => name === 'COUNT')).toHaveLength(1);
  });

  it('το όριο είναι δέκα — η ενδέκατη διώχνει την παλαιότερη', () => {
    for (const name of ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9', 'J10', 'K11']) {
      rememberFormulaFunction(name);
    }
    const recent = getRecentFormulaFunctions();
    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe('K11');
    expect(recent).not.toContain('A1');
  });

  it('ιδεμποτής ως προς τη σειρά — δεύτερη ίδια κλήση δεν ειδοποιεί συνδρομητές', () => {
    rememberFormulaFunction('SUMIF');
    let notifications = 0;
    const unsubscribe = subscribeRecentFormulaFunctions(() => { notifications += 1; });
    rememberFormulaFunction('SUMIF');
    unsubscribe();
    expect(notifications).toBe(0);
  });

  it('γράφεται στο localStorage και επιβιώνει σε νέα συνεδρία', () => {
    rememberFormulaFunction('TEXTJOIN');
    expect(window.localStorage.getItem(STORAGE_KEYS.FORMULA_RECENT_FUNCTIONS)).toContain('TEXTJOIN');
    __resetFormulaMruForTests();
    expect(getRecentFormulaFunctions()[0]).toBe('TEXTJOIN');
  });

  it('αλλοιωμένο περιεχόμενο δεν ρίχνει τον διάλογο', () => {
    window.localStorage.setItem(STORAGE_KEYS.FORMULA_RECENT_FUNCTIONS, '{"not":"an array"}');
    __resetFormulaMruForTests();
    expect(getRecentFormulaFunctions().length).toBe(10);
  });

  it('διπλότυπα από παλιό σχήμα καθαρίζονται στην ανάγνωση', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.FORMULA_RECENT_FUNCTIONS,
      JSON.stringify(['SUM', 'SUM', 'IF', 3, 'IF']),
    );
    __resetFormulaMruForTests();
    expect(getRecentFormulaFunctions()).toEqual(['SUM', 'IF']);
  });

  it('άδειο αποθηκευμένο ΣΕΒΕΤΑΙ τον χρήστη — δεν επαναφέρει τη σπορά', () => {
    window.localStorage.setItem(STORAGE_KEYS.FORMULA_RECENT_FUNCTIONS, '[]');
    __resetFormulaMruForTests();
    expect(getRecentFormulaFunctions()).toEqual([]);
  });

  it('το snapshot του server είναι η σπορά — αλλιώς αποκλίνουν οι δύο αποδόσεις', () => {
    expect(getRecentFormulaFunctionsServerSnapshot()).toHaveLength(10);
  });
});
